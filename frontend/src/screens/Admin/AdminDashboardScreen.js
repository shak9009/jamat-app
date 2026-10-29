import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Dimensions, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AdminDashboardScreen({ navigation }) {
  const { logout, user } = useAuth();

  const [masjidsList, setMasjidsList] = useState([]);
  const [upcomingGroup, setUpcomingGroup] = useState([]);
  const [boardMembers, setBoardMembers] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const scrollViewRef = React.useRef(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const upcomingScrollViewRef = React.useRef(null);
  const [currentUpcomingIndex, setCurrentUpcomingIndex] = useState(0);

  const menuItems = [
    { label: 'My Masjid', screen: 'ManageMasjid', icon: 'moon', color: '#1b6b3c', description: 'Update Timings & Committee' },
    { label: 'Manage Events', screen: 'Events', icon: 'calendar', color: '#e67e22', description: 'Upload Bayaan & Programs' },
    { label: 'Manage Ulamas', screen: 'ManageUlamas', icon: 'people', color: '#27ae60', description: 'Add Ulamas & Bayans' },
    { label: 'Contact Master Admin', screen: 'AskQuestions', icon: 'chatbubbles', color: '#3498db', description: 'Ask questions or get support' },
    { label: 'Submit Request', screen: 'SubmitRequest', icon: 'paper-plane', color: '#9b59b6', description: 'Send request with image' },
  ];

  const handleOpenMap = (address, masjidName) => {
    if (!address) {
      Alert.alert('Location not found', 'No address available for this masjid.');
      return;
    }
    Alert.alert(
      'View Route',
      `Open maps to see the route for ${masjidName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Map',
          onPress: () => {
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + ' ' + masjidName)}`;
            Linking.openURL(url).catch(() => {
              Alert.alert('Error', 'Could not open maps application.');
            });
          }
        }
      ]
    );
  };

  useEffect(() => {
    const slideCount = boardMembers.length + 1; // +1 for the Stay Updated slide
    const interval = setInterval(() => {
      setCurrentSlideIndex(prevIndex => {
        const nextIndex = (prevIndex + 1) % slideCount;
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            x: nextIndex * (SCREEN_WIDTH - 40),
            animated: true,
          });
        }
        return nextIndex;
      });
    }, 4000); // 4 seconds delay
    return () => clearInterval(interval);
  }, [boardMembers.length]);

  useEffect(() => {
    if (upcomingGroup.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentUpcomingIndex(prevIndex => {
        const nextIndex = (prevIndex + 1) % upcomingGroup.length;
        if (upcomingScrollViewRef.current) {
          upcomingScrollViewRef.current.scrollTo({
            x: nextIndex * (SCREEN_WIDTH - 72),
            animated: true,
          });
        }
        return nextIndex;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [upcomingGroup.length]);

  useEffect(() => {
    const fetchMasjids = async () => {
      try {
        const { data, error } = await supabase.from('masjids').select('*');
        if (!error && data && data.length > 0) {
          setMasjidsList(data);
          calculateEarliestPrayers(data);
        }
      } catch (e) {
        console.warn('Error fetching masjids from Supabase:', e);
      }
    };

    const fetchBoardMembers = async () => {
      try {
        const { data, error } = await supabase.from('board_members').select('*').order('created_at', { ascending: true });
        if (!error && data && data.length > 0) {
          setBoardMembers(data);
        }
      } catch (e) {
        console.warn('Error fetching board members from Supabase:', e);
      }
    };

    const loadAll = async () => {
      setIsLoadingData(true);
      await Promise.all([
        fetchMasjids(),
        fetchBoardMembers()
      ]);
      setIsLoadingData(false);
    };

    loadAll();

    const interval = setInterval(() => {
      setMasjidsList(prev => {
        if (prev && prev.length > 0) calculateEarliestPrayers(prev);
        return prev;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const calculateEarliestPrayers = (allMasjids) => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentDay = now.getDay();

    let allUpcoming = [];

    allMasjids.forEach(masjid => {
      const timings = masjid.timings_json;
      if (!timings) return;

      const prayers = [
        { name: 'Fajr', key: 'fajr' },
        { name: currentDay === 5 && timings.jumuah ? 'Jumu\'ah' : 'Dhuhr', key: currentDay === 5 && timings.jumuah ? 'jumuah' : 'dhuhr' },
        { name: 'Asr', key: 'asr' },
        { name: 'Maghrib', key: 'maghrib' },
        { name: 'Isha', key: 'isha' }
      ];

      let next = null;
      for (let p of prayers) {
        let timeObj = timings[p.key];
        if (typeof timeObj === 'string') {
          timeObj = { jamat: timeObj, azaan: '' };
        }

        if (timeObj && timeObj.jamat) {
          const [h, m] = timeObj.jamat.split(':');
          if (h && m) {
            let hours = parseInt(h, 10);
            const mins = parseInt(m, 10);
            const lowerTime = timeObj.jamat.toLowerCase();

            if (lowerTime.includes('pm') && hours !== 12) hours += 12;
            else if (lowerTime.includes('am') && hours === 12) hours = 0;

            const prayerMins = hours * 60 + mins;
            if (prayerMins > currentMinutes) {
              next = { ...p, timeStr: timeObj.jamat, azaanTimeStr: timeObj.azaan, tomorrow: false, masjidName: masjid.name, masjidId: masjid.id, address: masjid.address, minutes: prayerMins };
              break;
            }
          }
        }
      }

      if (next) allUpcoming.push(next);
    });

    if (allUpcoming.length === 0) {
      setUpcomingGroup([]);
      return;
    }

    allUpcoming.sort((a, b) => a.minutes - b.minutes);
    setUpcomingGroup(allUpcoming);
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    if (timeString.toLowerCase().includes('am') || timeString.toLowerCase().includes('pm')) {
      return timeString;
    }
    const [h, m] = timeString.split(':');
    if (!h || !m) return timeString;
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${m} ${ampm}`;
  };

  if (isLoadingData) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: '#f4f9f5' }]}>
        <View style={{ flex: 1, padding: 20, paddingTop: 40 }}>
          <View style={{ height: 120, backgroundColor: '#e0e0e0', borderRadius: 24, marginBottom: 20, opacity: 0.5 }} />
          <View style={{ height: 160, backgroundColor: '#e0e0e0', borderRadius: 24, marginBottom: 20, opacity: 0.5 }} />
          <View style={{ height: 30, width: 150, backgroundColor: '#e0e0e0', borderRadius: 10, marginBottom: 20, opacity: 0.5 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={{ width: '48%', height: 100, backgroundColor: '#e0e0e0', borderRadius: 20, marginBottom: 15, opacity: 0.5 }} />
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout securely?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => logout() }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        bounces={false}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >

        <View style={styles.stickyHeaderWrapper}>
          <View style={styles.stickyHeader}>
            <View style={styles.headerContent}>
              <View style={styles.greetingAvatar}>
                <Text style={styles.greetingAvatarText}>
                  {(user?.name || user?.displayName || user?.full_name || user?.email || 'A').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.greetingText}>
                <Text style={styles.headerSubtitle}>asalamu alaikum warahamatullahi wabarakatuhu 👋</Text>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {user?.name || user?.displayName || user?.full_name || auth.currentUser?.displayName || user?.email?.split('@')[0] || 'Admin'}
                </Text>
              </View>
              <View style={styles.adminBadgeContainer}>
                <Text style={styles.adminBadge}>Admin</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Top Slider Card */}
        <View style={styles.sliderWrapper}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => {
              const contentOffsetX = e.nativeEvent.contentOffset.x;
              const currentIndex = Math.round(contentOffsetX / (SCREEN_WIDTH - 40));
              if (currentIndex !== currentSlideIndex) setCurrentSlideIndex(currentIndex);
            }}
            style={{ width: SCREEN_WIDTH - 40 }}
          >
            {boardMembers.length > 0 ? boardMembers.map((member, index) => (
              <View key={member.id || index} style={styles.slide}>
                <View style={styles.slideImageWrapper}>
                  {member.image_url ? (
                    <Image source={{ uri: member.image_url }} style={styles.slideImage} resizeMode="cover" />
                  ) : (
                    <Image source={require('../../../assets/JamatLogo.png')} style={styles.slideImage} resizeMode="contain" />
                  )}
                </View>
                <View style={styles.slideTextWrapper}>
                  <Text style={styles.slideTitle} numberOfLines={1}>{member.name}</Text>
                  <Text style={styles.slideSubtitle} numberOfLines={2}>{member.designation}</Text>
                </View>
              </View>
            )) : null}

            {/* Stay Updated Slide (Always at the end) */}
            <View style={styles.slide}>
              <View style={styles.slideImageWrapper}>
                <Image source={require('../../../assets/JamatLogo.png')} style={styles.slideImage} resizeMode="contain" />
              </View>
              <View style={styles.slideTextWrapper}>
                <Text style={styles.slideTitle}>Stay Updated</Text>
                <Text style={styles.slideSubtitle}>Check out the latest Jamat events & news</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.pagination}>
            {Array.from({ length: boardMembers.length + 1 }).map((_, i) => (
              <View key={i} style={[styles.dot, i === currentSlideIndex && styles.activeDot]} />
            ))}
          </View>
        </View>

        {/* Upcoming Namaz Timing Widget */}
        {upcomingGroup.length > 0 && (
          <View style={styles.upcomingCard}>
            <View style={styles.upcomingHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="time" size={22} color="#1b6b3c" />
              </View>
              <Text style={styles.upcomingTitle}>Upcoming Namaz</Text>
            </View>

            <ScrollView
              ref={upcomingScrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ width: SCREEN_WIDTH - 72 }}
              scrollEventThrottle={16}
              onScroll={(e) => {
                const contentOffsetX = e.nativeEvent.contentOffset.x;
                const currentIndex = Math.round(contentOffsetX / (SCREEN_WIDTH - 72));
                if (currentIndex !== currentUpcomingIndex) {
                  setCurrentUpcomingIndex(currentIndex);
                }
              }}
            >
              {upcomingGroup.map((upcoming, idx) => (
                <View key={idx} style={{ width: SCREEN_WIDTH - 72 }}>
                  <View style={styles.upcomingDetails}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.upcomingPrayer}>{upcoming.name}</Text>
                      <Text style={styles.upcomingMasjidProminent} numberOfLines={2}>
                        {upcoming.masjidName}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {!!upcoming.azaanTimeStr && (
                        <Text style={styles.azaanTimeText}>
                          Azaan: {formatTime(upcoming.azaanTimeStr)}
                        </Text>
                      )}
                      <Text style={styles.upcomingTime}>
                        {formatTime(upcoming.timeStr)} {upcoming.tomorrow ? '(Tmrw)' : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.upcomingFooter}>
                    <View style={styles.masjidInfoRow}>
                      <Ionicons name="location" size={16} color="#888" />
                      <Text style={styles.upcomingMasjid} numberOfLines={1}>{upcoming.address || 'Address not available'}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleOpenMap(upcoming.address, upcoming.masjidName)}
                      style={styles.routeBtn}
                    >
                      <Ionicons name="navigate" size={14} color="#fff" />
                      <Text style={styles.routeBtnText}>Route</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            {upcomingGroup.length > 1 && (
              <View style={styles.pagination}>
                {upcomingGroup.map((_, i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: '#c5e3d0' }, i === currentUpcomingIndex && { backgroundColor: '#1b6b3c', width: 14 }]} />
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.gridContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionCard}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon} size={28} color={item.color} />
              </View>
              <Text style={styles.actionTitle}>{item.label}</Text>
              <Text style={styles.actionDesc}>{item.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Logout securely</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f9f5' },
  container: { padding: 20, paddingTop: 10, paddingBottom: 40 },

  stickyHeaderWrapper: {
    marginHorizontal: -20,
    marginTop: -10,
    marginBottom: 20,
    zIndex: 100,
  },
  stickyHeader: {
    width: SCREEN_WIDTH,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10
  },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  greetingAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1b6b3c', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  greetingAvatarText: { fontSize: 22, fontWeight: '900', color: '#fff' },
  greetingText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#1b6b3c', marginTop: 2 },
  headerSubtitle: { fontSize: 13, color: '#7f8c8d', fontWeight: '500' },
  adminBadgeContainer: { marginLeft: 10 },
  adminBadge: { fontSize: 11, color: '#fff', fontWeight: '700', backgroundColor: '#1b6b3c', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },

  sliderWrapper: {
    width: SCREEN_WIDTH - 40,
    backgroundColor: '#fff',
    borderRadius: 24,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: '#1b6b3c',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
    overflow: 'hidden',
  },
  slide: { width: SCREEN_WIDTH - 40, flexDirection: 'row', alignItems: 'center', padding: 20 },
  slideImageWrapper: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#f5f9f6', padding: 5, marginRight: 15, borderWidth: 1, borderColor: '#e0ebd7', elevation: 2 },
  slideImage: { width: '100%', height: '100%', borderRadius: 30 },
  slideTextWrapper: { flex: 1 },
  slideTitle: { color: '#1b6b3c', fontSize: 18, fontWeight: '800' },
  slideSubtitle: { color: '#555', fontSize: 13, marginTop: 4, fontWeight: '500', lineHeight: 18 },
  pagination: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e0e0e0', marginHorizontal: 3 },
  activeDot: { backgroundColor: '#1b6b3c', width: 14 },

  sectionHeader: { marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#2c3e50' },

  upcomingCard: {
    width: SCREEN_WIDTH - 40,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  upcomingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eef6f0', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  upcomingTitle: { color: '#2c3e50', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  upcomingDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  upcomingPrayer: { color: '#111', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  upcomingMasjidProminent: { color: '#1b6b3c', fontSize: 16, fontWeight: '700', marginTop: 4 },
  azaanTimeText: { fontSize: 13, color: '#1b6b3c', fontWeight: '600', marginBottom: 2 },
  upcomingTime: { color: '#e67e22', fontSize: 24, fontWeight: '800' },

  upcomingFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  masjidInfoRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  upcomingMasjid: { color: '#555', fontSize: 14, fontWeight: '600', marginLeft: 6 },
  routeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1b6b3c', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, shadowColor: '#1b6b3c', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
  routeBtnText: { marginLeft: 5, color: '#fff', fontSize: 13, fontWeight: 'bold' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  actionCard: { width: '48%', backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4 },
  actionIconWrap: { width: 55, height: 55, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  actionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 6 },
  actionDesc: { fontSize: 13, color: '#888', lineHeight: 18 },

  logoutButton: { backgroundColor: '#111', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
