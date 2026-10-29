import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert, Dimensions, Modal, TextInput, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { API_URL } from '../../config/apiConfig';
import Toast from 'react-native-toast-message';
import { AzanAlertPopup, AzanSettingsModal } from '../../components/AzanAlertModal';
import { checkAndTriggerEarliestAzan, getAzanAlertEnabled, getAzanAlertOffset } from '../../services/AzanAlertService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { logout, role, user } = useAuth();
  const [masjidsList, setMasjidsList] = useState([]);
  const [upcomingGroup, setUpcomingGroup] = useState([]);
  const [boardMembers, setBoardMembers] = useState([]);
  const [showJoinAdmin, setShowJoinAdmin] = useState(true);

  // Azan Alert state
  const [activeAzanAlert, setActiveAzanAlert] = useState(null);
  const [showAzanSettings, setShowAzanSettings] = useState(false);
  const [azanAlertEnabled, setAzanAlertEnabledState] = useState(true);
  const [azanAlertOffset, setAzanAlertOffsetState] = useState(2);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const [showMyRequestsModal, setShowMyRequestsModal] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const scrollViewRef = React.useRef(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const upcomingScrollViewRef = React.useRef(null);
  const [currentUpcomingIndex, setCurrentUpcomingIndex] = useState(0);



  const handleOpenMap = (address, masjidName) => {
    if (!address) {
      Toast.show({ type: 'error', text1: 'Location not found', text2: 'No address available for this masjid.' });
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
              Toast.show({ type: 'error', text1: 'Error', text2: 'Could not open maps application.' });
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
            x: nextIndex * (SCREEN_WIDTH - 32),
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
    const loadAzanConfig = async () => {
      const en = await getAzanAlertEnabled();
      const off = await getAzanAlertOffset();
      setAzanAlertEnabledState(en);
      setAzanAlertOffsetState(off);
    };
    loadAzanConfig();
  }, [showAzanSettings]);

  useEffect(() => {
    const fetchMasjids = async () => {
      try {
        const { data, error } = await supabase.from('masjids').select('*');
        if (!error && data && data.length > 0) {
          setMasjidsList(data);
          calculateEarliestPrayers(data);
          checkAndTriggerEarliestAzan(data, (alertData) => {
            setActiveAzanAlert(alertData);
          });
          return;
        }
      } catch (supaErr) {
        // Fallback
      }

      try {
        const q = query(collection(db, 'masjids'));
        const qs = await getDocs(q);
        const data = qs.docs.map(d => ({ id: d.id, ...d.data() }));
        if (data && data.length > 0) {
          setMasjidsList(data);
          calculateEarliestPrayers(data);
          checkAndTriggerEarliestAzan(data, (alertData) => {
            setActiveAzanAlert(alertData);
          });
        }
      } catch (err) {
        // Silently catch firestore error
      }
    };

    const fetchBoardMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('board_members')
          .select('*')
          .order('created_at', { ascending: true });
        if (!error && data && data.length > 0) {
          setBoardMembers(data);
          return;
        }
      } catch (supaErr) {
        // Fallback
      }

      try {
        const q = query(collection(db, 'board_members'), orderBy('created_at', 'asc'));
        const qs = await getDocs(q);
        const data = qs.docs.map(d => ({ id: d.id, ...d.data() }));
        if (data) setBoardMembers(data);
      } catch (err) {
        // Silently catch firestore error
      }
    };

    const checkAdminAvailability = async () => {
      if (role !== 'user') return;
      try {
        // Step 1: Check if user has already submitted 3+ admin requests.
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (token) {
            const response = await fetch(`${API_URL}/api/my-requests`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
              const data = await response.json();
              const adminReqCount = (data || []).filter(r => r.request_type === 'become_admin').length;
              if (adminReqCount >= 3) {
                setShowJoinAdmin(false);
                return;
              }
            }
          }
        } catch (_) {
          // Backend unreachable — keep button visible
        }

        // Step 2: Check if at least one masjid has room for more admins (via Supabase)
        let adminCounts = {};
        let masjidsListIds = [];

        try {
          const { data: supaAdmins } = await supabase
            .from('users')
            .select('id, assigned_masjid_id')
            .eq('role', 'admin');

          (supaAdmins || []).forEach(a => {
            if (a.assigned_masjid_id) {
              adminCounts[a.assigned_masjid_id] = (adminCounts[a.assigned_masjid_id] || 0) + 1;
            }
          });

          const { data: supaMasjids } = await supabase.from('masjids').select('id');
          masjidsListIds = supaMasjids || [];
        } catch (supaErr) {
          // Supabase check fallback
        }

        if (masjidsListIds.length === 0) {
          setShowJoinAdmin(true);
          return;
        }

        const hasAvailable = masjidsListIds.some(m => (adminCounts[m.id] || 0) < 2);
        setShowJoinAdmin(hasAvailable);
      } catch (err) {
        // On any unexpected error, show the button (safe default).
        setShowJoinAdmin(true);
      }
    };

    const loadAll = async () => {
      setIsLoadingData(true);
      await Promise.all([
        fetchMasjids(),
        fetchBoardMembers()
      ]);
      setIsLoadingData(false);
      checkAdminAvailability(); // Non-blocking
    };

    loadAll();

    const interval = setInterval(() => {
      setMasjidsList(prev => {
        if (prev && prev.length > 0) {
          calculateEarliestPrayers(prev);
          checkAndTriggerEarliestAzan(prev, (alertData) => {
            setActiveAzanAlert(alertData);
          });
        }
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

            if (lowerTime.includes('pm') && hours !== 12) {
              hours += 12;
            } else if (lowerTime.includes('am') && hours === 12) {
              hours = 0;
            }

            const prayerMins = hours * 60 + mins;
            if (prayerMins > currentMinutes) {
              next = { ...p, timeStr: timeObj.jamat, azaanTimeStr: timeObj.azaan, tomorrow: false, masjidName: masjid.name, masjidId: masjid.id, address: masjid.address, minutes: prayerMins };
              break;
            }
          }
        }
      }

      // Removed the tomorrow fallback block completely
      if (next) allUpcoming.push(next);
    });

    if (allUpcoming.length === 0) {
      setUpcomingGroup([]);
      return;
    }

    // Sort by time
    allUpcoming.sort((a, b) => a.minutes - b.minutes);

    // Show all upcoming masjids in the slider directly
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

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() }
    ]);
  };

  const handleSendRequest = async () => {
    if (!requestMessage.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a message.' });
      return;
    }

    setIsSubmittingRequest(true);
    try {
      await addDoc(collection(db, 'admin_password_requests'), {
        email: user?.email || 'user-request',
        phone: user?.phone || 'user-request',
        photo_url: 'none',
        message: requestMessage.trim(),
        request_type: 'user_request',
        user_id: user?.id || null,
        status: 'pending',
        created_at: new Date().toISOString()
      });

      Toast.show({ type: 'success', text1: 'Success', text2: 'Your request has been sent to the Master Admin.' });
      setRequestMessage('');
      setShowRequestModal(false);
    } catch (err) {
      console.error(err);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to send request.' });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleOpenMyRequests = async () => {
    setShowMyRequestsModal(true);
    setIsLoadingRequests(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${API_URL}/api/my-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch requests');
      
      const data = await response.json();
      setMyRequests(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const getDisplayMessage = (req) => {
    if (req.request_type === 'become_admin') {
      try {
        const p = JSON.parse(req.message);
        return `Requested to become Admin for ${p.masjidName} (${p.area})`;
      } catch (e) {
        return 'Admin Request';
      }
    }
    return req.message;
  };

  if (isLoadingData) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: '#f4f9f5' }]}>
        <View style={{ flex: 1, padding: 20, paddingTop: 40 }}>
          <View style={{ height: 120, backgroundColor: '#e0e0e0', borderRadius: 24, marginBottom: 20, opacity: 0.5 }} />
          <View style={{ height: 160, backgroundColor: '#e0e0e0', borderRadius: 24, marginBottom: 20, opacity: 0.5 }} />
          <View style={{ height: 30, width: 150, backgroundColor: '#e0e0e0', borderRadius: 10, marginBottom: 20, opacity: 0.5 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
             {Array.from({length: 6}).map((_, i) => (
                <View key={i} style={{ width: (SCREEN_WIDTH - 60) / 3, height: 100, backgroundColor: '#e0e0e0', borderRadius: 20, marginBottom: 15, opacity: 0.5 }} />
             ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} bounces={false} showsVerticalScrollIndicator={false}>
        {/* Top Slider Card */}
        <View style={styles.sliderWrapper}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => {
              // Update index if user manually swipes
              const contentOffsetX = e.nativeEvent.contentOffset.x;
              const currentIndex = Math.round(contentOffsetX / (SCREEN_WIDTH - 40));
              if (currentIndex !== currentSlideIndex) {
                setCurrentSlideIndex(currentIndex);
              }
            }}
            style={{ width: SCREEN_WIDTH - 40 }}
          >
            {/* Board Members Slides */}
            {boardMembers.length > 0 ? boardMembers.map((member, index) => (
              <View key={member.id || index} style={styles.slide}>
                <View style={styles.slideImageWrapper}>
                  {member.image_url ? (
                    <Image source={{ uri: member.image_url }} style={styles.slideImage} resizeMode="cover" />
                  ) : (
                    <Image source={require('../../../assets/JamatLogo.png')} style={[styles.slideImage, { borderRadius: 0 }]} resizeMode="contain" />
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
                <Image source={require('../../../assets/JamatLogo.png')} style={[styles.slideImage, { borderRadius: 0 }]} resizeMode="contain" />
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

        {upcomingGroup.length > 0 && (
          <View style={styles.upcomingCard}>
            <View style={styles.upcomingHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={styles.iconCircle}>
                  <Ionicons name="time" size={22} color="#1b6b3c" />
                </View>
                <Text style={styles.upcomingTitle}>Upcoming Namaz</Text>
              </View>
              <TouchableOpacity
                style={styles.azanAlertBadgeBtn}
                onPress={() => setShowAzanSettings(true)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={azanAlertEnabled ? "notifications" : "notifications-off-outline"}
                  size={15}
                  color={azanAlertEnabled ? "#1b6b3c" : "#888"}
                />
                <Text style={[styles.azanAlertBadgeText, { color: azanAlertEnabled ? "#1b6b3c" : "#888" }]}>
                  {azanAlertEnabled ? `${azanAlertOffset}m Alert` : 'Alert Off'}
                </Text>
              </TouchableOpacity>
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

        <View style={styles.gridSectionHeader}>
          <Text style={styles.gridSectionTitle}>Quick Services</Text>
        </View>

        {/* Action Grid */}
        <View style={styles.grid}>
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Events')} activeOpacity={0.8}>
            <View style={[styles.cardIconWrapper, { backgroundColor: '#fdf3e5' }]}>
              <Ionicons name="calendar" size={32} color="#f39c12" />
            </View>
            <Text style={styles.cardText}>Events</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('AskQuestions')} activeOpacity={0.8}>
            <View style={[styles.cardIconWrapper, { backgroundColor: '#eef6f9' }]}>
              <Ionicons name="chatbubbles" size={32} color="#3498db" />
            </View>
            <Text style={styles.cardText}>Q & A</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Donation')} activeOpacity={0.8}>
            <View style={[styles.cardIconWrapper, { backgroundColor: '#fbeef2' }]}>
              <Ionicons name="wallet" size={32} color="#e74c3c" />
            </View>
            <Text style={styles.cardText}>Donate</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Masjid')} activeOpacity={0.8}>
            <View style={[styles.cardIconWrapper, { backgroundColor: '#f4f9f5' }]}>
              <Ionicons name="moon" size={32} color="#1b6b3c" />
            </View>
            <Text style={styles.cardText}>Masjids</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('SubmitRequest')} activeOpacity={0.8}>
            <View style={[styles.cardIconWrapper, { backgroundColor: '#f3e5f5' }]}>
              <Ionicons name="mail" size={32} color="#9b59b6" />
            </View>
            <Text style={styles.cardText}>Contact</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('UlamasAndBayans')} activeOpacity={0.8}>
            <View style={[styles.cardIconWrapper, { backgroundColor: '#e8f5e9' }]}>
              <Ionicons name="people" size={32} color="#27ae60" />
            </View>
            <Text style={styles.cardText}>Ulamas</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={handleOpenMyRequests} activeOpacity={0.8}>
            <View style={[styles.cardIconWrapper, { backgroundColor: '#eef2f5' }]}>
              <Ionicons name="archive" size={32} color="#7f8c8d" />
            </View>
            <Text style={styles.cardText}>Requests</Text>
          </TouchableOpacity>

          {role === 'user' ? (
            showJoinAdmin ? (
              <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('BecomeAdmin')} activeOpacity={0.8}>
                <View style={[styles.cardIconWrapper, { backgroundColor: '#f0f5ff' }]}>
                  <Ionicons name="shield-checkmark" size={32} color="#3498db" />
                </View>
                <Text style={styles.cardText}>Join Admin</Text>
              </TouchableOpacity>
            ) : null
          ) : (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate(role === 'master_admin' ? 'MasterAdminDashboard' : 'AdminDashboard')} activeOpacity={0.8}>
              <View style={[styles.cardIconWrapper, { backgroundColor: '#eef6f0' }]}>
                <Ionicons name="settings" size={32} color="#1b6b3c" />
              </View>
              <Text style={styles.cardText}>Admin Panel</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.card} onPress={() => setShowAzanSettings(true)} activeOpacity={0.8}>
            <View style={[styles.cardIconWrapper, { backgroundColor: '#eafaf1' }]}>
              <Ionicons name="volume-medium" size={32} color="#1b6b3c" />
            </View>
            <Text style={styles.cardText}>Azaan Alert</Text>
          </TouchableOpacity>
        </View>

        {/* User Request Modal */}
        <Modal visible={showRequestModal} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Send Request</Text>
              </View>
              <Text style={styles.modalDesc}>Send a private message or request to the Master Admin.</Text>

              <TextInput
                style={styles.textInput}
                placeholder="Type your request here..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={5}
                value={requestMessage}
                onChangeText={setRequestMessage}
                textAlignVertical="top"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRequestModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSendRequest} disabled={isSubmittingRequest}>
                  {isSubmittingRequest ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Send</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* My Requests Modal */}
        <Modal visible={showMyRequestsModal} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '85%', padding: 0 }]}>
              <View style={[styles.modalHeader, { padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' }]}>
                <Text style={styles.modalTitle}>My Requests</Text>
                <TouchableOpacity onPress={() => setShowMyRequestsModal(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color="#1b6b3c" />
                </TouchableOpacity>
              </View>

              {isLoadingRequests ? (
                <View style={{ padding: 40 }}><ActivityIndicator size="large" color="#1b6b3c" /></View>
              ) : myRequests.length === 0 ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Ionicons name="folder-open-outline" size={60} color="#e0e0e0" />
                  <Text style={styles.emptyInbox}>No requests found.</Text>
                </View>
              ) : (
                <ScrollView contentContainerStyle={styles.myRequestsList}>
                  {myRequests.map(req => (
                    <View key={req.id} style={styles.reqItemCard}>
                      <View style={styles.reqItemHeader}>
                        <View style={[styles.statusDot, req.status === 'resolved' || req.status === 'approved' ? { backgroundColor: '#2ecc71' } : req.status === 'rejected' ? { backgroundColor: '#e74c3c' } : { backgroundColor: '#f1c40f' }]} />
                        <Text style={styles.reqItemDate}>{req.created_at || req.createdAt ? new Date(req.created_at || req.createdAt).toLocaleDateString() : 'Unknown Date'}</Text>
                      </View>
                      <Text style={styles.reqItemMsg}>{getDisplayMessage(req)}</Text>
                      {req.image_url && (
                        <Image source={{ uri: req.image_url }} style={styles.reqImage} />
                      )}
                      <View style={styles.replyBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={styles.replyBoxLabel}>Status: </Text>
                          <Text style={[styles.replyBoxText, { fontWeight: '700', color: req.status === 'resolved' || req.status === 'approved' ? '#2ecc71' : req.status === 'rejected' ? '#e74c3c' : '#f1c40f' }]}>{req.status.toUpperCase()}</Text>
                        </View>
                        {req.status === 'rejected' && req.reject_reason && (
                          <View style={{ marginTop: 4 }}>
                            <Text style={styles.replyBoxLabel}>Reason:</Text>
                            <Text style={[styles.replyBoxText, { color: '#444', fontStyle: 'italic', marginTop: 2 }]}>{req.reject_reason}</Text>
                          </View>
                        )}
                        {(req.status === 'approved' || req.status === 'resolved') && req.admin_reply && (
                          <View style={{ marginTop: 4 }}>
                            <Text style={styles.replyBoxLabel}>Admin Reply:</Text>
                            <Text style={[styles.replyBoxText, { color: '#444', fontStyle: 'italic', marginTop: 2 }]}>{req.admin_reply}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

      </ScrollView>

      {/* Active Azan Alert Popup (with sound, 30s countdown, and Stop button) */}
      <AzanAlertPopup
        visible={!!activeAzanAlert}
        alertData={activeAzanAlert}
        onClose={() => setActiveAzanAlert(null)}
      />

      {/* Azan Alert Settings Modal (toggle ON/OFF, timing, test voice) */}
      <AzanSettingsModal
        visible={showAzanSettings}
        onClose={() => setShowAzanSettings(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fdfa' },
  container: { flexGrow: 1, alignItems: 'center', paddingBottom: 30, backgroundColor: '#f8fdfa' },

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
  slideTitle: { color: '#1b6b3c', fontSize: 13, fontWeight: '800' },
  slideSubtitle: { color: '#555', fontSize: 10, marginTop: 4, fontWeight: '500', lineHeight: 18 },
  pagination: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e0e0e0', marginHorizontal: 3 },
  activeDot: { backgroundColor: '#1b6b3c', width: 14 },

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

  nextJamaatContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff5eb', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, marginTop: 15, borderWidth: 1, borderColor: '#ffe5d0' },
  nextJamaatText: { color: '#d35400', fontSize: 13, fontWeight: '600', marginLeft: 6, flex: 1 },

  gridSectionHeader: { width: SCREEN_WIDTH - 40, alignSelf: 'center', marginBottom: 15, marginTop: 10 },
  gridSectionTitle: { fontSize: 18, fontWeight: '800', color: '#2c3e50' },

  grid: { width: SCREEN_WIDTH - 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  card: { width: (SCREEN_WIDTH - 60) / 3, backgroundColor: '#fff', borderRadius: 20, padding: 15, alignItems: 'center', margin: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  cardIconWrapper: { width: 56, height: 56, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cardText: { fontSize: 13, fontWeight: '700', color: '#333' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: SCREEN_WIDTH - 40, backgroundColor: '#fff', borderRadius: 24, padding: 24, elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1b6b3c' },
  modalDesc: { color: '#666', fontSize: 14, marginBottom: 20, lineHeight: 20 },
  textInput: { borderWidth: 1, borderColor: '#eaeaea', borderRadius: 16, padding: 16, height: 140, backgroundColor: '#fafafa', marginBottom: 24, fontSize: 15, color: '#333' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelBtn: { backgroundColor: '#f0f0f0', paddingVertical: 14, borderRadius: 16, flex: 0.47, alignItems: 'center' },
  cancelBtnText: { color: '#555', fontWeight: 'bold', fontSize: 15 },
  saveBtn: { backgroundColor: '#1b6b3c', paddingVertical: 14, borderRadius: 16, flex: 0.47, alignItems: 'center', shadowColor: '#1b6b3c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  closeBtn: { backgroundColor: '#f0f0f0', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  emptyInbox: { textAlign: 'center', color: '#888', marginTop: 15, fontSize: 16, fontWeight: '600' },
  myRequestsList: { padding: 20 },
  reqItemCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#eee', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  reqItemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  reqItemDate: { fontSize: 13, color: '#888', fontWeight: '600' },
  reqItemMsg: { fontSize: 15, color: '#333', marginBottom: 15, fontWeight: '500', lineHeight: 22 },
  reqImage: { width: '100%', height: 150, borderRadius: 12, marginBottom: 15 },
  replyBox: { backgroundColor: '#f4f9f5', padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  replyBoxLabel: { fontSize: 13, color: '#555', marginRight: 5 },
  replyBoxText: { fontSize: 13 }
});
