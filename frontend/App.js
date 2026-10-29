import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { AuthProvider } from './src/context/AuthContext';
import { SettingsProvider } from './src/context/SettingsContext';
import RootNavigator from './src/navigation/RootNavigator';
import { useFonts, Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import BecomeAdminScreen from './src/screens/Requests/BecomeAdminScreen';

import Toast from 'react-native-toast-message';
import GlobalAzanFloatingBanner from './src/components/GlobalAzanFloatingBanner';

export default function App() {
  const [fontsLoaded] = useFonts({
    Amiri_400Regular,
    Amiri_700Bold,
  });

  useEffect(() => {
    // Initialization effects if any
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <AuthProvider>
        <SettingsProvider>
          <RootNavigator />
          <GlobalAzanFloatingBanner />
        </SettingsProvider>
      </AuthProvider>
      <Toast />
    </>
  );
}
