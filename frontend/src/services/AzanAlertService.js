import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

let currentPlayer = null;
let currentSubscription = null;
let isAudioPlaying = false;
let listeners = new Set();

const STORAGE_KEY_ENABLED = 'azan_alert_enabled';
const STORAGE_KEY_OFFSET = 'azan_alert_offset_minutes'; // 2 or 5
const STORAGE_KEY_LAST_ALERTED = 'azan_alert_last_key';

export const AZAN_DURATION_SECONDS = 30;
let autoStopTimer = null;
let countdownInterval = null;
let playbackRemainingSeconds = 0;

let expoAudioModule = null;

/**
 * Get current remaining playback seconds (0 if not playing)
 */
export function getAzanRemainingSeconds() {
  return playbackRemainingSeconds;
}

/**
 * Safely get the expo-audio module if available in the current runtime
 */
function getAudioModule() {
  if (expoAudioModule !== null) return expoAudioModule;
  try {
    expoAudioModule = require('expo-audio');
  } catch (err) {
    console.warn('expo-audio is not available in this environment:', err?.message || err);
    expoAudioModule = false;
  }
  return expoAudioModule;
}

/**
 * Configure global audio mode for playback
 */
async function configureAudio() {
  try {
    const audio = getAudioModule();
    if (audio && typeof audio.setAudioModeAsync === 'function') {
      await audio.setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });
    }
  } catch (err) {
    console.warn('Audio mode config error:', err?.message || err);
  }
}

/**
 * Check if Azan Alert is enabled (defaults to true)
 */
export async function getAzanAlertEnabled() {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEY_ENABLED);
    return val === null ? true : val === 'true';
  } catch (e) {
    return true;
  }
}

/**
 * Toggle Azan Alert ON or OFF
 */
export async function setAzanAlertEnabled(enabled) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_ENABLED, enabled ? 'true' : 'false');
    if (!enabled) {
      await stopAzanSound();
    }
    notifyListeners();
    return enabled;
  } catch (e) {
    return false;
  }
}

/**
 * Get alert timing offset in minutes (default: 2 mins before)
 */
export async function getAzanAlertOffset() {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEY_OFFSET);
    return val ? parseInt(val, 10) : 2; // Default 2 minutes before
  } catch (e) {
    return 2;
  }
}

/**
 * Set alert timing offset in minutes (e.g. 2 or 5)
 */
export async function setAzanAlertOffset(minutes) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_OFFSET, String(minutes));
    notifyListeners();
    return minutes;
  } catch (e) {
    return 2;
  }
}

/**
 * Play Azan voice audio (auto-stops strictly at 30 seconds)
 */
export async function playAzanSound() {
  try {
    await stopAzanSound();
    await configureAudio();

    const audio = getAudioModule();
    if (!audio || typeof audio.createAudioPlayer !== 'function') {
      console.warn('Audio player not available; visual alert will still show.');
      isAudioPlaying = false;
      playbackRemainingSeconds = 0;
      notifyListeners();
      return false;
    }

    const audioSource = require('../../assets/azan.mp3');
    const player = audio.createAudioPlayer(audioSource);
    currentPlayer = player;

    if (player && typeof player.addListener === 'function') {
      currentSubscription = player.addListener('playbackStatusUpdate', (status) => {
        // Guard: only stop if this player is still the active one (not already released)
        if (status?.didJustFinish && currentPlayer === player) {
          stopAzanSound();
        }
      });
    }

    if (player && typeof player.play === 'function') {
      player.play();
    }

    isAudioPlaying = true;
    playbackRemainingSeconds = AZAN_DURATION_SECONDS;
    notifyListeners();

    // 1-second countdown tick for UI indicators
    countdownInterval = setInterval(() => {
      if (playbackRemainingSeconds > 0) {
        playbackRemainingSeconds -= 1;
        notifyListeners();
      } else {
        if (countdownInterval) {
          clearInterval(countdownInterval);
          countdownInterval = null;
        }
      }
    }, 1000);

    // Hard auto-stop after exactly 30 seconds
    autoStopTimer = setTimeout(async () => {
      console.log(`[AzanAlertService] ${AZAN_DURATION_SECONDS}s auto-stop triggered.`);
      await stopAzanSound();
    }, AZAN_DURATION_SECONDS * 1000);

    return true;
  } catch (err) {
    console.error('Error playing Azan sound:', err);
    isAudioPlaying = false;
    playbackRemainingSeconds = 0;
    notifyListeners();
    return false;
  }
}

/**
 * Immediately stop and release Azan audio, clearing 30s timers.
 * Pauses and mutes player immediately so playback halts instantly on click.
 */
