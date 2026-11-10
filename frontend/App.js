import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { AuthProvider } from './src/context/AuthContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { RefreshProvider, useRefresh } from './src/context/RefreshContext';
import RootNavigator from './src/navigation/RootNavigator';
import { useFonts, Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';

import Toast from 'react-native-toast-message';

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
