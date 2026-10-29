import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export default function CustomDrawerContent(props) {
  const { logout, role } = useAuth();
  const { globalSettings } = useSettings();
  
  const displayRole = role === 'master_admin' ? 'Master Admin' : role === 'admin' ? 'Admin' : 'User';

  return (
    <View style={{ flex: 1 }}>
      <DrawerContentScrollView {...props} contentContainerStyle={{ backgroundColor: '#1b6b3c' }}>
        <View style={styles.header}>
          <Image
            source={globalSettings?.logo_url ? { uri: globalSettings.logo_url } : require('../../assets/JamatLogo.png')}
            style={styles.logo}
          />
          <Text style={styles.title}>Jamait App</Text>
          <Text style={styles.roleText}>{displayRole} Panel</Text>
        </View>
        <View style={styles.drawerListWrapper}>
          <DrawerItemList {...props} />
        </View>
      </DrawerContentScrollView>
      <View style={styles.footer}>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#1b6b3c',
  },
  logo: {
    height: 80,
    width: 80,
    borderRadius: 40,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  roleText: {
    color: '#d1ffd1',
    fontSize: 14,
    marginTop: 5,
  },
  drawerListWrapper: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 10,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    backgroundColor: '#fff',
  },
  logoutButton: {
    backgroundColor: '#d9534f',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
