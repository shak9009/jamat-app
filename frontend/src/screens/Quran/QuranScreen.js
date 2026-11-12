import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SURAHS_LIST, getSurahAudioUrl } from '../../data/quranData';
import { quranAudioService } from '../../services/quranAudioService';
import ErrorBoundary from '../../components/ErrorBoundary';
import CustomSlider from '../../components/CustomSlider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = SCREEN_WIDTH - 32;

// Featured Quran Slider Slides
const QURAN_SLIDES = [
  {
    id: 'daily-reflection',
    surahNumber: 13,
    surahName: "Ar-Ra'd",
    arabicName: 'الرعد',
    totalAyahs: 43,
    badge: 'Daily Reflection',
    badgeColor: '#e0ebd7',
    badgeTextColor: '#1b6b3c',
    icon: 'heart-circle',
    iconColor: '#1b6b3c',
    iconBg: '#eaf5ee',
    arabicText: 'أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ',
    title: 'Peace in Remembrance',
    subtitle: 'Verily, in the remembrance of Allah do hearts find rest. (13:28)',
    buttonText: 'Read Surah 13',
  },
  {
    id: 'surah-yasin',
    surahNumber: 36,
    surahName: 'Ya-Sin',
    arabicName: 'يس',
    totalAyahs: 83,
    badge: 'Heart of Quran',
    badgeColor: '#fef3c7',
    badgeTextColor: '#b45309',
    icon: 'sparkles',
    iconColor: '#d97706',
    iconBg: '#fef7ed',
    arabicText: 'يس ۝ وَٱلْقُرْءَانِ ٱلْحَكِيمِ',
    title: 'Surah Ya-Sin (يس)',
    subtitle: 'Recite for ease, forgiveness, and blessings. 83 Ayahs of divine guidance.',
    buttonText: 'Read & Listen',
  },
  {
    id: 'surah-mulk',
    surahNumber: 67,
    surahName: 'Al-Mulk',
    arabicName: 'الملك',
    totalAyahs: 30,
    badge: 'Night Sunnah',
    badgeColor: '#e0e7ff',
    badgeTextColor: '#3730a3',
    icon: 'shield-checkmark',
    iconColor: '#4f46e5',
    iconBg: '#eef2ff',
    arabicText: 'تَبَٰرَكَ ٱلَّذِى بِيَدِهِ ٱلْمُلْكُ',
    title: 'Surah Al-Mulk (الملك)',
    subtitle: '30 verses that intercede for their reciter. Sunnah to recite every night.',
    buttonText: 'Read & Listen',
  },
  {
    id: 'surah-kahf',
    surahNumber: 18,
    surahName: 'Al-Kahf',
    arabicName: 'الكهف',
    totalAyahs: 110,
    badge: 'Friday Special',
    badgeColor: '#fef9c3',
    badgeTextColor: '#854d0e',
    icon: 'sunny',
    iconColor: '#ca8a04',
    iconBg: '#fefce8',
    arabicText: 'ٱلْحَمْدُ لِلَّهِ ٱلَّذِىٓ أَنزَلَ عَلَىٰ عَبْدِهِ ٱلْكِتَٰبَ',
    title: 'Surah Al-Kahf (الكهف)',
    subtitle: 'Shines illuminating light between two Fridays and provides safety from trials.',
    buttonText: 'Read & Listen',
  },
  {
    id: 'surah-rahman',
    surahNumber: 55,
    surahName: 'Ar-Rahman',
    arabicName: 'الرحمن',
    totalAyahs: 78,
    badge: 'The Beneficent',
    badgeColor: '#dcfce7',
    badgeTextColor: '#15803d',
    icon: 'leaf',
    iconColor: '#16a34a',
    iconBg: '#f0fdf4',
    arabicText: 'فَبِأَىِّ ءَالَآءِ رَبِّكُمَا تُكَذِّبَانِ',
    title: 'Surah Ar-Rahman (الرحمن)',
    subtitle: 'Which of the favors of your Lord will you deny? Divine mercy and creations.',
    buttonText: 'Read & Listen',
  },
  {
    id: 'ayat-kursi',
    surahNumber: 2,
    surahName: 'Al-Baqarah',
    arabicName: 'البقرة',
    totalAyahs: 286,
    badge: 'Throne Verse',
    badgeColor: '#fae8ff',
    badgeTextColor: '#86198f',
    icon: 'star',
    iconColor: '#9333ea',
    iconBg: '#faf5ff',
    arabicText: 'ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ',
    title: 'Ayatul Kursi (آية الكرسي)',
    subtitle: 'The greatest ayah in the Quran for supreme protection, peace, and blessings.',
    buttonText: 'Read in Baqarah',
  },
];

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function QuranScreenComponent({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, meccan, medinan, bookmarked
  const [bookmarks, setBookmarks] = useState([]);
  const [lastRead, setLastRead] = useState(null);

  // Slider State
  const sliderRef = useRef(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

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
    loadSavedState();

    const unsubscribe = quranAudioService.subscribeStatus((status) => {
      if (status && typeof status === 'object') {
        setAudioStatus(status);
      }
    });

    // Auto-advance the slider every 5 seconds
    const sliderTimer = setInterval(() => {
      setCurrentSlideIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % QURAN_SLIDES.length;
        if (sliderRef.current) {
          sliderRef.current.scrollTo({
            x: nextIndex * SLIDE_WIDTH,
            animated: true,
          });
        }
        return nextIndex;
      });
    }, 5000);

    return () => {
      clearInterval(sliderTimer);
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const loadSavedState = async () => {
    try {
      const bKey = await AsyncStorage.getItem('quran_bookmarked_surahs');
      if (bKey) {
        const parsed = JSON.parse(bKey);
        if (Array.isArray(parsed)) setBookmarks(parsed);
      }

      const lrKey = await AsyncStorage.getItem('quran_last_read_surah');
      if (lrKey) {
        const parsed = JSON.parse(lrKey);
        if (parsed && typeof parsed === 'object') setLastRead(parsed);
      }
    } catch (_) {}
  };

  const toggleBookmark = async (surahNumber) => {
    const currentBookmarks = Array.isArray(bookmarks) ? bookmarks : [];
    let updated;
    if (currentBookmarks.includes(surahNumber)) {
      updated = currentBookmarks.filter((n) => n !== surahNumber);
    } else {
      updated = [...currentBookmarks, surahNumber];
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

  const handleOpenSlideSurah = (slide) => {
    navigation.navigate('SurahDetail', {
      surahNumber: slide.surahNumber,
      surahName: slide.surahName,
      arabicName: slide.arabicName,
      totalAyahs: slide.totalAyahs,
    });
  };

  const currentBookmarks = Array.isArray(bookmarks) ? bookmarks : [];
  const filteredSurahs = (SURAHS_LIST || []).filter((surah) => {
    if (selectedFilter === 'meccan' && surah.revelationType !== 'Meccan') return false;
    if (selectedFilter === 'medinan' && surah.revelationType !== 'Medinan') return false;
    if (selectedFilter === 'bookmarked' && !currentBookmarks.includes(surah.number)) return false;

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      const matchNumber = String(surah.number) === query;
      const matchEnglish = surah.englishName?.toLowerCase().includes(query);
      const matchTrans = surah.englishNameTranslation?.toLowerCase().includes(query);
      const matchArabic = surah.name?.includes(query);
      return matchNumber || matchEnglish || matchTrans || matchArabic;
    }

    return true;
  });

  const renderSurahItem = ({ item }) => {
    const audioUrl = getSurahAudioUrl(item.number);
    const isThisPlaying = audioStatus.url === audioUrl && audioStatus.isPlaying;
    const isThisBuffering = audioStatus.url === audioUrl && audioStatus.isBuffering;
    const isBookmarked = currentBookmarks.includes(item.number);

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

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Top Slider Card */}
      <View style={styles.sliderWrapper}>
        <ScrollView
          ref={sliderRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const contentOffsetX = e.nativeEvent.contentOffset.x;
            const currentIndex = Math.round(contentOffsetX / SLIDE_WIDTH);
            if (currentIndex !== currentSlideIndex && currentIndex >= 0 && currentIndex < QURAN_SLIDES.length) {
              setCurrentSlideIndex(currentIndex);
            }
          }}
          style={{ width: SLIDE_WIDTH }}
        >
          {QURAN_SLIDES.map((slide) => (
            <TouchableOpacity
              key={slide.id}
              style={[styles.slideCard, { width: SLIDE_WIDTH }]}
              activeOpacity={0.9}
              onPress={() => handleOpenSlideSurah(slide)}
            >
              <View style={styles.slideHeaderRow}>
                <View style={[styles.slideBadge, { backgroundColor: slide.badgeColor }]}>
                  <Text style={[styles.slideBadgeText, { color: slide.badgeTextColor }]}>
                    {slide.badge}
                  </Text>
                </View>
                <View style={[styles.slideIconWrap, { backgroundColor: slide.iconBg }]}>
                  <Ionicons name={slide.icon} size={18} color={slide.iconColor} />
                </View>
              </View>

              <Text style={styles.slideArabicText}>{slide.arabicText}</Text>
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideSubtitle} numberOfLines={2}>
                {slide.subtitle}
              </Text>

              <View style={styles.slideFooterRow}>
                <View style={styles.slideActionBtn}>
                  <Text style={styles.slideActionBtnText}>{slide.buttonText}</Text>
                  <Ionicons name="arrow-forward" size={14} color="#1b6b3c" style={{ marginLeft: 4 }} />
                </View>
                <Text style={styles.slideSurahMeta}>Surah {slide.surahNumber} • {slide.totalAyahs} Ayahs</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {QURAN_SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentSlideIndex && styles.activeDot,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Last Read Quick Jump Pill */}
      {!!(lastRead && lastRead.englishName) ? (
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
          <View style={styles.lastReadIconCircle}>
            <Ionicons name="time" size={14} color="#1b6b3c" />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.lastReadLabel}>CONTINUE READING</Text>
            <Text style={styles.lastReadText} numberOfLines={1}>
              Surah {lastRead.englishName} ({lastRead.arabicName})
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#1b6b3c" />
        </TouchableOpacity>
      ) : null}

      {/* Search Bar */}
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
          { key: 'all', label: 'All 114' },
          { key: 'meccan', label: 'Meccan' },
          { key: 'medinan', label: 'Medinan' },
          { key: 'bookmarked', label: `Saved (${currentBookmarks.length})` },
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
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Surahs List with Top Slider Header */}
      <FlatList
        data={filteredSurahs}
        keyExtractor={(item) => String(item.number)}
        renderItem={renderSurahItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[styles.listContent, audioStatus?.url ? { paddingBottom: 110 } : null]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No Surahs match "{searchQuery}"</Text>
          </View>
        }
      />

      {/* Floating Bottom Mini Player with Seek Slider */}
      {!!audioStatus?.url ? (
        <View style={styles.miniPlayer}>
          {/* Progress Seek Slider on top */}
          <View style={styles.miniPlayerSliderRow}>
            <Text style={styles.miniPlayerTimeText}>{formatTime(audioStatus.currentTime)}</Text>
            <View style={{ flex: 1, marginHorizontal: 8 }}>
              <CustomSlider
                value={audioStatus.currentTime || 0}
                minimumValue={0}
                maximumValue={audioStatus.duration > 0 ? audioStatus.duration : 100}
                onSlidingComplete={(val) => {
                  quranAudioService.seek(val);
                }}
                minimumTrackTintColor="#1b6b3c"
                maximumTrackTintColor="#e2e8f0"
                thumbTintColor="#1b6b3c"
                thumbSize={12}
                trackHeight={3}
                style={{ height: 16 }}
              />
            </View>
            <Text style={styles.miniPlayerTimeText}>{formatTime(audioStatus.duration)}</Text>
          </View>

          {/* Mini Player Body */}
          <View style={styles.miniPlayerBody}>
            <View style={styles.miniPlayerInfo}>
              <View style={styles.miniPlayerIcon}>
                <Ionicons name="musical-notes" size={18} color="#1b6b3c" />
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
                activeOpacity={0.7}
              >
                {audioStatus.isBuffering ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons
                    name={audioStatus.isPlaying ? 'pause' : 'play'}
                    size={18}
                    color="#fff"
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => quranAudioService.stop()}
                style={styles.miniCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#777" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function QuranScreen(props) {
  return (
    <ErrorBoundary title="Quran Screen Error">
      <QuranScreenComponent {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9f7' },
  headerContainer: { paddingBottom: 6 },

  // Top Slider Card (matching JamaitApp Home style)
  sliderWrapper: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    shadowColor: '#1b6b3c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e8efe9',
  },
  slideCard: {
    padding: 16,
    backgroundColor: '#ffffff',
  },
  slideHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  slideBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  slideBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  slideIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideArabicText: {
    fontSize: 19,
    color: '#0a3d1f',
    fontWeight: 'bold',
    textAlign: 'right',
    marginVertical: 4,
    lineHeight: 30,
  },
  slideTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1b6b3c',
    marginTop: 2,
  },
  slideSubtitle: {
    fontSize: 12,
    color: '#555',
    marginTop: 3,
    lineHeight: 18,
  },
  slideFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f5f1',
  },
  slideActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eaf5ee',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  slideActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1b6b3c',
  },
  slideSurahMeta: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 10,
    paddingTop: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d8e4db',
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: '#1b6b3c',
    width: 16,
  },

  // Last Read Pill
  lastReadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cce2d4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
  lastReadIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eaf4ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lastReadLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#888',
    letterSpacing: 0.5,
  },
  lastReadText: {
    color: '#0a3d1f',
    fontSize: 13,
    fontWeight: '700',
  },

  // Search Section
  searchSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
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

  // Filters
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce5df',
  },
  filterChipActive: { backgroundColor: '#1b6b3c', borderColor: '#1b6b3c' },
  filterChipText: { fontSize: 12, color: '#555', fontWeight: '600' },
  filterChipTextActive: { color: '#ffffff' },

  // Surah List
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
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
  emptyContainer: { alignItems: 'center', marginTop: 60, paddingBottom: 40 },
  emptyText: { marginTop: 12, color: '#888', fontSize: 15 },

  // Floating Mini Player with Slider
  miniPlayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 2,
    borderTopColor: '#1b6b3c',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  miniPlayerSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 2,
  },
  miniPlayerTimeText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
    width: 32,
    textAlign: 'center',
  },
  miniPlayerBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  miniPlayerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  miniPlayerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eaf4ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniPlayerTitle: { fontSize: 13, fontWeight: '700', color: '#0a3d1f' },
  miniPlayerSubtitle: { fontSize: 11, color: '#777', marginTop: 1 },
  miniPlayerControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1b6b3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCloseBtn: { padding: 6 },
});
