import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from 'react-native-toast-message';

const RefreshContext = createContext({
  refreshKey: 0,
  isRefreshing: false,
  refreshApp: () => {},
});

export const RefreshProvider = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshApp = useCallback(() => {
    setIsRefreshing(true);
    // Incrementing refreshKey remounts the app navigator & re-triggers all screen useEffects
    setRefreshKey(prev => prev + 1);

    Toast.show({
      type: 'success',
      text1: 'App Refreshed',
      text2: 'Latest data & screens reloaded.',
      position: 'top',
      visibilityTime: 1800,
    });

    setTimeout(() => {
      setIsRefreshing(false);
    }, 700);
  }, []);

  return (
    <RefreshContext.Provider value={{ refreshKey, isRefreshing, refreshApp }}>
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefresh = () => useContext(RefreshContext);

