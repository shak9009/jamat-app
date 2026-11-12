import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DUA_CATEGORIES, DUAS_LIST } from '../../data/duaData';
import { quranAudioService } from '../../services/quranAudioService';
import Toast from 'react-native-toast-message';
import ErrorBoundary from '../../components/ErrorBoundary';

function DuaScreenComponent({ navigation }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tasbihCounts, setTasbihCounts] = useState({});
  const [favorites, setFavorites] = useState([]);

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

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const loadSavedState = async () => {
    try {
      const favs = await AsyncStorage.getItem('dua_favorite_ids');
      if (favs) {
        const parsed = JSON.parse(favs);
        if (Array.isArray(parsed)) setFavorites(parsed);
      }

      const savedCounts = await AsyncStorage.getItem('dua_tasbih_counts');
      if (savedCounts) {
        const parsedCounts = JSON.parse(savedCounts);
        if (parsedCounts && typeof parsedCounts === 'object') setTasbihCounts(parsedCounts);
      }
    } catch (_) {}
  };

  const toggleFavorite = async (duaId) => {
    const currentFavs = Array.isArray(favorites) ? favorites : [];
    let updated;
    if (currentFavs.includes(duaId)) {
      updated = currentFavs.filter((id) => id !== duaId);
    } else {
      updated = [...currentFavs, duaId];
    }
    setFavorites(updated);
    try {
      await AsyncStorage.setItem('dua_favorite_ids', JSON.stringify(updated));
    } catch (_) {}
  };

  const handleTasbihIncrement = async (dua) => {
    const currentCounts = (tasbihCounts && typeof tasbihCounts === 'object') ? tasbihCounts : {};
    const current = currentCounts[dua.id] || 0;
    const target = dua.recommendedCount || 1;
    const next = current >= target ? 1 : current + 1;

    const updated = { ...currentCounts, [dua.id]: next };
    setTasbihCounts(updated);

    if (next === target) {
      Toast.show({
        type: 'success',
        text1: 'MashaAllah! ✨',
        text2: `Completed ${target} recitation${target > 1 ? 's' : ''} of ${dua.title}`,
        position: 'top',
        visibilityTime: 2000,
      });
    }

    try {
      await AsyncStorage.setItem('dua_tasbih_counts', JSON.stringify(updated));
    } catch (_) {}
  };

  const handleTasbihReset = async (duaId) => {
    const currentCounts = (tasbihCounts && typeof tasbihCounts === 'object') ? tasbihCounts : {};
    const updated = { ...currentCounts, [duaId]: 0 };
    setTasbihCounts(updated);
    try {
      await AsyncStorage.setItem('dua_tasbih_counts', JSON.stringify(updated));
    } catch (_) {}
  };

  const handleToggleAudio = async (dua) => {
    if (!dua.audioUrl) return;

    if (audioStatus.url === dua.audioUrl && audioStatus.isPlaying) {
      await quranAudioService.pause();
    } else if (audioStatus.url === dua.audioUrl && !audioStatus.isPlaying) {
      await quranAudioService.resume();
    } else {
      await quranAudioService.play(dua.audioUrl, {
        duaId: dua.id,
        title: dua.title,
        arabicTitle: dua.arabicTitle,
        reciter: 'Sheikh Mishary Rashid Alafasy',
      });
    }
  };

  const handleShareDua = async (dua) => {
    try {
      const message = `${dua.arabicTitle}\n\n${dua.arabic}\n\nTransliteration:\n${dua.transliteration}\n\nTranslation:\n"${dua.translation}"\n\nReference: ${dua.reference}\n\n— Jamait App`;
      await Share.share({ message });
    } catch (_) {}
  };

  const handleCopyDua = async (dua) => {
    const textToCopy = `${dua.arabic}\n\n"${dua.translation}"\n(${dua.reference})`;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      }
    } catch (_) {}

    Toast.show({
      type: 'success',
      text1: 'Dua Copied 📋',
      text2: 'Arabic text & translation copied.',
      position: 'top',
      visibilityTime: 1800,
    });
  };

  // Filter list
  const currentFavs = Array.isArray(favorites) ? favorites : [];
  const filteredDuas = (DUAS_LIST || []).filter((dua) => {
    // Category filter
    if (selectedCategory !== 'all' && selectedCategory !== 'favorites') {
      if (dua.category !== selectedCategory) return false;
    } else if (selectedCategory === 'favorites') {
      if (!currentFavs.includes(dua.id)) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchTitle = dua.title?.toLowerCase().includes(q);
      const matchArabicTitle = dua.arabicTitle?.includes(q);
      const matchArabic = dua.arabic?.includes(q);
      const matchTrans = dua.translation?.toLowerCase().includes(q);
      const matchRef = dua.reference?.toLowerCase().includes(q);
      return matchTitle || matchArabicTitle || matchArabic || matchTrans || matchRef;
    }

    return true;
  });

  const currentCounts = (tasbihCounts && typeof tasbihCounts === 'object') ? tasbihCounts : {};
  const renderDuaItem = ({ item }) => {
    const isPlaying = audioStatus.url === item.audioUrl && audioStatus.isPlaying;
    const isBuffering = audioStatus.url === item.audioUrl && audioStatus.isBuffering;
    const isFav = currentFavs.includes(item.id);
    const count = currentCounts[item.id] || 0;
    const target = item.recommendedCount || 1;
    const isCompleted = count >= target && count > 0;

    return (
      <View style={[styles.duaCard, isPlaying && styles.duaCardActive]}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.duaTitle}>{item.title}</Text>
            <Text style={styles.duaArabicTitle}>{item.arabicTitle}</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => toggleFavorite(item.id)}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isFav ? 'heart' : 'heart-outline'}
                size={22}
                color={isFav ? '#e74c3c' : '#7f8c8d'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleShareDua(item)}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="share-social-outline" size={20} color="#555" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleCopyDua(item)}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="copy-outline" size={19} color="#555" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Arabic Text Box */}
        <View style={styles.arabicBox}>
          <Text style={styles.arabicText}>{item.arabic}</Text>
        </View>

        {/* Transliteration */}
        {item.transliteration ? (
          <View style={styles.transliterationBox}>
            <Text style={styles.transliterationLabel}>Transliteration:</Text>
            <Text style={styles.transliterationText}>{item.transliteration}</Text>
          </View>
        ) : null}

        {/* Translation */}
        <View style={styles.translationBox}>
          <Text style={styles.translationText}>"{item.translation}"</Text>
        </View>

        {/* Hadith / Quran Reference */}
        {item.reference ? (
          <View style={styles.referenceRow}>
            <Ionicons name="book-outline" size={13} color="#0a3d1f" />
            <Text style={styles.referenceText}>{item.reference}</Text>
          </View>
        ) : null}

        {/* Bottom Interactive Bar: Voice Audio & Tasbih Counter */}
        <View style={styles.interactiveBar}>
          {/* Audio Play Button */}
          <TouchableOpacity
            style={[
              styles.audioButton,
              isPlaying && styles.audioButtonPlaying,
              !item.audioUrl && styles.audioButtonDisabled,
            ]}
            onPress={() => handleToggleAudio(item)}
            activeOpacity={0.8}
            disabled={!item.audioUrl}
          >
            {isBuffering ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'volume-high'}
                size={18}
                color={isPlaying ? '#ffffff' : '#0a3d1f'}
              />
            )}
            <Text
              style={[
                styles.audioButtonText,
                isPlaying && styles.audioButtonTextPlaying,
              ]}
            >
              {isBuffering ? 'Loading...' : isPlaying ? 'Pause Voice' : 'Listen Voice'}
            </Text>
          </TouchableOpacity>

          {/* Tasbih Counter Button */}
          <View style={styles.tasbihContainer}>
            <TouchableOpacity
              style={[
                styles.tasbihBtn,
                isCompleted && styles.tasbihBtnCompleted,
              ]}
              onPress={() => handleTasbihIncrement(item)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isCompleted ? 'checkmark-circle' : 'finger-print-outline'}
                size={16}
                color={isCompleted ? '#ffffff' : '#0a3d1f'}
              />
              <Text
                style={[
                  styles.tasbihBtnText,
                  isCompleted && styles.tasbihBtnTextCompleted,
                ]}
              >
                {isCompleted
                  ? `Completed (${target}/${target})`
                  : `Recite (${count}/${target})`}
              </Text>
            </TouchableOpacity>

            {count > 0 && (
              <TouchableOpacity
                onPress={() => handleTasbihReset(item.id)}
                style={styles.resetBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="refresh-outline" size={16} color="#7f8c8d" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Search Bar */}
      <View style={styles.searchHeader}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#7f8c8d" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Duas (e.g. Throne, Istighfar, Sleep)..."
            placeholderTextColor="#95a5a6"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#7f8c8d" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Horizontal Filter */}
      <View style={styles.categoryBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            ...DUA_CATEGORIES,
            { id: 'favorites', label: 'Favorites', icon: 'heart-outline' },
          ]}
          keyExtractor={(cat) => cat.id}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item.id;
            return (
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  isSelected && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(item.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.icon || 'star-outline'}
                  size={15}
                  color={isSelected ? '#ffffff' : '#0a3d1f'}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected && styles.categoryChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Dua List */}
      <FlatList
        data={filteredDuas}
        keyExtractor={(item) => item.id}
        renderItem={renderDuaItem}
        contentContainerStyle={[
          styles.listContent,
          audioStatus?.isPlaying ? { paddingBottom: 110 } : null,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color="#bdc3c7" />
            <Text style={styles.emptyTitle}>No Duas Found</Text>
            <Text style={styles.emptySubtitle}>
              Try searching with another keyword or selecting "All Duas".
            </Text>
          </View>
        }
      />

      {/* Floating Bottom Audio Player (if playing/buffering) */}
      {!!audioStatus?.url ? (
        <View style={styles.floatingPlayer}>
          <View style={styles.playerInfo}>
            <Ionicons name="musical-notes" size={20} color="#d4af37" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.playerTitle} numberOfLines={1}>
                {audioStatus.metadata?.title || 'Playing Voice Recitation'}
              </Text>
              <Text style={styles.playerSubtitle} numberOfLines={1}>
                {audioStatus.metadata?.arabicTitle || 'Sheikh Mishary Rashid Alafasy'}
              </Text>
            </View>
          </View>

          <View style={styles.playerControls}>
            <TouchableOpacity
              onPress={() => {
                if (audioStatus.isPlaying) {
                  quranAudioService.pause();
                } else {
                  quranAudioService.resume();
                }
              }}
              style={styles.playerPlayBtn}
            >
              <Ionicons
                name={audioStatus.isPlaying ? 'pause' : 'play'}
                size={20}
                color="#ffffff"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => quranAudioService.stop()}
              style={styles.playerCloseBtn}
            >
              <Ionicons name="close" size={20} color="#7f8c8d" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function DuaScreen(props) {
  return (
    <ErrorBoundary title="Dua Screen Error">
      <DuaScreenComponent {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7f6',
  },
  searchHeader: {
    backgroundColor: '#0a3d1f',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#2c3e50',
  },
  categoryBar: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  categoryList: {
    paddingHorizontal: 14,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f0f5f1',
    gap: 6,
    borderWidth: 1,
    borderColor: '#e0ece2',
  },
  categoryChipActive: {
    backgroundColor: '#0a3d1f',
    borderColor: '#0a3d1f',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0a3d1f',
  },
  categoryChipTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: 14,
    paddingBottom: 50,
  },
  duaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#e8ece9',
  },
  duaCardActive: {
    borderColor: '#0a3d1f',
    borderWidth: 1.5,
    backgroundColor: '#fafefb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
    marginRight: 10,
  },
  duaTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a252f',
    marginBottom: 2,
  },
  duaArabicTitle: {
    fontSize: 14,
    color: '#0a3d1f',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 4,
  },
  arabicBox: {
    backgroundColor: '#fbfcf9',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f0ebd8',
    marginBottom: 10,
  },
  arabicText: {
    fontSize: 22,
    lineHeight: 40,
    textAlign: 'right',
    color: '#111827',
    fontWeight: '600',
  },
  transliterationBox: {
    marginBottom: 8,
  },
  transliterationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7f8c8d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  transliterationText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#495057',
    lineHeight: 19,
  },
  translationBox: {
    marginBottom: 10,
  },
  translationText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 21,
    fontWeight: '400',
  },
  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eaf5ee',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 14,
  },
  referenceText: {
    fontSize: 11.5,
    color: '#0a3d1f',
    fontWeight: '600',
  },
  interactiveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f3f2',
    paddingTop: 12,
    gap: 10,
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eaf5ee',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#cce5d6',
  },
  audioButtonPlaying: {
    backgroundColor: '#0a3d1f',
    borderColor: '#0a3d1f',
  },
  audioButtonDisabled: {
    opacity: 0.5,
  },
  audioButtonText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0a3d1f',
  },
  audioButtonTextPlaying: {
    color: '#ffffff',
  },
  tasbihContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tasbihBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f9f7',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#d2e4d6',
  },
  tasbihBtnCompleted: {
    backgroundColor: '#1b6b3c',
    borderColor: '#1b6b3c',
  },
  tasbihBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0a3d1f',
  },
  tasbihBtnTextCompleted: {
    color: '#ffffff',
  },
  resetBtn: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#34495e',
    marginTop: 14,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 18,
  },
  floatingPlayer: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    backgroundColor: '#0a3d1f',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playerTitle: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  playerSubtitle: {
    color: '#cce5d6',
    fontSize: 11.5,
    marginTop: 1,
  },
  playerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1b6b3c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerCloseBtn: {
    padding: 6,
  },
});

