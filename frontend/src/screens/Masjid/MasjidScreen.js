import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, TouchableOpacity, Modal, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../config/supabaseClient';
import { AzanSettingsModal } from '../../components/AzanAlertModal';
import Toast from 'react-native-toast-message';

export default function MasjidScreen() {
  const [masjids, setMasjids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMasjid, setSelectedMasjid] = useState(null);
  const [showExtraMembers, setShowExtraMembers] = useState(false);
  const [showAzanSettings, setShowAzanSettings] = useState(false);

  useEffect(() => {
    fetchMasjids();
  }, []);

  const fetchMasjids = async () => {
    try {
      const { data, error } = await supabase
        .from('masjids')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMasjids(data);
      }
    } catch (supaErr) {
      console.warn('Error fetching masjids from Supabase:', supaErr);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';
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

  const renderGridMasjid = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.gridCard}
        activeOpacity={0.8}
        onPress={() => {
          setSelectedMasjid(item);
          setShowExtraMembers(false);
        }}
      >
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.gridImage} />
        ) : (
          <View style={styles.gridImagePlaceholder}>
            <Text style={{ color: '#999' }}>No Image</Text>
          </View>
        )}
        <View style={styles.gridContent}>
          <Text style={styles.gridTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.gridAddress} numberOfLines={2}>{item.address}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderExpandedMasjid = (item) => {
    const t = item.timings_json || {};
    const c = item.committee_json || {};

    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* Header/Close Button */}
        <View style={styles.modalHeader}>
          <Image source={require('../../../assets/JamatLogo.png')} style={{ width: 40, height: 40 }} resizeMode="contain" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setShowAzanSettings(true)}
              style={{ backgroundColor: '#f0f7f2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}
            >
              <Text style={{ color: '#1b6b3c', fontWeight: 'bold', fontSize: 13 }}>🔔 Azan Alert</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedMasjid(null)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕ Close</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} bounces={false}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.coverImage} />
          ) : (
            <View style={[styles.coverImage, { backgroundColor: '#1b6b3c', alignItems: 'center', justifyContent: 'center' }]}>
              <Image source={require('../../../assets/JamatLogo.png')} style={{ width: 120, height: 120 }} resizeMode="contain" />
            </View>
          )}

          <View style={{ padding: 20 }}>
            <Text style={styles.detailTitle}>{item.name}</Text>
            <Text style={styles.detailAddress}>{item.address}</Text>

            {/* Timings */}
            <View style={{ marginTop: 24 }}>
              <View style={styles.headerRow}>
                <Text style={[styles.prayerName, { fontWeight: 'bold', color: '#111' }]}>Prayer</Text>
                <View style={styles.timeCols}>
                  <Text style={{ color: '#111', fontWeight: 'bold', width: '50%', textAlign: 'center' }}>Azaan</Text>
                  <Text style={{ color: '#111', fontWeight: 'bold', width: '50%', textAlign: 'center' }}>Jamat</Text>
                </View>
              </View>

              {['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'jumuah'].map(prayer => (
                <View key={prayer} style={styles.prayerRow}>
                  <View style={{ width: '30%', justifyContent: 'center' }}>
                    <Text style={styles.prayerName}>{prayer === 'jumuah' ? "Jumu'ah" : prayer}</Text>
                  </View>
                  <View style={styles.timeCols}>
                    <Text style={styles.azaanTime}>
                      {formatTime(t[prayer]?.azaan || (typeof t[prayer] === 'string' ? '' : ''))}
                    </Text>
                    <Text style={styles.jamatTime}>
                      {formatTime(typeof t[prayer] === 'string' ? t[prayer] : t[prayer]?.jamat)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Committee Details */}
            {(c.mutavalli?.name || c.imam?.name || c.khatib?.name || c.moazzan?.name || c.secretary?.name || c.treasurer?.name || (c.members && c.members.length > 0)) && (
              <View style={{ marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#eee' }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1b6b3c', marginBottom: 20 }}>Masjid Members</Text>

                <View style={styles.committeeGrid}>
                  {c.mutavalli?.name ? (
                    <View style={styles.committeeMember}>
                      {c.mutavalli.image ? <Image source={{ uri: c.mutavalli.image }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder} />}
                      <Text style={styles.memberName}>{c.mutavalli.name}</Text>
                      <Text style={styles.memberRole}>Mutavalli</Text>
                    </View>
                  ) : null}
                  {c.imam?.name ? (
                    <View style={styles.committeeMember}>
                      {c.imam.image_url ? <Image source={{ uri: c.imam.image_url }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder} />}
                      <Text style={styles.memberName}>{c.imam.name}</Text>
                      <Text style={styles.memberRole}>Imam</Text>
                    </View>
                  ) : null}
                  {c.khatib?.name ? (
                    <View style={styles.committeeMember}>
                      {c.khatib.image_url ? <Image source={{ uri: c.khatib.image_url }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder} />}
                      <Text style={styles.memberName}>{c.khatib.name}</Text>
                      <Text style={styles.memberRole}>Regular Khatib</Text>
                    </View>
                  ) : null}
                  {c.moazzan?.name ? (
                    <View style={styles.committeeMember}>
                      {c.moazzan.image_url ? <Image source={{ uri: c.moazzan.image_url }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder} />}
                      <Text style={styles.memberName}>{c.moazzan.name}</Text>
                      <Text style={styles.memberRole}>Moazzan</Text>
                    </View>
                  ) : null}
                  {c.secretary?.name ? (
                    <View style={styles.committeeMember}>
                      {c.secretary.image_url ? <Image source={{ uri: c.secretary.image_url }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder} />}
                      <Text style={styles.memberName}>{c.secretary.name}</Text>
                      <Text style={styles.memberRole}>Secretary</Text>
                    </View>
                  ) : null}
                  {c.treasurer?.name ? (
                    <View style={styles.committeeMember}>
                      {c.treasurer.image_url ? <Image source={{ uri: c.treasurer.image_url }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder} />}
                      <Text style={styles.memberName}>{c.treasurer.name}</Text>
                      <Text style={styles.memberRole}>Treasurer</Text>
                    </View>
                  ) : null}
                </View>

                {c.members && c.members.length > 0 && (
                  <View style={{ marginTop: 24 }}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f7f2', padding: 12, borderRadius: 8 }}
                      onPress={() => setShowExtraMembers(!showExtraMembers)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1b6b3c' }}>Committee Members</Text>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1b6b3c' }}>{showExtraMembers ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {showExtraMembers && (
                      <View style={[styles.committeeGrid, { marginTop: 16 }]}>
                        {c.members.map((member, idx) => (
                          <View key={idx} style={styles.committeeMember}>
                            {member.image_url ? <Image source={{ uri: member.image_url }} style={styles.avatarSmall} /> : <View style={styles.avatarPlaceholderSmall} />}
                            <Text style={styles.memberName}>{member.name}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.heroSection}>
        <Text style={styles.title}>Masjids & Timings</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1b6b3c" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={masjids}
          keyExtractor={(item) => item.id}
          renderItem={renderGridMasjid}
          numColumns={2}
          contentContainerStyle={{ padding: 12 }}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40 }}>No Masjids found.</Text>}
        />
      )}

      <Modal visible={!!selectedMasjid} animationType="slide" onRequestClose={() => setSelectedMasjid(null)}>
        {selectedMasjid && renderExpandedMasjid(selectedMasjid)}
      </Modal>

      <AzanSettingsModal
        visible={showAzanSettings}
        onClose={() => setShowAzanSettings(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f9f6',
  },
  heroSection: {
    width: '100%',
    paddingTop: 20,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroLogo: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1b6b3c',
  },
  gridCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    width: '48%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  gridImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#e0ebd7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContent: {
    padding: 12,
  },
  gridTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1b6b3c',
    marginBottom: 4,
  },
  gridAddress: {
    fontSize: 12,
    color: '#666',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 20,
  },
  closeButtonText: {
    color: '#c0392b',
    fontWeight: 'bold',
    fontSize: 13,
  },
  coverImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  detailTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1b6b3c',
    marginBottom: 6,
  },
  detailAddress: {
    fontSize: 16,
    color: '#666',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e0ebd7',
    marginBottom: 12,
  },
  prayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  prayerName: {
    fontWeight: '600',
    color: '#444',
    textTransform: 'capitalize',
    fontSize: 15,
  },
  timeCols: {
    flexDirection: 'row',
    width: '70%',
    justifyContent: 'space-around',
  },
  azaanTime: {
    color: '#666',
    width: '50%',
    textAlign: 'center',
    fontSize: 15,
  },
  jamatTime: {
    color: '#1b6b3c',
    fontWeight: '700',
    width: '50%',
    textAlign: 'center',
    fontSize: 15,
  },
  committeeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  committeeMember: {
    alignItems: 'center',
    width: '30%',
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 8,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e0ebd7',
    marginBottom: 8,
  },
  avatarSmall: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 6,
  },
  avatarPlaceholderSmall: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0ebd7',
    marginBottom: 6,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  memberRole: {
    fontSize: 12,
    color: '#1b6b3c',
    textAlign: 'center',
    marginTop: 2,
    fontStyle: 'italic',
  }
});
