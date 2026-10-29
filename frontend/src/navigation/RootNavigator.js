import React from 'react';
import { ActivityIndicator, View, Text, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPasswordScreen';
import ResetPasswordOtpScreen from '../screens/Auth/ResetPasswordOtpScreen';

import HomeScreen from '../screens/Home/HomeScreen';
import EventsScreen from '../screens/Events/EventsScreen';
import AskQuestionsScreen from '../screens/Questions/AskQuestionsScreen';
import DonationScreen from '../screens/Donation/DonationScreen';
import AdminDashboardScreen from '../screens/Admin/AdminDashboardScreen';
import MasterAdminDashboardScreen from '../screens/Admin/MasterAdminDashboardScreen';
import SettingsScreen from '../screens/Admin/SettingsScreen';
import ManageMasjidScreen from '../screens/Admin/ManageMasjidScreen';
import MasjidScreen from '../screens/Masjid/MasjidScreen';
import CreateAdminScreen from '../screens/Admin/CreateAdminScreen';
import ChatScreen from '../screens/Questions/ChatScreen';
import SubmitRequestScreen from '../screens/Requests/SubmitRequestScreen';
import ManageRequestsScreen from '../screens/Admin/ManageRequestsScreen';
import ManageUsersScreen from '../screens/Admin/ManageUsersScreen';
import BecomeAdminScreen from '../screens/Requests/BecomeAdminScreen';
import CustomHeader from '../components/CustomHeader';

const Stack = createNativeStackNavigator();

function AuthFlow() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPasswordOtp" component={ResetPasswordOtpScreen} />
    </Stack.Navigator>
  );
}

import UlamasAndBayansScreen from '../screens/Home/UlamasAndBayansScreen';

function UserFlow() {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        header: ({ back }) => <CustomHeader back={back} />,
        headerShown: true
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Events" component={EventsScreen} />
      <Stack.Screen name="AskQuestions" component={AskQuestionsScreen} />
      <Stack.Screen name="ChatScreen" component={ChatScreen} options={({ route }) => ({ title: route.params?.chatUserName || 'Chat', header: undefined })} />
      <Stack.Screen name="Donation" component={DonationScreen} />
      <Stack.Screen name="Masjid" component={MasjidScreen} />
      <Stack.Screen name="SubmitRequest" component={SubmitRequestScreen} />
      <Stack.Screen name="BecomeAdmin" component={BecomeAdminScreen} />
      <Stack.Screen name="UlamasAndBayans" component={UlamasAndBayansScreen} />
    </Stack.Navigator>
  );
}

import ManageUlamasScreen from '../screens/Admin/ManageUlamasScreen';

function AdminFlow() {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        header: ({ back }) => <CustomHeader back={back} />,
        headerShown: true
      }}
    >
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="ManageMasjid" component={ManageMasjidScreen} />
      <Stack.Screen name="ManageUlamas" component={ManageUlamasScreen} />
      <Stack.Screen name="Events" component={EventsScreen} />
      <Stack.Screen name="AskQuestions" component={AskQuestionsScreen} />
      <Stack.Screen name="ChatScreen" component={ChatScreen} options={({ route }) => ({ title: route.params?.chatUserName || 'Chat', header: undefined })} />
      <Stack.Screen name="Donation" component={DonationScreen} />
      <Stack.Screen name="SubmitRequest" component={SubmitRequestScreen} />
      <Stack.Screen name="BecomeAdmin" component={BecomeAdminScreen} />
    </Stack.Navigator>
  );
}

function MasterAdminFlow() {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        header: ({ back }) => <CustomHeader back={back} />,
        headerShown: true
      }}
    >
      <Stack.Screen name="MasterAdminDashboard" component={MasterAdminDashboardScreen} />
      <Stack.Screen name="CreateAdmin" component={CreateAdminScreen} />
      <Stack.Screen name="ManageUlamas" component={ManageUlamasScreen} />
      <Stack.Screen name="Events" component={EventsScreen} />
      <Stack.Screen name="AskQuestions" component={AskQuestionsScreen} />
      <Stack.Screen name="ChatScreen" component={ChatScreen} options={({ route }) => ({ title: route.params?.chatUserName || 'Chat', header: undefined })} />
      <Stack.Screen name="Donation" component={DonationScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="ManageMasjid" component={ManageMasjidScreen} />
      <Stack.Screen name="ManageRequests" component={ManageRequestsScreen} />
      <Stack.Screen name="SubmitRequest" component={SubmitRequestScreen} />
      <Stack.Screen name="BecomeAdmin" component={BecomeAdminScreen} />
      <Stack.Screen name="ManageUsers" component={ManageUsersScreen} />
    </Stack.Navigator>
  );
}

const SkeletonScreen = () => (
  <View style={{ flex: 1, backgroundColor: '#f4f9f5', padding: 20, paddingTop: 60 }}>
    <View style={{ height: 60, backgroundColor: '#e0e0e0', borderRadius: 10, marginBottom: 20, opacity: 0.5 }} />
    <View style={{ height: 120, backgroundColor: '#e0e0e0', borderRadius: 15, marginBottom: 20, opacity: 0.5 }} />
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
      <View style={{ height: 100, width: '48%', backgroundColor: '#e0e0e0', borderRadius: 15, opacity: 0.5 }} />
      <View style={{ height: 100, width: '48%', backgroundColor: '#e0e0e0', borderRadius: 15, opacity: 0.5 }} />
    </View>
    <View style={{ height: 80, backgroundColor: '#e0e0e0', borderRadius: 10, marginBottom: 15, opacity: 0.5 }} />
    <View style={{ height: 80, backgroundColor: '#e0e0e0', borderRadius: 10, opacity: 0.5 }} />
  </View>
);

export default function RootNavigator() {
  const { user, initializing, role } = useAuth();
  const { globalSettings } = useSettings();

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text style={{ color: '#1b6b3c', fontSize: 32, fontWeight: 'bold', fontFamily: 'Amiri_700Bold', marginBottom: 40, textAlign: 'center', paddingHorizontal: 20 }}>
          {globalSettings?.splash_text || 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'}
        </Text>
        <Image 
          source={globalSettings?.logo_url ? { uri: globalSettings.logo_url } : require('../../assets/JamatLogo.png')} 
          style={{ width: 180, height: 180, marginBottom: 40 }} 
          resizeMode="contain" 
        />
        <ActivityIndicator size="large" color="#1b6b3c" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? <AuthFlow /> :
       !role ? <SkeletonScreen /> :
       role === 'master_admin' ? <MasterAdminFlow /> :
       role === 'admin' ? <AdminFlow /> :
       <UserFlow />}
    </NavigationContainer>
  );
}
