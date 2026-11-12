import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchSurahDetails, getSurahAudioUrl } from '../../data/quranData';
import { quranAudioService } from '../../services/quranAudioService';
import Toast from 'react-native-toast-message';
import ErrorBoundary from '../../components/ErrorBoundary';
import CustomSlider from '../../components/CustomSlider';

function SurahDetailScreenComponent({ route, navigation }) {
  const surahNumber = route?.params?.surahNumber || 1;
  const surahName = route?.params?.surahName || 'Al-Fatihah';
  const arabicName = route?.params?.arabicName || 'الفَاتِحَة';

  const [surahData, setSurahData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [arabicFontSize, setArabicFontSize] = useState(24);
  const [playingAyahNumber, setPlayingAyahNumber] = useState(null);

  // Audio player status
  const [audioStatus, setAudioStatus] = useState({
    url: null,
    isPlaying: false,
    isBuffering: false,
    currentTime: 0,
    duration: 0,
  });

  const fullSurahAudioUrl = getSurahAudioUrl(surahNumber);
  const isFullSurahPlaying = audioStatus.url === fullSurahAudioUrl && audioStatus.isPlaying;
  const isFullSurahBuffering = audioStatus.url === fullSurahAudioUrl && audioStatus.isBuffering;

  useEffect(() => {
    loadSurah();
    saveLastRead();
    loadSavedFontSize();

    const unsubscribe = quranAudioService.subscribeStatus((status) => {
      if (status && typeof status === 'object') {
        setAudioStatus(status);
        if (status.isEnded) {
          setPlayingAyahNumber(null);
        }
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [surahNumber]);

  const loadSavedFontSize = async () => {
    try {
      const saved = await AsyncStorage.getItem('quran_arabic_font_size');
      if (saved) {
        const num = parseInt(saved, 10);
        if (num >= 18 && num <= 40) {
          setArabicFontSize(num);
        }
      }
    } catch (_) {}
  };

  const updateFontSize = async (size) => {
    const rounded = Math.round(size);
    setArabicFontSize(rounded);
    try {
      await AsyncStorage.setItem('quran_arabic_font_size', String(rounded));
    } catch (_) {}
  };

  const saveLastRead = async () => {
    try {
      await AsyncStorage.setItem(
        'quran_last_read_surah',
        JSON.stringify({
          number: surahNumber,
          englishName: surahName,
          arabicName,
          savedAt: new Date().toISOString(),
        })
      );
    } catch (_) {}
  };

  const loadSurah = async () => {
    setLoading(true);
    try {
      const data = await fetchSurahDetails(surahNumber);
      setSurahData(data);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: 'Could not load Surah text. Please check your internet connection.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFullSurahAudio = async () => {
    if (isFullSurahPlaying) {
      await quranAudioService.pause();
    } else if (audioStatus.url === fullSurahAudioUrl && !audioStatus.isPlaying) {
      await quranAudioService.resume();
    } else {
      setPlayingAyahNumber(null);
      await quranAudioService.play(fullSurahAudioUrl, {
        surahNumber,
        surahName,
        arabicName,
        reciter: 'Sheikh Mishary Rashid Alafasy',
      });
    }
  };

  const handleSeekRelative = (secondsOffset) => {
    const cur = audioStatus.currentTime || 0;
    const dur = audioStatus.duration || 0;
    const target = Math.max(0, Math.min(dur, cur + secondsOffset));
    quranAudioService.seek(target);
  };

  const handlePlayAyahAudio = async (ayah) => {
    const ayahAudioUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${ayah.number}.mp3`;

    if (audioStatus.url === ayahAudioUrl && audioStatus.isPlaying) {
      await quranAudioService.pause();
      setPlayingAyahNumber(null);
    } else {
      setPlayingAyahNumber(ayah.numberInSurah);
      await quranAudioService.play(ayahAudioUrl, {
        surahNumber,
        ayahNumber: ayah.numberInSurah,
      });
    }
  };

  const handleCopyAyah = async (ayah) => {
    const textToCopy = `${ayah.text}\n\n"${ayah.translation}"\n(Surah ${surahName} ${surahNumber}:${ayah.numberInSurah})`;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      }
    } catch (_) {}
    Toast.show({
      type: 'success',
      text1: 'Copied to Clipboard 📋',
      text2: `Ayah ${ayah.numberInSurah} copied successfully.`,
      position: 'top',
    });
  };

  const handleShareAyah = async (ayah) => {
    try {
      await Share.share({
        message: `${ayah.text}\n\n"${ayah.translation}"\n\n— Surah ${surahName} [${surahNumber}:${ayah.numberInSurah}]\nJamait App`,
      });
    } catch (_) {}
  };

  const formatSeconds = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const renderAyahItem = ({ item }) => {
    const isThisAyahPlaying = playingAyahNumber === item.numberInSurah && audioStatus.isPlaying;

    return (
      <View style={[styles.ayahCard, isThisAyahPlaying && styles.ayahCardActive]}>
        {/* Ayah Header Bar */}
        <View style={styles.ayahHeaderRow}>
          <View style={styles.ayahBadge}>
            <Text style={styles.ayahBadgeText}>{item.numberInSurah}</Text>
          </View>

          <View style={styles.ayahActionIcons}>
            {/* Play Ayah Audio */}
            {item.number ? (
              <TouchableOpacity
                onPress={() => handlePlayAyahAudio(item)}
                style={styles.ayahIconBtn}
                activeOpacity={0.6}
              >
                <Ionicons
                  name={isThisAyahPlaying ? 'pause-circle' : 'volume-high-outline'}
                  size={20}
                  color={isThisAyahPlaying ? '#1b6b3c' : '#555'}
                />
              </TouchableOpacity>
            ) : null}

            {/* Copy */}
            <TouchableOpacity
              onPress={() => handleCopyAyah(item)}
              style={styles.ayahIconBtn}
              activeOpacity={0.6}
            >
              <Ionicons name="copy-outline" size={18} color="#555" />
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity
              onPress={() => handleShareAyah(item)}
              style={styles.ayahIconBtn}
              activeOpacity={0.6}
            >
              <Ionicons name="share-social-outline" size={18} color="#555" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Arabic Ayah Text */}
        <Text style={[styles.arabicText, { fontSize: arabicFontSize }]}>
          {item.text} ۝
        </Text>

        {/* English Translation */}
        <Text style={styles.translationText}>{item.translation}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Audio Player Banner with Progress Seek Slider */}
      <View style={styles.topPlayerBar}>
        <View style={styles.playerTopRow}>
          <View style={styles.playerMeta}>
            <Text style={styles.playerTitle} numberOfLines={1}>
              {surahName} • Mishary Alafasy
            </Text>
            <Text style={styles.playerSubtitle}>
              {audioStatus.url === fullSurahAudioUrl
                ? (isFullSurahPlaying ? 'Playing Surah recitation' : 'Audio paused')
                : 'Full Surah Voice Audio'}
            </Text>
          </View>

          <View style={styles.audioControlsRow}>
            {/* -10s Rewind */}
            <TouchableOpacity
              onPress={() => handleSeekRelative(-10)}
              style={styles.seekStepBtn}
              activeOpacity={0.7}
              disabled={audioStatus.url !== fullSurahAudioUrl}
            >
              <Ionicons
                name="play-back"
                size={16}
                color={audioStatus.url === fullSurahAudioUrl ? '#fff' : '#6b9278'}
              />
            </TouchableOpacity>

            {/* Main Play/Pause Button */}
            <TouchableOpacity
              onPress={handleToggleFullSurahAudio}
              style={[styles.mainPlayBtn, isFullSurahPlaying && styles.mainPlayBtnActive]}
              activeOpacity={0.8}
            >
              {isFullSurahBuffering ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name={isFullSurahPlaying ? 'pause' : 'play'}
                  size={20}
                  color="#ffffff"
                />
              )}
            </TouchableOpacity>

            {/* +10s Forward */}
            <TouchableOpacity
              onPress={() => handleSeekRelative(10)}
              style={styles.seekStepBtn}
              activeOpacity={0.7}
              disabled={audioStatus.url !== fullSurahAudioUrl}
            >
              <Ionicons
                name="play-forward"
                size={16}
                color={audioStatus.url === fullSurahAudioUrl ? '#fff' : '#6b9278'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Audio Seek Slider */}
        <View style={styles.seekSliderWrapper}>
          <CustomSlider
            value={audioStatus.currentTime || 0}
            minimumValue={0}
            maximumValue={audioStatus.duration > 0 ? audioStatus.duration : 100}
            onSlidingComplete={(val) => {
              quranAudioService.seek(val);
            }}
            minimumTrackTintColor="#d4af37"
            maximumTrackTintColor="rgba(255, 255, 255, 0.25)"
            thumbTintColor="#ffd700"
            thumbSize={14}
            trackHeight={4}
            disabled={audioStatus.url !== fullSurahAudioUrl}
            style={{ height: 20 }}
          />
          <View style={styles.timeLabelsRow}>
            <Text style={styles.timeLabelText}>
              {formatSeconds(audioStatus.currentTime)}
            </Text>
            <Text style={styles.timeLabelText}>
              {formatSeconds(audioStatus.duration)}
            </Text>
          </View>
        </View>
      </View>

      {/* Surah Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1b6b3c" />
          <Text style={{ marginTop: 12, color: '#555' }}>Loading Surah {surahName}...</Text>
        </View>
      ) : (
        <FlatList
          data={surahData?.ayahs || []}
          keyExtractor={(item) => String(item.numberInSurah)}
          renderItem={renderAyahItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.surahHeader}>
              <Text style={styles.surahHeaderArabic}>{arabicName}</Text>
              <Text style={styles.surahHeaderEnglish}>
                {surahData?.englishNameTranslation || ''} • {surahData?.revelationType || ''} • {surahData?.numberOfAyahs || ''} Ayahs
              </Text>

              {/* Bismillah Header (except Surah At-Tawbah 9) */}
              {Number(surahNumber) !== 9 && (
                <View style={styles.bismillahBox}>
                  <Text style={styles.bismillahText}>
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                  </Text>
                </View>
              )}

              {/* Arabic Font Size Slider Card */}
              <View style={styles.fontSizeCard}>
                <View style={styles.fontSizeHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="text-outline" size={16} color="#1b6b3c" />
                    <Text style={styles.fontSizeTitle}>Arabic Text Size</Text>
                  </View>
                  <View style={styles.fontSizeBadge}>
                    <Text style={styles.fontSizeBadgeText}>{arabicFontSize}px</Text>
                  </View>
                </View>

                <View style={styles.fontSizeSliderRow}>
                  <TouchableOpacity
                    style={styles.fontStepperBtn}
                    onPress={() => updateFontSize(Math.max(18, arabicFontSize - 2))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.fontStepperText}>A-</Text>
                  </TouchableOpacity>

                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <CustomSlider
                      value={arabicFontSize}
                      minimumValue={18}
                      maximumValue={38}
                      step={2}
                      onValueChange={(val) => setArabicFontSize(Math.round(val))}
                      onSlidingComplete={updateFontSize}
                      minimumTrackTintColor="#1b6b3c"
                      maximumTrackTintColor="#dce5df"
                      thumbTintColor="#1b6b3c"
                      thumbSize={16}
                      trackHeight={4}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.fontStepperBtn}
                    onPress={() => updateFontSize(Math.min(38, arabicFontSize + 2))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.fontStepperText}>A+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          }
        />
      )}
    </View>
  );
}

export default function SurahDetailScreen(props) {
  return (
    <ErrorBoundary title="Surah Detail Error">
      <SurahDetailScreenComponent {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f4' },

  // Top Audio Player Bar
  topPlayerBar: {
    backgroundColor: '#0a3d1f',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1b6b3c',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  playerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerMeta: { flex: 1, marginRight: 10 },
  playerTitle: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  playerSubtitle: { fontSize: 11, color: '#c8e6c9', marginTop: 2 },
  audioControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seekStepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainPlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1b6b3c',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d4af37',
  },
  mainPlayBtnActive: { backgroundColor: '#d4af37', borderColor: '#ffffff' },

  // Audio Seek Slider
  seekSliderWrapper: {
    marginTop: 6,
  },
  timeLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  timeLabelText: {
    fontSize: 10,
    color: '#a3c9b1',
    fontWeight: '600',
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 50 },

  surahHeader: {
    alignItems: 'center',
    paddingVertical: 18,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0ebd7',
  },
  surahHeaderArabic: { fontSize: 28, fontWeight: 'bold', color: '#0a3d1f', marginBottom: 4 },
  surahHeaderEnglish: { fontSize: 13, color: '#666' },

  bismillahBox: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#e8f5e9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  bismillahText: { fontSize: 22, color: '#0a3d1f', fontWeight: 'bold', textAlign: 'center' },

  // Font Size Slider Card
  fontSizeCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2ece4',
  },
  fontSizeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fontSizeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0a3d1f',
    marginLeft: 6,
  },
  fontSizeBadge: {
    backgroundColor: '#eaf4ee',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  fontSizeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1b6b3c',
  },
  fontSizeSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fontStepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0f5f2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dce5df',
  },
  fontStepperText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1b6b3c',
  },

  ayahCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5ece7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  ayahCardActive: { borderColor: '#1b6b3c', backgroundColor: '#f9fdfa' },
  ayahHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f4f1',
  },
  ayahBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  ayahBadgeText: { fontSize: 12, fontWeight: '800', color: '#1b6b3c' },
  ayahActionIcons: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ayahIconBtn: { padding: 4 },

  arabicText: {
    textAlign: 'right',
    color: '#0a3d1f',
    lineHeight: 46,
    fontWeight: '600',
    marginBottom: 12,
    fontFamily: 'serif',
  },
  translationText: {
    fontSize: 14,
    color: '#444444',
    lineHeight: 22,
  },
});
