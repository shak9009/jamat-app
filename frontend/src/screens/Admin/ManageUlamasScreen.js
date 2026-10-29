import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import Toast from 'react-native-toast-message';
import { API_URL as BASE_API_URL } from '../../config/apiConfig';

export default function ManageUlamasScreen({ navigation }) {
  const { role } = useAuth();
  const [ulamas, setUlamas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showAddBayanModal, setShowAddBayanModal] = useState(false);
  const [selectedUlamaId, setSelectedUlamaId] = useState(null);
  const [bayanTitle, setBayanTitle] = useState('');
  const [bayanLink, setBayanLink] = useState('');
  const [isSubmittingBayan, setIsSubmittingBayan] = useState(false);

  const API_URL = `${BASE_API_URL}/api/admin`;

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

      const ulamasWithBayans = ulamasList.map(ulama => ({
        ...ulama,
        bayans: bayansList.filter(bayan => bayan.ulama_id === ulama.id)
      }));

      setUlamas(ulamasWithBayans);
    } catch (error) {
      console.error('Error fetching ulamas:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load Ulamas.' });
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64);
    }
  };

  const handleAddUlama = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter the Ulama\'s name.' });
      return;
    }

    setIsSubmitting(true);
    let publicUrl = null;

    try {
      if (imageBase64) {
        try {
          const formData = new FormData();
          formData.append('image', imageBase64);
          
          const imgbbKey = process.env.EXPO_PUBLIC_IMGBB_API_KEY;
          if (!imgbbKey) throw new Error('ImgBB API key is missing from .env');

          const uploadRes = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
            method: 'POST',
            body: formData,
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          
          const result = await uploadRes.json();
          if (result.success) {
            publicUrl = result.data.url;
          } else {
            throw new Error(result.error?.message || 'ImgBB upload failed');
          }
        } catch (uploadErr) {
          console.error('Image upload error:', uploadErr);
          throw new Error('Image upload failed. Please verify your ImgBB API Key.');
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      
      const response = await fetch(`${API_URL}/ulamas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: name.trim(), imageUrl: publicUrl })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to add Ulama');
      }

      Toast.show({ type: 'success', text1: 'Success', text2: 'Ulama added successfully.' });
      setName('');
      setImageUri(null);
      setImageBase64(null);
      fetchUlamas();
    } catch (error) {
      console.error('Add Ulama Error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUlama = async (id) => {
    Alert.alert('Delete Ulama', 'Are you sure? This will also delete all their Bayans.', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || '';
            const response = await fetch(`${API_URL}/ulamas/${id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            if (!response.ok) throw new Error('Failed to delete Ulama');

            Toast.show({ type: 'success', text1: 'Deleted', text2: 'Ulama removed successfully.' });
            fetchUlamas();
          } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: error.message });
          }
        }
      }
    ]);
  };

  const handleAddBayan = async () => {
    if (!bayanLink.trim()) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter a YouTube link.' });
      return;
    }

    setIsSubmittingBayan(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      
      const response = await fetch(`${API_URL}/bayans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ulamaId: selectedUlamaId, title: bayanTitle.trim(), youtubeLink: bayanLink.trim() })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to add Bayan');
      }

      Toast.show({ type: 'success', text1: 'Success', text2: 'Bayan added successfully.' });
      setShowAddBayanModal(false);
      setBayanTitle('');
      setBayanLink('');
      fetchUlamas();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    } finally {
      setIsSubmittingBayan(false);
    }
  };

  const handleDeleteBayan = async (id) => {
    Alert.alert('Delete Bayan', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || '';
            const response = await fetch(`${API_URL}/bayans/${id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            if (!response.ok) throw new Error('Failed to delete Bayan');

            Toast.show({ type: 'success', text1: 'Deleted', text2: 'Bayan removed successfully.' });
            fetchUlamas();
          } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: error.message });
          }
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1b6b3c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Ulamas</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.addSection}>
          <Text style={styles.sectionTitle}>Add New Ulama</Text>
          <View style={styles.imagePickerContainer}>
            <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera" size={32} color="#aaa" />
                  <Text style={styles.imagePlaceholderText}>Upload Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Ulama's Name"
            value={name}
            onChangeText={setName}
          />
          <TouchableOpacity 
            style={[styles.primaryButton, isSubmitting && { opacity: 0.7 }]} 
            onPress={handleAddUlama}
            disabled={isSubmitting}
          >
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Add Ulama</Text>}
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Existing Ulamas</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#1b6b3c" style={{ marginTop: 30 }} />
        ) : ulamas.length === 0 ? (
          <Text style={styles.emptyText}>No Ulamas found.</Text>
        ) : (
          ulamas.map((ulama) => (
            <View key={ulama.id} style={styles.ulamaCard}>
              <View style={styles.ulamaHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {ulama.image_url ? (
                    <Image source={{ uri: ulama.image_url }} style={styles.ulamaImage} />
                  ) : (
                    <View style={styles.ulamaImagePlaceholder}>
                      <Ionicons name="person" size={24} color="#1b6b3c" />
                    </View>
                  )}
                  <Text style={styles.ulamaName}>{ulama.name}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteUlama(ulama.id)} style={{ padding: 5 }}>
                  <Ionicons name="trash" size={20} color="#e74c3c" />
                </TouchableOpacity>
              </View>

              <View style={styles.bayansSection}>
                <Text style={styles.bayansTitle}>Bayans ({ulama.bayans?.length || 0})</Text>
                {ulama.bayans && ulama.bayans.length > 0 && (
                  <View style={styles.bayanList}>
                    {ulama.bayans.map(bayan => (
                      <View key={bayan.id} style={styles.bayanItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.bayanItemTitle}>{bayan.title || 'Bayan'}</Text>
                          <Text style={styles.bayanItemLink} numberOfLines={1}>{bayan.youtube_link}</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleDeleteBayan(bayan.id)} style={{ padding: 5 }}>
                          <Ionicons name="close-circle" size={20} color="#e74c3c" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity 
                  style={styles.addBayanBtn}
                  onPress={() => {
                    setSelectedUlamaId(ulama.id);
                    setShowAddBayanModal(true);
                  }}
                >
                  <Ionicons name="add" size={16} color="#1b6b3c" />
                  <Text style={styles.addBayanBtnText}>Add Bayan</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Bayan Modal (Slide-up Overlay) */}
      {showAddBayanModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Bayan</Text>
              <TouchableOpacity onPress={() => setShowAddBayanModal(false)}>
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Bayan Title (Optional)"
              value={bayanTitle}
              onChangeText={setBayanTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="YouTube Link (e.g. https://youtu.be/...)"
              value={bayanLink}
              onChangeText={setBayanLink}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TouchableOpacity 
              style={[styles.primaryButton, isSubmittingBayan && { opacity: 0.7 }]} 
              onPress={handleAddBayan}
              disabled={isSubmittingBayan}
            >
              {isSubmittingBayan ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save Bayan</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f9f5' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  backButton: { marginRight: 15 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1b6b3c' },
  content: { padding: 20, paddingBottom: 40 },
  
  addSection: { backgroundColor: '#fff', padding: 20, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 15 },
  
  imagePickerContainer: { alignItems: 'center', marginBottom: 15 },
  imagePickerBtn: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: { alignItems: 'center' },
  imagePlaceholderText: { fontSize: 12, color: '#aaa', marginTop: 5 },
  
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 15, color: '#333' },
  
  primaryButton: { backgroundColor: '#1b6b3c', padding: 15, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  emptyText: { textAlign: 'center', color: '#888', marginTop: 20, fontStyle: 'italic' },
  
  ulamaCard: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 },
  ulamaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  ulamaImage: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  ulamaImagePlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eef6f0', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  ulamaName: { fontSize: 18, fontWeight: '700', color: '#333' },
  
  bayansSection: { },
  bayansTitle: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 10 },
  bayanList: { marginBottom: 10 },
  bayanItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 10, borderRadius: 8, marginBottom: 8 },
  bayanItemTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  bayanItemLink: { fontSize: 12, color: '#888', marginTop: 2 },
  
  addBayanBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, backgroundColor: '#eef6f0', borderRadius: 8 },
  addBayanBtnText: { color: '#1b6b3c', fontWeight: '600', fontSize: 13, marginLeft: 5 },

  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
});
