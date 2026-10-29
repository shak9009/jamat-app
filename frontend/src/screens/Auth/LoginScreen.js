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
  ToastAndroid,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { Image as ExpoImage } from 'expo-image';
import { API_URL } from '../../config/apiConfig';
import Toast from 'react-native-toast-message';

const { height } = Dimensions.get('window');

export default function LoginScreen({ navigation, route }) {
  const { silentLogin, finalizeLogin } = useAuth();
  const { globalSettings } = useSettings();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

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



  const handleLogin = async () => {
    if (!phone || !password) {
      Toast.show({ type: 'error', text1: 'Missing info', text2: 'Please enter your mobile number or email, and password.' });
      return;
    }

    const isEmail = phone.includes('@');

    if (!isEmail) {
      if (phone.length !== 10 || !/^\d{10}$/.test(phone)) {
        Toast.show({ type: 'error', text1: 'Invalid Input', text2: 'Phone number must be exactly 10 digits.' });
        return;
      }
    }

    setLoading(true);
    try {
      let loginEmail = phone.trim().toLowerCase();

      if (!isEmail) {
        const fetchUrl = `${API_URL}/api/get-email-by-phone`;
        console.log("Network Request -> Fetching from:", fetchUrl);
        
        const emailRes = await fetch(fetchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone.trim() })
        }).catch(err => {
          console.error("Fetch Connection Error (Server might be off or IP is wrong):", err);
          throw err;
        });

        const emailData = await emailRes.json();
        if (!emailRes.ok) {
          throw new Error(`API Error ${emailRes.status}: ${emailData.error || 'Unknown error'}`);
        }
        loginEmail = emailData.email;
      }

      const loginData = await silentLogin(loginEmail, password);

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to login',
          fallbackLabel: 'Use Passcode',
        });

        if (!authResult.success) {
          await signOut(auth);
          throw new Error('Biometric authentication failed or cancelled.');
        }
      }
      
      // Explicitly set the user context, as onAuthStateChanged might not fire 
      // if the user is already logged in but context was cleared
      await finalizeLogin(loginData);
      
    } catch (e) {
      console.error("Login Error Details:", e);
      if (Platform.OS === 'android') {
        ToastAndroid.show(e.message || 'Invalid Credentials', ToastAndroid.SHORT);
      } else {
        Toast.show({ type: 'error', text1: 'Login failed', text2: e.message || 'Invalid Credentials' });
      }
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
          {/* Decorative circles */}
          <View style={styles.circle1} />
          <View style={styles.circle2} />

          <Animated.View style={[styles.logoWrapper, { opacity: logoAnim, transform: [{ scale: logoAnim }] }]}>
            <View style={styles.logoCard}>
              <ExpoImage
                source={globalSettings?.logo_url ? { uri: globalSettings.logo_url } : require('../../../assets/JamatLogo.png')}
                style={styles.logo}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            </View>
            <Text style={styles.orgName}>{globalSettings?.app_name || 'Jamaat E Ahle Hadees'}</Text>
            <Text style={styles.orgSubtitle}>Kurnool, Andhra Pradesh</Text>
            <Text style={styles.orgTagline}>Your trusted community platform</Text>
          </Animated.View>
        </View>

        <ScrollView
          style={styles.bottomHalf}
          contentContainerStyle={styles.bottomHalfContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your account with Mobile Number or Email</Text>

          <View style={[styles.inputWrapper, focusedInput === 'phone' && styles.inputFocused]}>
            <Text style={styles.inputIcon}>👤</Text>
            <TextInput
              style={styles.input}
              placeholder="Mobile Number or Email"
              placeholderTextColor="#aaa"
              keyboardType="default"
              autoCapitalize="none"
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
            style={styles.forgotPasswordContainer}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Login'}</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.75}
          >
            <Text style={styles.secondaryButtonText}>New here? Create an account →</Text>
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

  /* ── Top half ── */
  topHalf: {
    flex: 1,
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
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: { width: 170, height: 170, borderRadius: 100, overflow: 'hidden' },
  orgName: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 16,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  orgSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  orgTagline: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 0.3,
    fontWeight: '400',
  },

  /* ── Bottom half ── */
  bottomHalf: {
    flex: 1,
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
    paddingTop: 32,
    paddingBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0a3d1f',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 24,
  },

  /* Inputs */
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    backgroundColor: '#fafafa',
  },
  inputFocused: {
    borderColor: '#1b6b3c',
    backgroundColor: '#f0faf4',
  },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: {
    flex: 1,
    height: 50,
    fontSize: 15,
    color: '#222',
  },

  /* Primary button */
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -4,
  },
  forgotPasswordText: {
    color: '#1b6b3c',
    fontSize: 14,
    fontWeight: '600',
  },
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

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#eee' },
  dividerText: { marginHorizontal: 12, color: '#bbb', fontSize: 13 },

  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: { color: '#1b6b3c', fontWeight: '600', fontSize: 14 },
});
