import { Platform } from 'react-native';

let Notifications = null;

async function getNotifications() {
  if (Notifications !== null) return Notifications;
  try {
    Notifications = await import('expo-notifications');
    if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    }
  } catch (e) {
    console.warn('[NotificationService] expo-notifications not available:', e?.message);
    Notifications = false;
  }
  return Notifications;
}

export const requestPermissions = async () => {
  try {
    const notif = await getNotifications();
    if (!notif) return false;

    const { status: existingStatus } = await notif.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await notif.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (err) {
    console.warn('[NotificationService] permission error:', err?.message);
    return false;
  }
};

export const setupNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    try {
      const notif = await getNotifications();
      if (!notif || !notif.setNotificationChannelAsync) return;

      await notif.setNotificationChannelAsync('azan_alerts', {
        name: 'Prayer & Azan Alerts',
        importance: notif.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0a3d1f',
        sound: 'default',
        enableVibrate: true,
      });
    } catch (err) {
      console.warn('[NotificationService] channel error:', err?.message);
    }
  }
};

export const initializeNotifications = async () => {
  await setupNotificationChannel();
  await requestPermissions();
};

export const scheduleAzanNotifications = async (masjidsList = []) => {
  try {
    const notif = await getNotifications();
    if (!notif || !notif.scheduleNotificationAsync) return false;

    const hasPermission = await requestPermissions();
    if (!hasPermission) return false;

    await setupNotificationChannel();

    // Cancel existing scheduled prayer alerts to prevent duplicate stacking
    if (notif.cancelAllScheduledNotificationsAsync) {
      await notif.cancelAllScheduledNotificationsAsync();
    }

    const prayers = [
      { name: 'Fajr', key: 'fajr' },
      { name: 'Dhuhr', key: 'dhuhr' },
      { name: 'Asr', key: 'asr' },
      { name: 'Maghrib', key: 'maghrib' },
      { name: 'Isha', key: 'isha' },
    ];

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    for (const masjid of masjidsList) {
      const timings = masjid.timings_json;
      if (!timings) continue;

      for (const p of prayers) {
        let timeObj = timings[p.key];
        if (typeof timeObj === 'string') timeObj = { jamat: timeObj, azaan: '' };
        if (!timeObj) continue;

        const timeStr = timeObj.azaan || timeObj.jamat;
        if (!timeStr) continue;

        const [timePart, modifier] = timeStr.trim().split(/\s+/);
        if (!timePart) continue;
        let [hours, minutes] = timePart.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) continue;

        if (modifier && modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (modifier && modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;

        const prayerMins = hours * 60 + minutes;
        const diffSeconds = (prayerMins - currentMins) * 60;

        // Schedule only upcoming prayers for today
        if (diffSeconds > 60) {
          const triggerDate = new Date();
          triggerDate.setHours(hours, minutes, 0, 0);

          await notif.scheduleNotificationAsync({
            content: {
              title: `🕌 ${p.name} Prayer Time`,
              body: `It is time for ${p.name} Azan at ${masjid.name || 'Masjid'} (${timeStr}).`,
              sound: 'default',
              channelId: 'azan_alerts',
            },
            trigger: triggerDate,
          });
        }
      }
      break; // Primary masjid
    }

    return true;
  } catch (err) {
    console.warn('[NotificationService] schedule error:', err?.message);
    return false;
  }
};
