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
import { supabase } from '../../config/supabaseClient';
import Toast from 'react-native-toast-message';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Admin Request States
  const [isAdminFlow, setIsAdminFlow] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminImage, setAdminImage] = useState(null);

  const handleResetPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      Toast.show({
        type: 'error',
        text1: 'Missing info',
        text2: 'Please enter your registered email address.',
        position: 'top',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Email',
        text2: 'Please enter a valid email address.',
        position: 'top',
      });
      return;
    }

    setLoading(true);
    try {
      // 1. Check if user is registered in Supabase users table
      let userPhone = null;
      try {
        const { data: existingUsers, error: checkErr } = await supabase
          .from('users')
          .select('id, role, email, phone')
          .eq('email', cleanEmail)
          .limit(1);

        if (!checkErr && existingUsers && existingUsers.length === 0) {
          Toast.show({
            type: 'error',
            text1: 'Account Not Found',
            text2: 'No registered user found with this email. Please register first.',
            position: 'top',
            visibilityTime: 4000,
          });
          setLoading(false);
          return;
        }

        if (existingUsers && existingUsers[0]) {
          userPhone = existingUsers[0].phone;
          setAdminPhone(userPhone || '');
        }
      } catch (dbErr) {
        console.warn('Direct user check warning:', dbErr?.message);
      }

      // Notify backend API to generate OTP and send via Email Service
      let backendData = null;
      try {
        const response = await fetch(`${API_URL}/api/send-reset-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, phone: userPhone || cleanEmail })
        });
        backendData = await response.json();

        if (!response.ok) {
          throw new Error(backendData?.error || 'Failed to send password reset code');
        }
      } catch (apiErr) {
        console.error('Backend send-reset-otp api error:', apiErr);
        throw apiErr;
      }

      // Feedback to user
      if (backendData && backendData.smtpConfigured === false) {
        Toast.show({
          type: 'info',
          text1: 'Code Generated',
          text2: 'Email SMTP not yet configured on server. Check Render logs for the 6-digit code.',
          position: 'top',
          visibilityTime: 5000,
        });
      } else {
        Toast.show({
          type: 'success',
          text1: 'Reset Code Sent ✉️',
          text2: '6-digit reset code sent to your email. Check your inbox and spam folder.',
          position: 'top',
          visibilityTime: 4500,
        });
      }
      navigation.navigate('ResetPasswordOtp', { email: cleanEmail, phone: userPhone });

    } catch (error) {
      console.error('Password reset error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to send reset code. Please try again.',
        position: 'top',
        visibilityTime: 4000,
      });
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
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin-request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: (adminEmail || email).trim().toLowerCase(),
          phone: adminPhone || '',
          base64Image: adminImage ? adminImage.base64 : null,
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

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!isAdminFlow ? (
          <>
            <Text style={styles.title}>Forgot your password?</Text>
            <Text style={styles.subtitle}>
              Enter your registered email address and we'll send a 6-digit verification code to reset your password.
            </Text>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.input}
                placeholder="Registered Email Address"
                placeholderTextColor="#aaa"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Sending Code...' : 'Send Reset Code'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 18, alignItems: 'center', padding: 8 }}
              onPress={() => {
                setAdminEmail(email.trim().toLowerCase());
                setIsAdminFlow(true);
              }}
            >
              <Text style={{ color: '#7f8c8d', fontSize: 13, textDecorationLine: 'underline' }}>
                Admin? Submit Verification Request to Master Admin
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Admin Verification</Text>
            <Text style={styles.subtitle}>
              Submit a verification request to the Master Admin to reset your admin account password.
            </Text>

            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
              {adminImage ? (
                <Image source={{ uri: adminImage.uri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera" size={32} color="#7f8c8d" />
                  <Text style={styles.imagePlaceholderText}>Upload Photo (Optional)</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.inputWrapper}>
              <Ionicons name="chatbubble-outline" size={20} color="#7f8c8d" style={{ marginHorizontal: 12 }} />
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

            <TouchableOpacity
              style={{ marginTop: 18, alignItems: 'center', padding: 8 }}
              onPress={() => setIsAdminFlow(false)}
            >
              <Text style={{ color: '#0a3d1f', fontSize: 14, fontWeight: '600' }}>
                ✉️ Send 6-Digit Code to Email Instead
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
