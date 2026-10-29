import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/apiConfig';
import Toast from 'react-native-toast-message';

const { height } = Dimensions.get('window');

export default function RegisterScreen({ navigation }) {
  const { silentLogin, finalizeLogin } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [occupation, setOccupation] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);


  const logoAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(60)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(formAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.timing(formOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    let interval;
    if (showOtpScreen && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [showOtpScreen, timer]);



  const handleSendOtp = async () => {
    if (!name || !email || !phone || !aadhaar || !password || !occupation || !occupation.trim()) {
      Toast.show({ type: 'error', text1: 'Missing info', text2: 'Please fill in all mandatory fields including Occupation.' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Toast.show({ type: 'error', text1: 'Invalid Email', text2: 'Please enter a valid email address.' });
      return;
    }
    if (phone.length !== 10 || !/^\d{10}$/.test(phone)) {
      Toast.show({ type: 'error', text1: 'Invalid Phone', text2: 'Phone number must be exactly 10 digits.' });
      return;
    }
    if (aadhaar.length !== 12 || !/^\d{12}$/.test(aadhaar)) {
      Toast.show({ type: 'error', text1: 'Invalid Aadhaar', text2: 'Aadhaar number must be exactly 12 digits.' });
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: phone.trim(),
          email: email.trim() 
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send OTP');
      
      setShowOtpScreen(true);
      setTimer(60);
      setCanResend(false);
      Toast.show({ type: 'success', text1: 'OTP Sent', text2: 'Please enter the 6-digit code sent to your phone.' });
    } catch (e) {
      console.error("OTP Send Error:", e);
      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndScan = async () => {
    if (!otp || otp.length !== 6) {
      Toast.show({ type: 'error', text1: 'Invalid OTP', text2: 'Please enter a valid 6-digit OTP.' });
      return;
    }
    
    setLoading(true);
    try {
      // 1. Verify OTP and Create Supabase User via Backend
      const verifyRes = await fetch(`${API_URL}/api/verify-otp-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: phone.trim(), 
          otp: otp.trim(), 
          name: name.trim(), 
          email: email.trim(),
          aadhaar,
          occupation: occupation.trim(),
          password
        })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || 'OTP verification failed');

      // Prompt Local Authentication for Biometric Link
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate thumb to complete registration',
          fallbackLabel: 'Use Passcode',
        });
        
        if (!authResult.success) {
          console.log('Biometric registration was cancelled.');
        }
      }

      // Auto-login user after successful registration
      try {
        await silentLogin(email.trim().toLowerCase(), password);
      } catch (loginErr) {
        Toast.show({ type: 'success', text1: 'Registration Successful 🎉', text2: 'Please login manually.' });
        navigation.navigate('Login');
      }

    } catch (e) {
      console.error("Registration Error Details:", e);
      Toast.show({ type: 'error', text1: 'Registration failed', text2: e.message });
    } finally {
      setLoading(false);
    }
  };


  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar barStyle="light-content" backgroundColor="#0a3d1f" />



        {/* Top half – Logo section */}
        <View style={styles.topHalf}>
          <View style={styles.circle1} />
          <View style={styles.circle2} />

          <Animated.View style={[styles.logoWrapper, { opacity: logoAnim, transform: [{ scale: logoAnim }] }]}>
            <View style={styles.logoCard}>
              <Image
                source={require('../../../assets/JamatLogo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.orgName}>Jamaat E Ahle Hadees Kurnool A.P</Text>
            <Text style={styles.orgTagline}>Join our community today</Text>
          </Animated.View>
        </View>

        <ScrollView
          style={styles.bottomHalf}
          contentContainerStyle={styles.bottomHalfContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!showOtpScreen ? (
            <>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Fill in your details to get started</Text>

              <View style={[styles.inputWrapper, focusedInput === 'name' && styles.inputFocused]}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  placeholderTextColor="#aaa"
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocusedInput('name')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <View style={[styles.inputWrapper, focusedInput === 'email' && styles.inputFocused]}>
                <Text style={styles.inputIcon}>📧</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="#aaa"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <View style={[styles.inputWrapper, focusedInput === 'aadhaar' && styles.inputFocused]}>
                <Text style={styles.inputIcon}>🪪</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Aadhaar Number (12 digits)"
                  placeholderTextColor="#aaa"
                  keyboardType="numeric"
                  maxLength={12}
                  value={aadhaar}
                  onChangeText={setAadhaar}
                  onFocus={() => setFocusedInput('aadhaar')}
                  onBlur={() => setFocusedInput(null)}
                />
                {aadhaar.length === 12 && (
                  <Text style={{ color: '#1b6b3c', fontSize: 16 }}>✓</Text>
                )}
              </View>

              <View style={[styles.inputWrapper, focusedInput === 'occupation' && styles.inputFocused]}>
                <Text style={styles.inputIcon}>💼</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Occupation / Profession *"
                  placeholderTextColor="#aaa"
                  value={occupation}
                  onChangeText={setOccupation}
                  onFocus={() => setFocusedInput('occupation')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <View style={[styles.inputWrapper, focusedInput === 'phone' && styles.inputFocused]}>
                <Text style={styles.inputIcon}>📱</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mobile Number (10 digits)"
                  placeholderTextColor="#aaa"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                  onFocus={() => setFocusedInput('phone')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <View style={[styles.inputWrapper, focusedInput === 'password' && styles.inputFocused]}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#aaa"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ paddingHorizontal: 4 }}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonText}>{loading ? 'Sending OTP...' : 'Send OTP'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Verify OTP</Text>
              <Text style={styles.subtitle}>Enter the 6-digit code sent to {phone}</Text>
              
              <View style={[styles.inputWrapper, focusedInput === 'otp' && styles.inputFocused]}>
                <Text style={styles.inputIcon}>🔢</Text>
                <TextInput
                  style={styles.input}
                  placeholder="6-digit OTP"
                  placeholderTextColor="#aaa"
                  keyboardType="numeric"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                  onFocus={() => setFocusedInput('otp')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyAndScan}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify & Register'}</Text>
              </TouchableOpacity>

              <View style={{ marginTop: 24, alignItems: 'center' }}>
                {canResend ? (
                  <TouchableOpacity onPress={handleSendOtp} disabled={loading} activeOpacity={0.7}>
                    <Text style={{ color: '#1b6b3c', fontWeight: 'bold', fontSize: 15 }}>Resend OTP</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={{ color: '#888', fontSize: 14 }}>Resend OTP in <Text style={{ fontWeight: 'bold' }}>{timer}s</Text></Text>
                )}
              </View>
            </>
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.75}
          >
            <Text style={styles.secondaryButtonText}>Already have an account? Login →</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>


    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a3d1f' },
  watermark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.1,
  },

  topHalf: {
    flex: 0.85,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.04)',
    top: -80,
    right: -60,
  },
  circle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -40,
    left: -40,
  },
  logoWrapper: { alignItems: 'center' },
  logoCard: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: { width: 140, height: 140, borderRadius: 70, overflow: 'hidden' },
  orgName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
    letterSpacing: 0.5,
  },
  orgTagline: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 4,
  },

  bottomHalf: {
    flex: 1.15,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  bottomHalfContent: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#0a3d1f', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#888', marginBottom: 20 },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  inputFocused: { borderColor: '#1b6b3c', backgroundColor: '#f0faf4' },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, height: 48, fontSize: 15, color: '#222' },

  button: {
    backgroundColor: '#1b6b3c',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#1b6b3c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.4 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#eee' },
  dividerText: { marginHorizontal: 12, color: '#bbb', fontSize: 13 },

  secondaryButton: { alignItems: 'center', paddingVertical: 10 },
  secondaryButtonText: { color: '#1b6b3c', fontWeight: '600', fontSize: 14 },
});
