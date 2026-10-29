import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../config/supabaseClient';

const SettingsContext = createContext({});

export const SettingsProvider = ({ children }) => {
  const [globalSettings, setGlobalSettings] = useState({
    app_name: 'JamaitApp',
    splash_text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    logo_url: null
  });

  const fetchSettings = async () => {
    try {
      const { data: docSnap, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', '1')
        .single();
      
      if (!error && docSnap) {
        setGlobalSettings({ id: docSnap.id, ...docSnap });
      }
    } catch (err) {
      console.warn('Error fetching global settings:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ globalSettings, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
