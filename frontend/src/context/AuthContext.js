import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabaseClient';
import { API_URL } from '../config/apiConfig';
import Toast from 'react-native-toast-message';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const isAuthenticatingRef = useRef(false);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await handleSession(session);
      setInitializing(false);

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (_event, newSession) => {
          await handleSession(newSession);
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    };

    fetchSession();
  }, []);

  const handleSession = async (session) => {
    if (session?.user) {
      try {
        const { data: userDoc, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!error && userDoc) {
          const userProfile = { id: session.user.id, email: session.user.email, ...userDoc };
          setUser(userProfile);
          setRole(userDoc.role || 'user');
          await AsyncStorage.setItem('user_info', JSON.stringify(userProfile));
        } else {
          const fallbackProfile = { id: session.user.id, email: session.user.email, role: 'user' };
          setUser(fallbackProfile);
          setRole('user');
        }
      } catch (e) {
        console.error("Error fetching user data", e);
      }
    } else {
      setUser(null);
      setRole(null);
      await AsyncStorage.removeItem('user_info');
    }
  };

  const silentLogin = async (email, password) => {
    try {
      isAuthenticatingRef.current = true;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      console.log('--- SUPABASE LOGIN SUCCESS ---');
      return { uid: data.user.id, user: data.user };
    } catch (error) {
      isAuthenticatingRef.current = false;
      throw error;
    }
  };

  const finalizeLogin = async (loginData) => {
    try {
      const supabaseUser = loginData.user;
      const { data: userDoc, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      if (!error && userDoc) {
        const userProfile = { id: supabaseUser.id, email: supabaseUser.email, ...userDoc };
        setUser(userProfile);
        setRole(userDoc.role || 'user');
        await AsyncStorage.setItem('user_info', JSON.stringify(userProfile));
      } else {
        const fallbackProfile = { id: supabaseUser.id, email: supabaseUser.email, role: 'user' };
        setUser(fallbackProfile);
        setRole('user');
        await AsyncStorage.setItem('user_info', JSON.stringify(fallbackProfile));
      }
      isAuthenticatingRef.current = false;
    } catch (e) {
      isAuthenticatingRef.current = false;
      throw new Error('Failed to finalize login: ' + e.message);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setRole(null);
      await AsyncStorage.removeItem('user_info');
      setTimeout(() => {
        Toast.show({
          type: 'success',
          text1: 'Logged Out',
          text2: 'You have been logged out securely.',
          position: 'top',
          visibilityTime: 3000,
        });
      }, 150);
    } catch (e) {
      console.error('Logout error:', e);
      Toast.show({
        type: 'error',
        text1: 'Logout Error',
        text2: e.message || 'Failed to logout',
      });
    }
  };

  const resetPassword = async (email) => {
    throw new Error("Password reset flow is handled by backend API");
  };

  const verifyRecoveryOtpAndUpdatePassword = async (email, otp, newPassword) => {
    throw new Error("Password reset flow is handled by backend API");
  };

  return (
    <AuthContext.Provider
      value={{ user, role, initializing, silentLogin, finalizeLogin, logout, resetPassword, verifyRecoveryOtpAndUpdatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
