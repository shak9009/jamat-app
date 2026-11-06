import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_URL = (rawUrl && !rawUrl.includes('YOUR_') && rawUrl.startsWith('http'))
  ? rawUrl
  : 'https://mrcjmbvzrnhaiigschzt.supabase.co';

const rawKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_ANON_KEY = (rawKey && !rawKey.includes('YOUR_') && rawKey.startsWith('eyJ'))
  ? rawKey
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yY2ptYnZ6cm5oYWlpZ3NjaHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1ODU5NjIsImV4cCI6MjEwMjE2MTk2Mn0.BoZ_nHnBLPYZqn358LVVp6ZsB7Pl-8-7WBZtEkP9ZOc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
