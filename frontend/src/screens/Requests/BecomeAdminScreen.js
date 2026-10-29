import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, ScrollView, Modal, FlatList } from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export default function BecomeAdminScreen({ navigation }) {
  const { user } = useAuth();
  
  const [name, setName] = useState(user?.user_metadata?.name || user?.name || '');
  const [mobile, setMobile] = useState(user?.user_metadata?.phone || user?.phone || '');
  const [aadhar, setAadhar] = useState(user?.user_metadata?.aadhaar || user?.aadhaar || '');
  const [email, setEmail] = useState(user?.email || '');
  
  const [masjids, setMasjids] = useState([]);
  const [selectedMasjid, setSelectedMasjid] = useState(null);
  const [showMasjidModal, setShowMasjidModal] = useState(false);
  
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingMasjids, setFetchingMasjids] = useState(true);

  useEffect(() => {
    fetchMasjids();
    fetchUserData();
  }, []);

  const uploadImageToImgbb = async (base64String) => {
    try {
      const formData = new FormData();
      formData.append('image', base64String);

      const imgbbKey = process.env.EXPO_PUBLIC_IMGBB_API_KEY;
      if (!imgbbKey || imgbbKey === 'PASTE_YOUR_API_KEY_HERE') {
        throw new Error('ImgBB API key is missing from .env');
      }

      const uploadRes = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const result = await uploadRes.json();
      if (result.success) {
        return result.data.url;
      } else {
        throw new Error(result.error?.message || 'ImgBB upload failed');
      }
    } catch (e) {
      console.error('Image upload failed', e);
      throw new Error('Failed to upload image. Please try again.');
    }
  };

  const fetchUserData = async () => {
    if (user?.id) {
      try {
        const { data: supaUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        if (supaUser) {
          if (supaUser.name) setName(supaUser.name);
          if (supaUser.phone) setMobile(supaUser.phone);
          if (supaUser.aadhaar) setAadhar(supaUser.aadhaar);
        }
      } catch (err) {
        console.error('Failed to fetch user data:', err);
      }
    }
  };

  const fetchMasjids = async () => {
    try {
      const { data, error } = await supabase
        .from('masjids')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setMasjids(data || []);
    } catch (err) {
      console.error('Failed to fetch masjids:', err);
    } finally {
      setFetchingMasjids(false);
    }
  };

  const handleSelectMasjid = async (masjid) => {
    try {
      // Check admin limit
      const { data: admins, error } = await supabase
        .from('users')
        .select('id')
        .eq('assigned_masjid_id', masjid.id)
        .eq('role', 'admin');

      if (!error && admins && admins.length >= 2) {
        Toast.show({ type: 'error', text1: 'Limit Reached', text2: 'Already 2 admins are registered in that masjid.' });
        return;
      }
      
      setSelectedMasjid(masjid);
      setShowMasjidModal(false);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to verify admin count.' });
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) setImage(result.assets[0]);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !mobile.trim() || !aadhar.trim() || !email.trim() || !selectedMasjid || !image) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please fill all fields, select a Masjid, and upload a photo (Aadhar/Selfie).' });
      return;
    }

    if (aadhar.trim().length !== 12 || !/^\d{12}$/.test(aadhar.trim())) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Aadhaar number must be exactly 12 digits.' });
      return;
    }

    setSubmitting(true);
    try {
      let publicUrl = null;
      if (image?.base64) {
        Toast.show({ type: 'info', text1: 'Uploading...', text2: 'Uploading photo' });
        publicUrl = await uploadImageToImgbb(image.base64);
      }

      const payload = {
        name: name.trim(),
        aadhar: aadhar.trim(),
        email: email.trim(),
        phone: mobile.trim(),
        masjidId: selectedMasjid.id,
        masjidName: selectedMasjid.name,
        area: selectedMasjid.address,
        user_id: user?.id
      };

      const { error } = await supabase.from('user_requests').insert({
        user_id: user?.id || null,
        message: `Admin Request for ${selectedMasjid.name}: ${JSON.stringify(payload)}`,
        image_url: publicUrl,
        status: 'pending'
      });

      if (error) throw error;

      Toast.show({ type: 'success', text1: 'Success', text2: 'Your request has been submitted to the Master Admin.' });
      navigation.goBack();
      
    } catch (err) {
      console.error(err);
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Submission failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Request Admin Access</Text>
      <Text style={styles.subtitle}>Fill out the form below to request local admin privileges for your Masjid.</Text>
      
      <View style={styles.formContainer}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.textInput} placeholder="Enter your full name" value={name} onChangeText={setName} />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.textInput} placeholder="Enter your email" value={email} onChangeText={setEmail} keyboardType="email-address" />

        <Text style={styles.label}>Mobile Number</Text>
        <TextInput style={[styles.textInput, { backgroundColor: '#eef2f5' }]} placeholder="Enter mobile number" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" editable={false} />

        <Text style={styles.label}>Aadhar Number</Text>
        <TextInput style={[styles.textInput, { backgroundColor: '#eef2f5' }]} placeholder="Enter your 12-digit Aadhar" value={aadhar} onChangeText={setAadhar} keyboardType="numeric" maxLength={12} editable={false} />

        <Text style={styles.label}>Select Masjid</Text>
        <TouchableOpacity style={styles.masjidSelector} onPress={() => setShowMasjidModal(true)}>
          <Text style={selectedMasjid ? styles.masjidSelectedText : styles.masjidPlaceholderText}>
            {selectedMasjid ? selectedMasjid.name : 'Tap to select a Masjid'}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#7f8c8d" />
        </TouchableOpacity>
        {selectedMasjid?.address ? <Text style={styles.masjidAddressText}>{selectedMasjid.address}</Text> : null}

        <Text style={styles.label}>Verification Photo (ID / Selfie)</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
          <Text style={styles.uploadButtonText}>{image ? '✓ Photo Selected (Change)' : '+ Upload Photo'}</Text>
        </TouchableOpacity>
        
        {image && <Image source={{ uri: image.uri }} style={styles.previewImage} />}
        
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Submit Request</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Masjid Selection Modal */}
      <Modal visible={showMasjidModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Masjid</Text>
              <TouchableOpacity onPress={() => setShowMasjidModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {fetchingMasjids ? (
              <ActivityIndicator size="large" color="#1b6b3c" style={{ marginTop: 50 }} />
            ) : (
              <FlatList
                data={masjids}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.masjidItem} onPress={() => handleSelectMasjid(item)}>
                    <Text style={styles.masjidItemName}>{item.name}</Text>
                    {item.address ? <Text style={styles.masjidItemAddress}>{item.address}</Text> : null}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No Masjids found.</Text>}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            )}
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, backgroundColor: '#f4f9f5' },
  title: { fontSize: 24, fontWeight: '900', color: '#1b6b3c', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 20, marginTop: 5, paddingHorizontal: 10 },
  formContainer: { width: '100%', backgroundColor: '#fff', padding: 20, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 },
  label: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 6, textTransform: 'uppercase' },
  textInput: { borderWidth: 1, borderColor: '#eaeaea', borderRadius: 10, padding: 14, fontSize: 15, backgroundColor: '#fafafa', marginBottom: 16 },
  masjidSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#eaeaea', borderRadius: 10, padding: 14, backgroundColor: '#fafafa', marginBottom: 8 },
  masjidSelectedText: { fontSize: 15, color: '#222' },
  masjidPlaceholderText: { fontSize: 15, color: '#999' },
  masjidAddressText: { fontSize: 12, color: '#666', marginBottom: 16, marginLeft: 5 },
  uploadButton: { padding: 16, backgroundColor: '#eef6f0', borderWidth: 1, borderColor: '#c5e3d0', borderRadius: 10, alignItems: 'center', marginBottom: 16 },
  uploadButtonText: { color: '#1b6b3c', fontWeight: '800' },
  previewImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 16, resizeMode: 'cover' },
  submitButton: { backgroundColor: '#1b6b3c', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, shadowColor: '#1b6b3c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  closeBtn: { padding: 5 },
  masjidItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  masjidItemName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  masjidItemAddress: { fontSize: 13, color: '#777', marginTop: 3 },
  emptyText: { textAlign: 'center', marginTop: 30, color: '#999', fontSize: 15 },
});
