import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { RefreshProvider, useRefresh } from './src/context/RefreshContext';
import RootNavigator from './src/navigation/RootNavigator';
import { useFonts, Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import ErrorBoundary from './src/components/ErrorBoundary';

import Toast from 'react-native-toast-message';

function AppContent() {
  const { refreshKey } = useRefresh();

  return (
    <ErrorBoundary title="App Navigation Error">
      <AuthProvider key={`auth-${refreshKey}`}>
        <SettingsProvider key={`settings-${refreshKey}`}>
          <RootNavigator key={`nav-${refreshKey}`} />
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Amiri_400Regular,
    Amiri_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1b6b3c" />
      </View>
    );
  }

  return (
    <ErrorBoundary title="Application Error">
      <RefreshProvider>
        <AppContent />
        <Toast />
      </RefreshProvider>
    </ErrorBoundary>
  );
}
