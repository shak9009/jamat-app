import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Image,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/apiConfig';

export default function ForgotPasswordScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Admin Request States
  const [isAdminFlow, setIsAdminFlow] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminImage, setAdminImage] = useState(null);



  const handleResetPassword = async () => {
    if (!phone || phone.length !== 10) {
      Alert.alert('Missing info', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/send-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      if (data.role === 'admin') {
        setIsAdminFlow(true);
        setAdminEmail(data.email);
      } else {
        Alert.alert(
          'OTP Sent',
          'Please check your SMS for the 6-digit reset code.',
          [{ text: 'OK', onPress: () => navigation.navigate('ResetPasswordOtp', { phone: phone.trim() }) }]
        );
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      setAdminImage(result.assets[0]);
    }
  };

  const handleSubmitAdminRequest = async () => {
    if (!adminImage) {
      Alert.alert('Missing Photo', 'Please upload a photo for verification.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin-request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          email: adminEmail,
          base64Image: adminImage.base64,
          message: adminMessage.trim()
        })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to submit request');

      Alert.alert('Request Submitted', 'Your password reset request has been sent to the Master Admin.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => {
          if (isAdminFlow) {
            setIsAdminFlow(false);
            setAdminImage(null);
            setAdminMessage('');
          } else {
            navigation.goBack();
          }
        }}>
          <Ionicons name="arrow-back" size={24} color="#0a3d1f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reset Password</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!isAdminFlow ? (
          <>
            <Text style={styles.title}>Forgot your password?</Text>
            <Text style={styles.subtitle}>
              Enter your registered mobile number and we'll send you an SMS to reset your password.
            </Text>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>📱</Text>
              <TextInput
                style={styles.input}
                placeholder="Mobile Number"
                placeholderTextColor="#aaa"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Processing...' : 'Send Reset Link'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Admin Verification</Text>
            <Text style={styles.subtitle}>
              Since you are an Admin, your password reset must be approved by a Master Admin. Please upload a photo to verify your identity.
            </Text>

            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
              {adminImage ? (
                <Image source={{ uri: adminImage.uri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera" size={32} color="#7f8c8d" />
                  <Text style={styles.imagePlaceholderText}>Upload Verification Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.inputWrapper}>
              <Ionicons name="chatbubble-outline" size={20} color="#7f8c8d" style={{marginHorizontal: 12}} />
              <TextInput
                style={styles.input}
                placeholder="Optional Message (e.g. My old phone broke)"
                placeholderTextColor="#aaa"
                value={adminMessage}
                onChangeText={setAdminMessage}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmitAdminRequest}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Submitting...' : 'Submit Request'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0a3d1f',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0a3d1f',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 32,
    lineHeight: 22,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 20,
    backgroundColor: '#fafafa',
  },
  inputIcon: {
    fontSize: 20,
    marginHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#e67e22',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#e67e22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  imagePicker: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#fafafa',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    marginTop: 10,
    color: '#7f8c8d',
    fontWeight: '500',
  }
});
