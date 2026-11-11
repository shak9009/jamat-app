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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/apiConfig';
import { supabase } from '../../config/supabaseClient';
import Toast from 'react-native-toast-message';

export default function ResetPasswordOtpScreen({ navigation, route }) {
  const email = (route.params?.email || '').toLowerCase().trim();
  const phone = (route.params?.phone || '').trim();
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerifyOtp = async () => {
    if (!otp || !newPassword) {
      Toast.show({
        type: 'error',
        text1: 'Missing info',
        text2: 'Please enter both the 6-digit code and your new password.',
        position: 'top',
      });
      return;
    }

    if (newPassword.length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Weak Password',
        text2: 'Password should be at least 6 characters long.',
        position: 'top',
      });
      return;
    }

    setLoading(true);
    try {
      let resetSuccessful = false;

      // 1. First try backend verify-otp
      try {
        const response = await fetch(`${API_URL}/api/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            phone: phone || email,
            otp: otp.trim(),
            newPassword
          })
        });

        const data = await response.json();
        if (response.ok && data.success) {
          resetSuccessful = true;
        } else if (!response.ok && !data.error?.includes('Network request failed')) {
          // If backend gave explicit verification error, don't silently ignore
          console.warn('Backend verify OTP response:', data.error);
        }
      } catch (backendErr) {
        console.warn('Backend verify error:', backendErr?.message);
      }

      // 2. Also try Supabase native recovery OTP verification as fallback
      if (!resetSuccessful && email) {
        try {
          const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
            email,
            token: otp.trim(),
            type: 'recovery',
          });

          if (!verifyErr && verifyData?.session) {
            const { error: updateErr } = await supabase.auth.updateUser({
              password: newPassword,
            });
            if (!updateErr) {
              resetSuccessful = true;
            }
          }
        } catch (supaErr) {
          console.warn('Supabase recovery verify error:', supaErr?.message);
        }
      }

      if (!resetSuccessful) {
        throw new Error('Invalid or expired verification code. Please check your email and try again.');
      }

      Toast.show({
        type: 'success',
        text1: 'Password Updated 🎉',
        text2: 'Your password has been reset successfully. Please log in.',
        position: 'top',
        visibilityTime: 4000,
      });
      navigation.navigate('Login');
    } catch (error) {
      console.error('OTP Verification Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: error.message || 'Please check the code and try again.',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email) return;
    setResending(true);
    try {
      const response = await fetch(`${API_URL}/api/send-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to resend code');

      Toast.show({
        type: 'success',
        text1: 'Code Resent ✉️',
        text2: 'A new 6-digit code has been sent to your email inbox.',
        position: 'top',
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || 'Could not resend code. Please try again.',
        position: 'top',
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0a3d1f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Code</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Enter Email Code</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit verification code to <Text style={{ fontWeight: '700', color: '#0a3d1f' }}>{email}</Text>. Please enter it below with your new password.
        </Text>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputIcon}>🔢</Text>
          <TextInput
            style={styles.input}
            placeholder="6-digit reset code"
            placeholderTextColor="#aaa"
            keyboardType="numeric"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputIcon}>🔒</Text>
          <TextInput
            style={styles.input}
            placeholder="New Password (min 6 characters)"
            placeholderTextColor="#aaa"
            secureTextEntry={!showPassword}
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
            <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#666" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerifyOtp}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Verifying...' : 'Reset Password'}
          </Text>
        </TouchableOpacity>

        <View style={{ marginTop: 24, alignItems: 'center' }}>
          <TouchableOpacity onPress={handleResendOtp} disabled={resending} activeOpacity={0.7}>
            <Text style={{ color: '#1b6b3c', fontWeight: 'bold', fontSize: 14 }}>
              {resending ? 'Sending new code...' : 'Didn\'t get the code? Resend to Email'}
            </Text>
          </TouchableOpacity>
        </View>
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
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 20,
    backgroundColor: '#fafafa',
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 15,
    color: '#222',
  },
  button: {
    backgroundColor: '#1b6b3c',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#1b6b3c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.4,
  },
});
