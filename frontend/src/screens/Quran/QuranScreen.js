import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SURAHS_LIST, getSurahAudioUrl } from '../../data/quranData';
import { quranAudioService } from '../../services/quranAudioService';

export default function QuranScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, meccan, medinan, bookmarked
  const [bookmarks, setBookmarks] = useState([]);
  const [lastRead, setLastRead] = useState(null);

  // Audio player state
  const [audioStatus, setAudioStatus] = useState({
    url: null,
    isPlaying: false,
    isBuffering: false,
    currentTime: 0,
    duration: 0,
    metadata: null,
  });

  useEffect(() => {
    navigation.setOptions({
      title: 'Holy Quran (القرآن الكريم)',
      headerStyle: { backgroundColor: '#0a3d1f' },
      headerTintColor: '#ffffff',
    });

    loadSavedState();

    const unsubscribe = quranAudioService.subscribeStatus((status) => {
      setAudioStatus(status);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadSavedState = async () => {
    try {
      const bKey = await AsyncStorage.getItem('quran_bookmarked_surahs');
      if (bKey) setBookmarks(JSON.parse(bKey));

      const lrKey = await AsyncStorage.getItem('quran_last_read_surah');
      if (lrKey) setLastRead(JSON.parse(lrKey));
    } catch (_) {}
  };

  const toggleBookmark = async (surahNumber) => {
    let updated;
    if (bookmarks.includes(surahNumber)) {
      updated = bookmarks.filter((n) => n !== surahNumber);
    } else {
      updated = [...bookmarks, surahNumber];
    }
    setBookmarks(updated);
    try {
      await AsyncStorage.setItem('quran_bookmarked_surahs', JSON.stringify(updated));
    } catch (_) {}
  };

  const handlePlaySurahAudio = async (surah) => {
    const audioUrl = getSurahAudioUrl(surah.number);
    if (audioStatus.url === audioUrl && audioStatus.isPlaying) {
      await quranAudioService.pause();
    } else if (audioStatus.url === audioUrl && !audioStatus.isPlaying) {
      await quranAudioService.resume();
    } else {
      await quranAudioService.play(audioUrl, {
        surahNumber: surah.number,
        surahName: surah.englishName,
        arabicName: surah.name,
        reciter: 'Sheikh Mishary Alafasy',
      });
    }
  };

  const filteredSurahs = SURAHS_LIST.filter((surah) => {
    // Filter type
    if (selectedFilter === 'meccan' && surah.revelationType !== 'Meccan') return false;
    if (selectedFilter === 'medinan' && surah.revelationType !== 'Medinan') return false;
    if (selectedFilter === 'bookmarked' && !bookmarks.includes(surah.number)) return false;

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      const matchNumber = String(surah.number) === query;
      const matchEnglish = surah.englishName.toLowerCase().includes(query);
      const matchTrans = surah.englishNameTranslation.toLowerCase().includes(query);
      const matchArabic = surah.name.includes(query);
      return matchNumber || matchEnglish || matchTrans || matchArabic;
    }

    return true;
  });

  const renderSurahItem = ({ item }) => {
    const audioUrl = getSurahAudioUrl(item.number);
    const isThisPlaying = audioStatus.url === audioUrl && audioStatus.isPlaying;
    const isThisBuffering = audioStatus.url === audioUrl && audioStatus.isBuffering;
    const isBookmarked = bookmarks.includes(item.number);

    return (
      <TouchableOpacity
        style={[styles.surahCard, isThisPlaying && styles.surahCardActive]}
        activeOpacity={0.7}
        onPress={() => {
          navigation.navigate('SurahDetail', {
            surahNumber: item.number,
            surahName: item.englishName,
            arabicName: item.name,
            totalAyahs: item.numberOfAyahs,
          });
        }}
      >
        {/* Number Badge */}
        <View style={[styles.numberBadge, isThisPlaying && styles.numberBadgeActive]}>
          <Text style={[styles.numberText, isThisPlaying && styles.numberTextActive]}>
            {item.number}
          </Text>
        </View>

        {/* Surah Info */}
        <View style={styles.surahInfo}>
          <Text style={styles.surahEnglishName}>{item.englishName}</Text>
          <Text style={styles.surahTranslation}>
            {item.englishNameTranslation} • {item.numberOfAyahs} Ayahs
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.typeBadge, item.revelationType === 'Meccan' ? styles.meccanBadge : styles.medinanBadge]}>
              <Text style={styles.typeBadgeText}>{item.revelationType}</Text>
            </View>
          </View>
        </View>

        {/* Right Section: Arabic Name + Actions */}
        <View style={styles.rightSection}>
          <Text style={styles.surahArabicName}>{item.name}</Text>
          <View style={styles.actionButtonsRow}>
            {/* Bookmark */}
            <TouchableOpacity
              onPress={() => toggleBookmark(item.number)}
              style={styles.iconBtn}
              activeOpacity={0.6}
            >
              <Ionicons
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={isBookmarked ? '#d4af37' : '#999'}
              />
            </TouchableOpacity>

            {/* Quick Audio Play Button */}
            <TouchableOpacity
              onPress={() => handlePlaySurahAudio(item)}
              style={[styles.playBtn, isThisPlaying && styles.playBtnActive]}
              activeOpacity={0.7}
            >
              {isThisBuffering ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name={isThisPlaying ? 'pause' : 'play'}
                  size={16}
                  color={isThisPlaying ? '#fff' : '#1b6b3c'}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a3d1f" />

      {/* Header Banner */}
      <View style={styles.headerBanner}>
        <View style={styles.bannerContent}>
          <Ionicons name="book" size={26} color="#d4af37" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.bannerTitle}>Read & Listen to the Holy Quran</Text>
            <Text style={styles.bannerSubtitle}>Voice recitation by Sheikh Mishary Alafasy</Text>
          </View>
        </View>

        {/* Last Read Quick Jump */}
        {lastRead && (
          <TouchableOpacity
            style={styles.lastReadPill}
            onPress={() => {
              navigation.navigate('SurahDetail', {
                surahNumber: lastRead.number,
                surahName: lastRead.englishName,
                arabicName: lastRead.arabicName,
              });
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={16} color="#d4af37" />
            <Text style={styles.lastReadText}>
              Continue: Surah {lastRead.englishName} ({lastRead.arabicName})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#777" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Surah name (e.g. Yasin, Baqarah, 36)..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filtersContainer}>
        {[
          { key: 'all', label: 'All 114 Surahs' },
          { key: 'meccan', label: 'Meccan' },
          { key: 'medinan', label: 'Medinan' },
          { key: 'bookmarked', label: `Saved (${bookmarks.length})` },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, selectedFilter === f.key && styles.filterChipActive]}
            onPress={() => setSelectedFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, selectedFilter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Surahs List */}
      <FlatList
        data={filteredSurahs}
        keyExtractor={(item) => String(item.number)}
        renderItem={renderSurahItem}
        contentContainerStyle={[styles.listContent, audioStatus.url && { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No Surahs match "{searchQuery}"</Text>
          </View>
        }
      />

      {/* Floating Bottom Mini Player (when audio is active) */}
      {audioStatus.url && (
        <View style={styles.miniPlayer}>
          <View style={styles.miniPlayerInfo}>
            <View style={styles.miniPlayerIcon}>
              <Ionicons name="musical-notes" size={20} color="#0a3d1f" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.miniPlayerTitle} numberOfLines={1}>
                Surah {audioStatus.metadata?.surahName || 'Recitation'} ({audioStatus.metadata?.arabicName || ''})
              </Text>
              <Text style={styles.miniPlayerSubtitle} numberOfLines={1}>
                {audioStatus.metadata?.reciter || 'Sheikh Mishary Alafasy'}
              </Text>
            </View>
          </View>

          <View style={styles.miniPlayerControls}>
            <TouchableOpacity
              onPress={() => {
                if (audioStatus.isPlaying) {
                  quranAudioService.pause();
                } else {
                  quranAudioService.resume();
                }
              }}
              style={styles.miniPlayBtn}
            >
              {audioStatus.isBuffering ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name={audioStatus.isPlaying ? 'pause' : 'play'}
                  size={20}
                  color="#fff"
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => quranAudioService.stop()} style={styles.miniCloseBtn}>
              <Ionicons name="close" size={20} color="#777" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9f7' },
  headerBanner: {
    backgroundColor: '#0a3d1f',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  bannerContent: { flexDirection: 'row', alignItems: 'center' },
  bannerTitle: { fontSize: 17, fontWeight: '800', color: '#ffffff', letterSpacing: 0.3 },
  bannerSubtitle: { fontSize: 12, color: '#c8e6c9', marginTop: 2 },
  lastReadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  lastReadText: { color: '#ffffff', fontSize: 12, fontWeight: '600', marginLeft: 6 },
  searchSection: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e1e8e4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce5df',
  },
  filterChipActive: { backgroundColor: '#1b6b3c', borderColor: '#1b6b3c' },
  filterChipText: { fontSize: 12, color: '#555', fontWeight: '600' },
  filterChipTextActive: { color: '#ffffff' },
  listContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 40 },
  surahCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eef2ee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  surahCardActive: { borderColor: '#1b6b3c', backgroundColor: '#f1f8f3' },
  numberBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#eaf4ee',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cce2d4',
  },
  numberBadgeActive: { backgroundColor: '#1b6b3c', borderColor: '#1b6b3c' },
  numberText: { fontSize: 14, fontWeight: '800', color: '#1b6b3c' },
  numberTextActive: { color: '#ffffff' },
  surahInfo: { flex: 1, marginLeft: 14 },
  surahEnglishName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  surahTranslation: { fontSize: 12, color: '#666', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  meccanBadge: { backgroundColor: '#fef3e2' },
  medinanBadge: { backgroundColor: '#e8f5e9' },
  typeBadgeText: { fontSize: 10, fontWeight: '700', color: '#777' },
  rightSection: { alignItems: 'flex-end', justifyContent: 'center' },
  surahArabicName: { fontSize: 20, color: '#0a3d1f', fontWeight: 'bold' },
  actionButtonsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 },
  iconBtn: { padding: 4 },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eaf4ee',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cce2d4',
  },
  playBtnActive: { backgroundColor: '#1b6b3c', borderColor: '#1b6b3c' },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { marginTop: 12, color: '#888', fontSize: 15 },

  // Floating Mini Player
  miniPlayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 2,
    borderTopColor: '#1b6b3c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  miniPlayerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  miniPlayerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#eaf4ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniPlayerTitle: { fontSize: 14, fontWeight: '700', color: '#0a3d1f' },
  miniPlayerSubtitle: { fontSize: 11, color: '#777', marginTop: 1 },
  miniPlayerControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  miniPlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1b6b3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCloseBtn: { padding: 6 },
});