export async function stopAzanSound() {
  // Clear auto-stop timers
  if (autoStopTimer) {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  playbackRemainingSeconds = 0;

  // 1. Grab and immediately null the module-level refs so any concurrent
  //    calls or 'didJustFinish' callbacks exit early via the guard check.
  const playerToRelease = currentPlayer;
  const subToRemove = currentSubscription;
  currentPlayer = null;
  currentSubscription = null;

  // 2. Update state synchronously so the UI reflects stopped immediately.
  isAudioPlaying = false;
  notifyListeners();

  // 3. Immediately halt playback, mute, and silence volume on the native player
  if (playerToRelease) {
    try {
      if (typeof playerToRelease.pause === 'function') {
        playerToRelease.pause();
      }
    } catch (_) {}
    try {
      playerToRelease.muted = true;
    } catch (_) {}
    try {
      playerToRelease.volume = 0;
    } catch (_) {}
  }

  // 4. Remove the status subscription listener
  if (subToRemove) {
    try {
      subToRemove.remove();
    } catch (_) {}
  }

  // 5. Defer remove() to the next tick so the pause call can settle natively
  setTimeout(() => {
    try {
      if (playerToRelease && typeof playerToRelease.remove === 'function') {
        playerToRelease.remove();
      }
    } catch (_) {}
  }, 100);
}

export function isAzanAudioPlaying() {
  return isAudioPlaying;
}

/**
 * Register listener for sound state changes
 */
export function subscribeAzanState(callback) {
  listeners.add(callback);
  try {
    callback({ isPlaying: isAudioPlaying, remainingSeconds: playbackRemainingSeconds });
  } catch (e) {}
  return () => listeners.delete(callback);
}

function notifyListeners() {
  listeners.forEach((cb) => {
    try {
      cb({ isPlaying: isAudioPlaying, remainingSeconds: playbackRemainingSeconds });
    } catch (e) {}
  });
}

/**
 * Parse time string ("05:30 AM", "5:30", "17:30") to minutes from midnight
 */
export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const str = timeStr.trim().toLowerCase();
  const isPM = str.includes('pm');
  const isAM = str.includes('am');
  const cleaned = str.replace(/[apm\s]/g, '');
  const [hStr, mStr] = cleaned.split(':');
  if (!hStr || !mStr) return null;

  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  if (isPM && h !== 12) h += 12;
  else if (isAM && h === 12) h = 0;

  return h * 60 + m;
}

/**
 * Evaluate prayer timings and trigger Azan alert if within alert window
 *
 * @param {Array} masjidsList List of all masjids
 * @param {Function} onTrigger Callback when alert triggers
 */
export async function checkAndTriggerEarliestAzan(masjidsList = [], onTrigger = null) {
  const enabled = await getAzanAlertEnabled();
  if (!enabled) return null;

  const offsetMinutes = await getAzanAlertOffset(); // 2 or 5 minutes before
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentDay = now.getDay();
  const todayDateStr = now.toISOString().slice(0, 10);

  const prayers = [
    { name: 'Fajr', key: 'fajr' },
    { name: currentDay === 5 ? "Jumu'ah" : 'Dhuhr', key: currentDay === 5 ? 'jumuah' : 'dhuhr' },
    { name: 'Asr', key: 'asr' },
    { name: 'Maghrib', key: 'maghrib' },
    { name: 'Isha', key: 'isha' },
  ];

  let earliestPrayer = null;

  for (const masjid of masjidsList) {
    const timings = masjid.timings_json;
    if (!timings) continue;

    for (const p of prayers) {
      let timeObj = timings[p.key];
      if (typeof timeObj === 'string') {
        timeObj = { jamat: timeObj, azaan: '' };
      }
      if (!timeObj) continue;

      // Use azaan time if available, otherwise jamat time
      const targetTimeStr = timeObj.azaan || timeObj.jamat;
      const targetMins = parseTimeToMinutes(targetTimeStr);
      if (targetMins === null) continue;

      // If prayer is today and upcoming
      if (targetMins >= currentMinutes) {
        if (!earliestPrayer || targetMins < earliestPrayer.targetMins) {
          earliestPrayer = {
            prayerName: p.name,
            prayerKey: p.key,
            masjidName: masjid.name,
            masjidId: masjid.id,
            targetTimeStr,
            targetMins,
            isAzaanTime: !!timeObj.azaan,
          };
        }
      }
    }
  }

  if (!earliestPrayer) return null;

  // Alert trigger time = Azan time minus offset
  const alertMinutes = earliestPrayer.targetMins - offsetMinutes;
  // Keyed by date and prayerKey so only the earliest masjid alerts for that prayer session
  const alertUniqueKey = `${todayDateStr}_${earliestPrayer.prayerKey}`;

  // Check if current time is within alert window (exact minute or +1 min leeway)
  const isTimeForAlert = currentMinutes >= alertMinutes && currentMinutes <= earliestPrayer.targetMins;

  if (isTimeForAlert) {
    // Check if already dismissed today
    const lastAlertedKey = await AsyncStorage.getItem(STORAGE_KEY_LAST_ALERTED);
    if (lastAlertedKey === alertUniqueKey) {
      return null; // Already dismissed / triggered for this prayer today
    }

    // Mark as alerted so it never triggers repeatedly ("ek baar off kar diya to band ho jana wo")
    await AsyncStorage.setItem(STORAGE_KEY_LAST_ALERTED, alertUniqueKey);

    // Play Azan voice
    await playAzanSound();

    const alertData = {
      prayerName: earliestPrayer.prayerName,
      masjidName: earliestPrayer.masjidName,
      timeStr: earliestPrayer.targetTimeStr,
      offsetMinutes,
      isExactTime: currentMinutes >= earliestPrayer.targetMins,
    };

    if (typeof onTrigger === 'function') {
      onTrigger(alertData);
    }

    return alertData;
  }

  return null;
}
