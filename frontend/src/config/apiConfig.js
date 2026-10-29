import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Resolves the appropriate backend host IP depending on the running environment:
 * - Web (browser): Uses the current hostname (e.g., localhost or LAN IP)
 * - Mobile (Expo Go): Extracts the host machine IP from expoConfig
 * - Android Emulator fallback: Uses 10.0.2.2
 */
export const getDevServerIp = () => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location && window.location.hostname) {
      return window.location.hostname;
    }
    return 'localhost';
  }
  return Constants?.expoConfig?.hostUri?.split(':').shift() || '10.0.2.2';
};

export const PROD_BACKEND_URL = 'https://jamat-app.onrender.com';

export const getApiUrl = (port = 4000) => {
  // If explicitly asked to use local machine dev, use local IP
  if (process.env.EXPO_PUBLIC_USE_LOCAL === 'true') {
    const ip = getDevServerIp();
    return `http://${ip}:${port}`;
  }
  // Default to live cloud backend
  return PROD_BACKEND_URL;
};

export const API_URL = getApiUrl(4000);
export const PYTHON_API_URL = getApiUrl(8000);

export default {
  getDevServerIp,
  getApiUrl,
  API_URL,
  PROD_BACKEND_URL,
  PYTHON_API_URL,
};

