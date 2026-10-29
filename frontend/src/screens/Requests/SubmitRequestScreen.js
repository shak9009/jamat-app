import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';

export default function SubmitRequestScreen({ navigation }) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
    if (!message.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a message for your request.' });
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl = null;

      if (image?.base64) {
        Toast.show({ type: 'info', text1: 'Uploading...', text2: 'Uploading attachment' });
        imageUrl = await uploadImageToImgbb(image.base64);
      }

      const { error } = await supabase.from('user_requests').insert({
        user_id: user?.id || null,
        message: message.trim(),
        image_url: imageUrl,
        status: 'pending'
      });

      if (error) throw error;

      Toast.show({ type: 'success', text1: 'Success', text2: 'Your request has been submitted successfully.' });
      setMessage('');
      setImage(null);
      navigation.goBack();
    } catch (err) {
      console.error("Submit request error:", err);
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not submit request' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Submit a Request</Text>

      <View style={styles.formContainer}>
        <Text style={styles.label}>Message / Description</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Describe your request..."
          multiline
          numberOfLines={6}
          value={message}
          onChangeText={setMessage}
        />

        <Text style={styles.label}>Attachment (Optional)</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
          <Text style={styles.uploadButtonText}>{image ? '✓ Image Selected (Change)' : '+ Upload Image'}</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, backgroundColor: '#f4f9f5' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 20, color: '#1b6b3c', textAlign: 'center' },
  formContainer: { width: '100%', backgroundColor: '#fff', padding: 20, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  label: { fontSize: 14, fontWeight: '600', color: '#1b6b3c', marginBottom: 10 },
  textInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fafafa', textAlignVertical: 'top', marginBottom: 20 },
  uploadButton: { padding: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#1b6b3c', borderRadius: 8, alignItems: 'center', marginBottom: 16, borderStyle: 'dashed' },
  uploadButtonText: { color: '#1b6b3c', fontWeight: '600' },
  previewImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 16, resizeMode: 'cover' },
  submitButton: { backgroundColor: '#1b6b3c', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
