import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { AuthProvider } from './src/context/AuthContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { RefreshProvider, useRefresh } from './src/context/RefreshContext';
import RootNavigator from './src/navigation/RootNavigator';
import { useFonts, Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';

import Toast from 'react-native-toast-message';
import * as Updates from 'expo-updates';

function AppContent() {
  const { refreshKey } = useRefresh();

  return (
    <AuthProvider key={`auth-${refreshKey}`}>
      <SettingsProvider key={`settings-${refreshKey}`}>
        <RootNavigator key={`nav-${refreshKey}`} />
      </SettingsProvider>
    </AuthProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Amiri_400Regular,
    Amiri_700Bold,
  });

  useEffect(() => {
    async function checkForUpdates() {
      if (__DEV__) return;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (err) {
        console.log('Update check error:', err?.message);
      }
    }
    checkForUpdates();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <RefreshProvider>
      <AppContent />
      <Toast />
    </RefreshProvider>
  );
}
