import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Share,
  Clipboard,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchSurahDetails, getSurahAudioUrl } from '../../data/quranData';
import { quranAudioService } from '../../services/quranAudioService';
import Toast from 'react-native-toast-message';

export default function SurahDetailScreen({ route, navigation }) {
  const { surahNumber, surahName, arabicName } = route.params;

  const [surahData, setSurahData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [arabicFontSize, setArabicFontSize] = useState(24); // 20, 24, 28, 32
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
    navigation.setOptions({
      title: `Surah ${surahName} (${arabicName})`,
      headerStyle: { backgroundColor: '#0a3d1f' },
      headerTintColor: '#ffffff',
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Font Size Toggle */}
          <TouchableOpacity
            onPress={() => {
              setArabicFontSize((prev) => (prev >= 32 ? 20 : prev + 4));
            }}
            style={styles.headerBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.headerBtnText}>A±</Text>
          </TouchableOpacity>
        </View>
      ),
    });

    loadSurah();
    saveLastRead();

    const unsubscribe = quranAudioService.subscribeStatus((status) => {
      setAudioStatus(status);
      if (status.isEnded) {
        setPlayingAyahNumber(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [surahNumber]);

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

  const handlePlayAyahAudio = async (ayah) => {
    // High quality ayah audio from Islamic Network CDN
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
      if (Clipboard && typeof Clipboard.setString === 'function') {
        Clipboard.setString(textToCopy);
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
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
      <StatusBar barStyle="light-content" backgroundColor="#0a3d1f" />

      {/* Top Audio Player Banner */}
      <View style={styles.topPlayerBar}>
        <View style={styles.playerMeta}>
          <Text style={styles.playerTitle} numberOfLines={1}>
            {surahName} • Recitation by Mishary Alafasy
          </Text>
          <Text style={styles.playerTime}>
            {audioStatus.url === fullSurahAudioUrl
              ? `${formatSeconds(audioStatus.currentTime)} / ${formatSeconds(audioStatus.duration)}`
              : 'Full Surah Voice Audio'}
          </Text>
        </View>

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
              size={22}
              color="#ffffff"
            />
          )}
        </TouchableOpacity>
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
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f4' },
  headerBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  topPlayerBar: {
    backgroundColor: '#0a3d1f',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1b6b3c',
  },
  playerMeta: { flex: 1, marginRight: 14 },
  playerTitle: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  playerTime: { fontSize: 11, color: '#c8e6c9', marginTop: 2 },
  mainPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1b6b3c',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d4af37',
  },
  mainPlayBtnActive: { backgroundColor: '#d4af37', borderColor: '#ffffff' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 50 },

  surahHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0ebd7',
  },
  surahHeaderArabic: { fontSize: 28, fontWeight: 'bold', color: '#0a3d1f', marginBottom: 4 },
  surahHeaderEnglish: { fontSize: 13, color: '#666' },

  bismillahBox: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#e8f5e9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  bismillahText: { fontSize: 22, color: '#0a3d1f', fontWeight: 'bold', textAlign: 'center' },

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
