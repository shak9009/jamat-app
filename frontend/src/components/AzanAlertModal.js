import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  stopAzanSound,
  playAzanSound,
  isAzanAudioPlaying,
  getAzanRemainingSeconds,
  subscribeAzanState,
  getAzanAlertEnabled,
  setAzanAlertEnabled,
  getAzanAlertOffset,
  setAzanAlertOffset,
  AZAN_DURATION_SECONDS,
} from '../services/AzanAlertService';
import Toast from 'react-native-toast-message';

/**
 * Active Azan Alert Modal (triggers with sound)
 */
export function AzanAlertPopup({ visible, alertData, onClose }) {
  const [isPlaying, setIsPlaying] = useState(isAzanAudioPlaying());
  const [remainingSeconds, setRemainingSeconds] = useState(getAzanRemainingSeconds() || AZAN_DURATION_SECONDS);

  useEffect(() => {
    const unsubscribe = subscribeAzanState(({ isPlaying, remainingSeconds: secs }) => {
      setIsPlaying(isPlaying);
      if (typeof secs === 'number') {
        setRemainingSeconds(secs);
      }
    });
    return unsubscribe;
  }, []);

  const handleStop = async () => {
    await stopAzanSound();
    Toast.show({
      type: 'info',
      text1: 'Azaan Turned Off',
      text2: 'Alert and voice stopped.',
      position: 'top',
    });
    if (onClose) onClose();
  };

  if (!visible || !alertData) return null;

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={handleStop}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name={isPlaying ? "volume-high" : "volume-mute"} size={38} color="#1b6b3c" />
          </View>

          <Text style={styles.arabicText}>حَيَّ عَلَى الصَّلَاةِ</Text>
          <Text style={styles.title}>Azaan Alert!</Text>

          <View style={styles.prayerBadge}>
            <Text style={styles.prayerName}>{alertData.prayerName}</Text>
          </View>

          <Text style={styles.timingMessage}>
            {alertData.isExactTime
              ? 'Time for Azaan now'
              : `Azaan in ${alertData.offsetMinutes} minute(s)`}
          </Text>

          <View style={styles.masjidBox}>
            <Ionicons name="moon" size={16} color="#1b6b3c" style={{ marginRight: 6 }} />
            <Text style={styles.masjidText} numberOfLines={2}>
              {alertData.masjidName} ({alertData.timeStr})
            </Text>
          </View>

          {isPlaying && (
            <View style={styles.playingBox}>
              <View style={styles.playingIndicator}>
                <ActivityIndicator size="small" color="#1b6b3c" style={{ marginRight: 6 }} />
                <Text style={styles.playingText}>Playing Azaan voice ({remainingSeconds}s)...</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.max(5, (remainingSeconds / AZAN_DURATION_SECONDS) * 100)}%` }]} />
              </View>
            </View>
          )}

          {/* Turn Off / Stop Button */}
          <TouchableOpacity style={[styles.stopButton, !isPlaying && styles.dismissButton]} onPress={handleStop} activeOpacity={0.85}>
            <Ionicons name={isPlaying ? "stop-circle" : "checkmark-circle"} size={24} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.stopButtonText}>
              {isPlaying ? `Turn Off Azaan (${remainingSeconds}s)` : 'Dismiss Alert'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Settings Modal for Azan Alert configuration (ON/OFF, 2 min vs 5 min, Test Voice)
 */
export function AzanSettingsModal({ visible, onClose }) {
  const [enabled, setEnabled] = useState(true);
  const [offset, setOffset] = useState(2);
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  const [testRemainingSeconds, setTestRemainingSeconds] = useState(AZAN_DURATION_SECONDS);

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  useEffect(() => {
    const unsub = subscribeAzanState(({ isPlaying, remainingSeconds: secs }) => {
      setIsPlayingTest(isPlaying);
      if (typeof secs === 'number') {
        setTestRemainingSeconds(secs);
      }
    });
    return unsub;
  }, []);

  const loadSettings = async () => {
    const isEn = await getAzanAlertEnabled();
    const off = await getAzanAlertOffset();
    setEnabled(isEn);
    setOffset(off);
  };

  const toggleEnabled = async () => {
    const next = !enabled;
    setEnabled(next);
    await setAzanAlertEnabled(next);
    if (!next) {
      await stopAzanSound();
    }
    Toast.show({
      type: 'success',
      text1: next ? 'Azaan Alert Enabled' : 'Azaan Alert Turned OFF',
      text2: next ? 'You will be alerted before Azaan time.' : 'Azaan voice and alerts turned off.',
    });
  };

  const handleSelectOffset = async (mins) => {
    setOffset(mins);
    await setAzanAlertOffset(mins);
    Toast.show({
      type: 'info',
      text1: 'Alert Timing Updated',
      text2: mins === 0 ? 'Alert will sound at exact Azaan time.' : `Alert will sound ${mins} minutes before Azaan.`,
    });
  };

  const handleTestAudio = async () => {
    if (isPlayingTest) {
      await stopAzanSound();
    } else {
      await playAzanSound();
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.settingsCard}>
          <View style={styles.settingsHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="notifications" size={24} color="#1b6b3c" style={{ marginRight: 8 }} />
              <Text style={styles.settingsTitle}>Azaan Alert Settings</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#555" />
            </TouchableOpacity>
          </View>

          {/* Toggle Switch */}
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Automatic Azaan Alert</Text>
              <Text style={styles.settingSub}>Plays voice before earliest prayer Azaan (30s)</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggleBtn, enabled ? styles.toggleOn : styles.toggleOff]}
              onPress={toggleEnabled}
              activeOpacity={0.8}
            >
              <Text style={styles.toggleText}>{enabled ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>

          {/* Timing Offset Options */}
          <View style={{ marginTop: 15 }}>
            <Text style={styles.settingLabel}>Alert Timing</Text>
            <Text style={styles.settingSub}>Choose when the alert sounds:</Text>

            <View style={styles.offsetOptionsRow}>
              {[
                { label: '2 Min Before', val: 2 },
                { label: '5 Min Before', val: 5 },
                { label: 'At Azaan Time', val: 0 },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.val}
                  style={[styles.offsetChip, offset === opt.val && styles.offsetChipActive]}
                  onPress={() => handleSelectOffset(opt.val)}
                >
                  <Text
                    style={[styles.offsetChipText, offset === opt.val && styles.offsetChipTextActive]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Test Voice / Stop Button */}
          <TouchableOpacity
            style={[styles.testBtn, isPlayingTest && styles.testBtnPlaying]}
            onPress={handleTestAudio}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isPlayingTest ? 'stop-circle' : 'volume-high'}
              size={20}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.testBtnText}>
              {isPlayingTest ? `Stop Voice (${testRemainingSeconds}s remaining)` : 'Test Azaan Voice (30s)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    borderWidth: 2,
    borderColor: '#cde8d6',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eaf6ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#a3d9b4',
  },
  arabicText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1b6b3c',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#2c3e50',
    marginBottom: 8,
  },
  prayerBadge: {
    backgroundColor: '#1b6b3c',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  prayerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timingMessage: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e67e22',
    marginBottom: 12,
  },
  masjidBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5faf6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0ebd7',
    width: '100%',
    justifyContent: 'center',
  },
  masjidText: {
    fontSize: 13,
    color: '#2c3e50',
    fontWeight: '600',
    textAlign: 'center',
  },
  playingBox: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#f5faf6',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0ebd7',
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  playingText: {
    fontSize: 13,
    color: '#1b6b3c',
    fontWeight: '700',
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#d5e9dc',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1b6b3c',
    borderRadius: 3,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e74c3c',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#e74c3c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  dismissButton: {
    backgroundColor: '#27ae60',
    shadowColor: '#27ae60',
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Settings Card
  settingsCard: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
    elevation: 10,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 15,
  },
  settingsTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1b6b3c',
  },
  closeBtn: {
    backgroundColor: '#f5f5f5',
    padding: 6,
    borderRadius: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fcf9',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#edf5ee',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2c3e50',
  },
  settingSub: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  toggleOn: {
    backgroundColor: '#1b6b3c',
  },
  toggleOff: {
    backgroundColor: '#bdc3c7',
  },
  toggleText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  offsetOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  offsetChip: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 3,
    backgroundColor: '#f0f4f1',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2ece4',
  },
  offsetChipActive: {
    backgroundColor: '#1b6b3c',
    borderColor: '#1b6b3c',
  },
  offsetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
  },
  offsetChipTextActive: {
    color: '#fff',
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 18,
  },
  testBtnPlaying: {
    backgroundColor: '#e67e22',
  },
  testBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  doneBtn: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  doneBtnText: {
    color: '#333',
    fontWeight: '700',
    fontSize: 14,
  },
});
