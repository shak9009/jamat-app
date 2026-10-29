import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  isAzanAudioPlaying,
  getAzanRemainingSeconds,
  subscribeAzanState,
  stopAzanSound,
  AZAN_DURATION_SECONDS,
} from '../services/AzanAlertService';
import Toast from 'react-native-toast-message';

export default function GlobalAzanFloatingBanner() {
  const [isPlaying, setIsPlaying] = useState(isAzanAudioPlaying());
  const [remainingSeconds, setRemainingSeconds] = useState(getAzanRemainingSeconds() || AZAN_DURATION_SECONDS);

  useEffect(() => {
    const unsub = subscribeAzanState(({ isPlaying, remainingSeconds: secs }) => {
      setIsPlaying(isPlaying);
      if (typeof secs === 'number') {
        setRemainingSeconds(secs);
      }
    });
    return unsub;
  }, []);

  const handleStop = async () => {
    await stopAzanSound();
    Toast.show({
      type: 'info',
      text1: 'Azaan Stopped',
      text2: 'Azaan voice playback silenced.',
      position: 'top',
    });
  };

  if (!isPlaying) {
    return null;
  }

  return (
    <View style={styles.floatingContainer} pointerEvents="box-none">
      <View style={styles.bannerCard}>
        <View style={styles.leftSection}>
          <View style={styles.iconCircle}>
            <Ionicons name="volume-high" size={22} color="#fff" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Azaan Playing...</Text>
            <Text style={styles.subtitle}>
              Auto-stops in {remainingSeconds}s
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.stopButton}
          onPress={handleStop}
          activeOpacity={0.8}
        >
          <Ionicons name="stop-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.stopButtonText}>TURN OFF</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 20,
    left: 16,
    right: 16,
    zIndex: 99999,
    elevation: 99999,
    alignItems: 'center',
  },
  bannerCard: {
    width: '100%',
    backgroundColor: '#0a3d1f',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#4ade80',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1b6b3c',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
