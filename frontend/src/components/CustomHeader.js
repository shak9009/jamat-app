import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { useFonts, Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';

export default function CustomHeader({ back }) {
  const { logout, user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  let [fontsLoaded] = useFonts({
    Amiri_400Regular,
    Amiri_700Bold,
  });

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() }
    ]);
  };

  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
      {/* Bismillah Top Bar */}
      <View style={styles.bismillahContainer}>
        <Text style={[styles.bismillahText, fontsLoaded && { fontFamily: 'Amiri_700Bold' }]}>
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </Text>
      </View>

      {/* Main Header */}
      <View style={styles.headerBody}>
        <View style={styles.leftSection}>
          {back && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={26} color="#0a3d1f" />
            </TouchableOpacity>
          )}
          <Image
            source={require('../../assets/JamatLogo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Jamaat E Ahle Hadees</Text>
          <Text style={styles.headerSubtitle}>Kurnool Andhra Pradesh</Text>
          {(user?.role === 'admin' || user?.role === 'master_admin' || user?.user_metadata?.role === 'admin' || user?.user_metadata?.role === 'master_admin') && (
            <Text style={{ fontSize: 10, color: '#1b6b3c', fontWeight: 'bold', marginTop: 2, textAlign: 'center' }}>
              {user?.user_metadata?.role === 'master_admin' ? 'Master Admin Dashboard' : 'Admin Dashboard'}
              {user?.user_metadata?.name ? ` • ${user.user_metadata.name}` : ''}
            </Text>
          )}
        </View>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={28} color="#d9534f" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    zIndex: 10,
  },
  bismillahContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  bismillahText: {
    color: '#1b6b3c',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 10,
    padding: 4,
  },
  headerLogo: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
  },
  headerTextContainer: {
    flex: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0a3d1f',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
  },
  logoutButton: {
    padding: 8,
  },
});
