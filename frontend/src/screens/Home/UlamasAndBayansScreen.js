import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../config/supabaseClient';

export default function UlamasAndBayansScreen({ navigation }) {
  const [ulamas, setUlamas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUlamas();
  }, []);

  const fetchUlamas = async () => {
    try {
      const { data: ulamasList, error: ulamasError } = await supabase
        .from('ulamas')
        .select('*')
        .order('created_at', { ascending: false });

      if (ulamasError) throw ulamasError;

      const { data: bayansList, error: bayansError } = await supabase
        .from('bayans')
        .select('*')
        .order('created_at', { ascending: false });

      if (bayansError) throw bayansError;

      const ulamasWithBayans = (ulamasList || []).map(ulama => ({
        ...ulama,
        bayans: (bayansList || []).filter(bayan => bayan.ulama_id === ulama.id)
      }));

      setUlamas(ulamasWithBayans);
    } catch (error) {
      console.error('Error fetching ulamas:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleOpenYouTube = (url) => {
    Linking.openURL(url).catch(() => {
      alert('Could not open YouTube link');
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1b6b3c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ulamas & Bayans</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color="#1b6b3c" style={{ marginTop: 50 }} />
        ) : ulamas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>No Ulamas available right now.</Text>
          </View>
        ) : (
          ulamas.map((ulama) => (
            <View key={ulama.id} style={styles.ulamaCard}>
              <View style={styles.ulamaHeader}>
                {ulama.image_url ? (
                  <Image source={{ uri: ulama.image_url }} style={styles.ulamaImage} />
                ) : (
                  <View style={styles.ulamaImagePlaceholder}>
                    <Ionicons name="person" size={24} color="#1b6b3c" />
                  </View>
                )}
                <View style={styles.ulamaInfo}>
                  <Text style={styles.ulamaName}>{ulama.name}</Text>
                  <Text style={styles.bayanCount}>{ulama.bayans?.length || 0} Bayans Available</Text>
                </View>
              </View>

              {ulama.bayans && ulama.bayans.length > 0 && (
                <View style={styles.bayansContainer}>
                  {ulama.bayans.map((bayan, idx) => (
                    <TouchableOpacity 
                      key={bayan.id} 
                      style={[styles.bayanItem, idx !== ulama.bayans.length - 1 && styles.bayanItemBorder]}
                      onPress={() => handleOpenYouTube(bayan.youtube_link)}
                    >
                      <View style={styles.bayanIcon}>
                        <Ionicons name="logo-youtube" size={24} color="#e74c3c" />
                      </View>
                      <View style={styles.bayanDetails}>
                        <Text style={styles.bayanTitle} numberOfLines={2}>{bayan.title || 'Bayan'}</Text>
                        <Text style={styles.bayanWatchText}>Watch Now</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f9f5' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  backButton: { marginRight: 15, padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1b6b3c' },
  
  container: { padding: 15, paddingBottom: 40 },
  
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#888', marginTop: 15, fontSize: 16, fontStyle: 'italic' },
  
  ulamaCard: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, overflow: 'hidden' },
  ulamaHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#fdfdfd' },
  ulamaImage: { width: 70, height: 70, borderRadius: 35, marginRight: 15, borderWidth: 2, borderColor: '#eef6f0' },
  ulamaImagePlaceholder: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#eef6f0', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  ulamaInfo: { flex: 1, justifyContent: 'center' },
  ulamaName: { fontSize: 18, fontWeight: '800', color: '#2c3e50', marginBottom: 4 },
  bayanCount: { fontSize: 13, color: '#27ae60', fontWeight: '600', backgroundColor: '#eef6f0', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  
  bayansContainer: { borderTopWidth: 1, borderTopColor: '#f5f5f5', backgroundColor: '#fafafa' },
  bayanItem: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  bayanItemBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  bayanIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fcebea', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  bayanDetails: { flex: 1, marginRight: 10 },
  bayanTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 4 },
  bayanWatchText: { fontSize: 12, color: '#e74c3c', fontWeight: '600' }
});
