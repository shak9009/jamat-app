import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, ScrollView, Modal, FlatList } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../config/supabaseClient';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export default function SettingsScreen({ navigation }) {
  const { globalSettings, refreshSettings } = useSettings();
  const { user } = useAuth();
  const [appName, setAppName] = useState('');
  const [logoUri, setLogoUri] = useState(null);
  const [logoBase64, setLogoBase64] = useState(null);
  const [dailyApiLimit, setDailyApiLimit] = useState('500');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [adminName, setAdminName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminAadhaar, setAdminAadhaar] = useState('');
  const [adminImageUri, setAdminImageUri] = useState(null);
  const [adminImageBase64, setAdminImageBase64] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // System Logs States
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Board Members States
  const [boardModalVisible, setBoardModalVisible] = useState(false);
  const [boardMembers, setBoardMembers] = useState([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  
  const [boardName, setBoardName] = useState('');
  const [boardDesignation, setBoardDesignation] = useState('');
  const [boardPhone, setBoardPhone] = useState('');
  const [boardImageUri, setBoardImageUri] = useState(null);
  const [boardImageBase64, setBoardImageBase64] = useState(null);
  const [addingBoardMember, setAddingBoardMember] = useState(false);
  const [editingBoardMemberId, setEditingBoardMemberId] = useState(null);

  const uploadImageToImgbb = async (base64String) => {
    try {
      const formData = new FormData();
      formData.append('image', base64String);

      const imgbbKey = process.env.EXPO_PUBLIC_IMGBB_API_KEY;
      if (!imgbbKey || imgbbKey === 'PASTE_YOUR_API_KEY_HERE') {
        throw new Error('ImgBB API key is missing from .env');
      }

      const uploadRes = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const result = await uploadRes.json();
      if (result.success) {
        return result.data.url;
      } else {
        throw new Error(result.error?.message || 'ImgBB upload failed');
      }
    } catch (e) {
      console.error('Image upload failed', e);
      throw new Error('Failed to upload image. Please try again.');
    }
  };

  useEffect(() => {
    if (globalSettings) {
      setAppName(globalSettings.app_name || '');
      setLogoUri(globalSettings.logo_url || null);
      if (globalSettings.value && globalSettings.value.daily_api_limit) {
        setDailyApiLimit(globalSettings.value.daily_api_limit.toString());
      }
    }
  }, [globalSettings]);

  useEffect(() => {
    const loadProfile = async () => {
      if (user) {
        setAdminName(user.user_metadata?.name || user.name || '');
        try {
          const { data: supaUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
          if (supaUser) {
            if (supaUser.phone) setAdminPhone(supaUser.phone);
            if (supaUser.aadhaar) setAdminAadhaar(supaUser.aadhaar);
            if (supaUser.image_url) setAdminImageUri(supaUser.image_url);
          }
        } catch (e) {
          console.warn('Load profile error:', e);
        }
      }
    };
    loadProfile();
  }, [user]);

  const handlePickAdminImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled) {
        setAdminImageUri(result.assets[0].uri);
        setAdminImageBase64(result.assets[0].base64);
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to pick image' });
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled) {
        setLogoUri(result.assets[0].uri);
        setLogoBase64(result.assets[0].base64);
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to pick image' });
    }
  };

  const handleSave = async () => {
    if (!appName.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'App Name cannot be empty.' });
      return;
    }

    setLoading(true);
    try {
      let finalLogoUrl = logoUri;

      // Upload if it's a local file
      if (logoUri && !logoUri.startsWith('http') && logoBase64) {
        setUploading(true);
        finalLogoUrl = await uploadImageToImgbb(logoBase64);
        setUploading(false);
      }

      // Keep existing values in JSON and merge new ones
      const existingValue = globalSettings?.value || {};
      const updatedValue = { ...existingValue, daily_api_limit: parseInt(dailyApiLimit) || 500 };

      // Update Database via Supabase
      const { error: upsertError } = await supabase
        .from('app_settings')
        .upsert({
          id: '1',
          app_name: appName,
          logo_url: finalLogoUrl,
          value: updatedValue,
          updated_at: new Date().toISOString()
        });

      if (upsertError) throw upsertError;

      await refreshSettings(); // Update context
      Toast.show({ type: 'success', text1: 'Success', text2: 'Settings updated successfully.' });
      navigation.goBack();
    } catch (err) {
      console.error(err);
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to save settings.' });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      let finalImageUrl = adminImageUri;
      if (adminImageUri && !adminImageUri.startsWith('http') && adminImageBase64) {
        finalImageUrl = await uploadImageToImgbb(adminImageBase64);
      }

      const updates = {
         name: adminName.trim(),
         phone: adminPhone.trim(),
         aadhaar: adminAadhaar.trim(),
      };
      if (finalImageUrl) updates.image_url = finalImageUrl;

      const { error: userUpdateError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (userUpdateError) throw userUpdateError;

      if (adminPassword.trim()) {
        const { error: pwError } = await supabase.auth.updateUser({ password: adminPassword.trim() });
        if (pwError) throw pwError;
      }

      Toast.show({ type: 'success', text1: 'Success', text2: 'Profile updated successfully.' });
      setAdminPassword('');
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const fetchLogs = async () => {
    setLogsModalVisible(true);
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error fetching logs', text2: err.message });
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchBoardMembers = async () => {
    setBoardModalVisible(true);
    setLoadingBoard(true);
    try {
      const { data, error } = await supabase
        .from('board_members')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setBoardMembers(data || []);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error fetching members', text2: err.message });
    } finally {
      setLoadingBoard(false);
    }
  };

  const handlePickBoardImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled) {
        setBoardImageUri(result.assets[0].uri);
        setBoardImageBase64(result.assets[0].base64);
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to pick image' });
    }
  };

  const handleAddBoardMember = async () => {
    if (!boardName.trim() || !boardDesignation.trim()) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Name and Designation are required.' });
      return;
    }
    
    setAddingBoardMember(true);
    try {
      let finalImageUrl = null;
      if (boardImageBase64) {
        finalImageUrl = await uploadImageToImgbb(boardImageBase64);
      }
      
      const payload = {
        name: boardName.trim(),
        designation: boardDesignation.trim(),
        phone: boardPhone.trim()
      };
      if (finalImageUrl) payload.image_url = finalImageUrl;

      if (editingBoardMemberId) {
        const { error } = await supabase
          .from('board_members')
          .update(payload)
          .eq('id', editingBoardMemberId);
        if (error) throw error;
        Toast.show({ type: 'success', text1: 'Success', text2: 'Board member updated successfully!' });
      } else {
        const { error } = await supabase
          .from('board_members')
          .insert([payload]);
        if (error) throw error;
        Toast.show({ type: 'success', text1: 'Success', text2: 'Board member added successfully!' });
      }
      
      setBoardName('');
      setBoardDesignation('');
      setBoardPhone('');
      setBoardImageUri(null);
      setBoardImageBase64(null);
      setEditingBoardMemberId(null);
      
      // Refresh list
      const { data } = await supabase
        .from('board_members')
        .select('*')
        .order('created_at', { ascending: true });
      setBoardMembers(data || []);
      
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    } finally {
      setAddingBoardMember(false);
    }
  };

  const handleDeleteBoardMember = (id) => {
    Alert.alert('Confirm', 'Are you sure you want to delete this board member?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase
              .from('board_members')
              .delete()
              .eq('id', id);
            if (error) throw error;
            setBoardMembers(prev => prev.filter(m => m.id !== id));
          } catch (err) {
            Toast.show({ type: 'error', text1: 'Error', text2: err.message });
          }
        }
      }
    ]);
  };

  const handleEditBoardMember = (member) => {
    setEditingBoardMemberId(member.id);
    setBoardName(member.name);
    setBoardDesignation(member.designation);
    setBoardPhone(member.phone || '');
    setBoardImageUri(member.image_url || null);
    setBoardImageBase64(null); // Clear base64 since we're using remote URL until changed
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Settings</Text>

      {/* App Settings Card */}
      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>App Configuration</Text>
        <Text style={styles.label}>App Logo</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage} activeOpacity={0.8}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.logoImage} />
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderIcon}>📸</Text>
              <Text style={styles.placeholderText}>Tap to select logo</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>App Name</Text>
        <TextInput
          style={styles.input}
          value={appName}
          onChangeText={setAppName}
          placeholder="Enter App Name"
          placeholderTextColor="#aaa"
        />

        <Text style={styles.label}>Daily Request Limit (per user)</Text>
        <TextInput
          style={styles.input}
          value={dailyApiLimit}
          onChangeText={setDailyApiLimit}
          placeholder="e.g. 500"
          placeholderTextColor="#aaa"
          keyboardType="numeric"
        />

        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.disabledBtn]} 
          onPress={handleSave} 
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{uploading ? 'Uploading...' : 'Save App Settings'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>My Profile</Text>

        <TouchableOpacity style={styles.boardImagePicker} onPress={handlePickAdminImage} activeOpacity={0.8}>
          {adminImageUri ? (
            <Image source={{ uri: adminImageUri }} style={styles.boardAvatar} />
          ) : (
            <Text style={styles.placeholderIcon}>📷</Text>
          )}
        </TouchableOpacity>
        <Text style={[styles.label, { textAlign: 'center', marginBottom: 15 }]}>Profile Photo</Text>

        <Text style={styles.label}>Username</Text>
        <TextInput 
          style={styles.input} 
          value={adminName} 
          onChangeText={setAdminName} 
          placeholder="Enter your name" 
          placeholderTextColor="#aaa"
        />

        <Text style={styles.label}>Mobile Number</Text>
        <TextInput 
          style={styles.input} 
          value={adminPhone} 
          onChangeText={setAdminPhone} 
          placeholder="Enter your mobile number" 
          placeholderTextColor="#aaa"
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Aadhaar Number</Text>
        <TextInput 
          style={styles.input} 
          value={adminAadhaar} 
          onChangeText={setAdminAadhaar} 
          placeholder="Enter your 12-digit Aadhaar" 
          placeholderTextColor="#aaa"
          keyboardType="numeric"
          maxLength={12}
        />

        <Text style={styles.label}>New Password (Optional)</Text>
        <TextInput 
          style={styles.input} 
          value={adminPassword} 
          onChangeText={setAdminPassword} 
          secureTextEntry 
          placeholder="Enter new password" 
          placeholderTextColor="#aaa"
        />

        <TouchableOpacity 
          style={[styles.saveButton, savingProfile && styles.disabledBtn]} 
          onPress={handleSaveProfile} 
          disabled={savingProfile}
          activeOpacity={0.8}
        >
          {savingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Update Profile</Text>}
        </TouchableOpacity>
      </View>

      {/* Manage Board Members Button */}
      <TouchableOpacity style={styles.logsButton} onPress={fetchBoardMembers} activeOpacity={0.8}>
        <Text style={styles.logsButtonText}>👥 Manage Board Members</Text>
      </TouchableOpacity>

      {/* System Logs Button */}
      <TouchableOpacity style={styles.logsButton} onPress={fetchLogs} activeOpacity={0.8}>
        <Text style={styles.logsButtonText}>📄 View System Logs</Text>
      </TouchableOpacity>

      {/* Logs Modal */}
      <Modal visible={logsModalVisible} animationType="slide" onRequestClose={() => setLogsModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>System Logs</Text>
            <TouchableOpacity onPress={() => setLogsModalVisible(false)} style={styles.closeBtn}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
          
          {loadingLogs ? (
            <ActivityIndicator size="large" color="#1b6b3c" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={logs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 15 }}
              renderItem={({ item }) => (
                <View style={styles.logCard}>
                  <Text style={styles.logAction}>{item.action}</Text>
                  <Text style={styles.logAdmin}>By: {item.admin_email || 'Unknown'}</Text>
                  <Text style={styles.logDate}>{item.created_at || item.createdAt ? new Date(item.created_at || item.createdAt).toLocaleString() : 'Unknown Date'}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: '#888' }}>No logs found.</Text>}
            />
          )}
        </View>
      </Modal>

      {/* Board Members Modal */}
      <Modal visible={boardModalVisible} animationType="slide" onRequestClose={() => setBoardModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Board Members</Text>
            <TouchableOpacity onPress={() => setBoardModalVisible(false)} style={styles.closeBtn}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>{editingBoardMemberId ? "Edit Member" : "Add New Member"}</Text>
              
              <TouchableOpacity style={styles.boardImagePicker} onPress={handlePickBoardImage} activeOpacity={0.8}>
                {boardImageUri ? (
                  <Image source={{ uri: boardImageUri }} style={styles.boardAvatar} />
                ) : (
                  <Text style={styles.placeholderIcon}>📷</Text>
                )}
              </TouchableOpacity>
              
              <TextInput style={styles.input} value={boardName} onChangeText={setBoardName} placeholder="Name" placeholderTextColor="#aaa" />
              <TextInput style={styles.input} value={boardDesignation} onChangeText={setBoardDesignation} placeholder="Designation (e.g. Treasurer)" placeholderTextColor="#aaa" />
              <TextInput style={[styles.input, {marginBottom: 15}]} value={boardPhone} onChangeText={setBoardPhone} placeholder="WhatsApp Number (with country code, e.g. +91...)" placeholderTextColor="#aaa" keyboardType="phone-pad" />
              
              <TouchableOpacity style={styles.saveButton} onPress={handleAddBoardMember} disabled={addingBoardMember}>
                {addingBoardMember ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{editingBoardMemberId ? "Update Member" : "Add Member"}</Text>}
              </TouchableOpacity>
              
              {editingBoardMemberId && (
                <TouchableOpacity 
                  style={[styles.saveButton, { backgroundColor: '#e74c3c', marginTop: 10 }]} 
                  onPress={() => {
                    setEditingBoardMemberId(null);
                    setBoardName('');
                    setBoardDesignation('');
                    setBoardPhone('');
                    setBoardImageUri(null);
                    setBoardImageBase64(null);
                  }}
                >
                  <Text style={styles.saveButtonText}>Cancel Edit</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <Text style={[styles.cardTitle, { marginTop: 10, marginBottom: 15 }]}>Current Members</Text>
            {loadingBoard ? (
              <ActivityIndicator size="large" color="#1b6b3c" />
            ) : boardMembers.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#888' }}>No members found.</Text>
            ) : (
              boardMembers.map(member => (
                <View key={member.id} style={styles.boardMemberCard}>
                  {member.image_url ? (
                    <Image source={{ uri: member.image_url }} style={styles.boardMemberAvatar} />
                  ) : (
                    <View style={[styles.boardMemberAvatar, { backgroundColor: '#eef6f0', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="person" size={24} color="#1b6b3c" />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 15 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#222' }}>{member.name}</Text>
                    <Text style={{ fontSize: 14, color: '#555' }}>{member.designation}</Text>
                    {member.phone ? <Text style={{ fontSize: 12, color: '#27ae60', marginTop: 2 }}>{member.phone}</Text> : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => handleEditBoardMember(member)} style={styles.actionIconButton}>
                      <Ionicons name="pencil" size={18} color="#3498db" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteBoardMember(member.id)} style={[styles.actionIconButton, { marginLeft: 8 }]}>
                      <Ionicons name="trash" size={18} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f9f5', padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#1b6b3c', marginBottom: 20, marginTop: 10, textAlign: 'center' },
  
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3,
    marginBottom: 25
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#222', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10 },
  label: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 8 },
  
  imagePicker: {
    height: 120,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden'
  },
  logoImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  placeholderContainer: { alignItems: 'center' },
  placeholderIcon: { fontSize: 32, marginBottom: 5 },
  placeholderText: { color: '#888', fontSize: 13 },
  
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 50,
    fontSize: 16,
    color: '#333',
    marginBottom: 25
  },
  
  saveButton: {
    backgroundColor: '#1b6b3c',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#1b6b3c', shadowOffset: { width:0, height:3 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
    marginTop: 10
  },
  disabledBtn: { opacity: 0.7 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  logsButton: {
    backgroundColor: '#eef6f9',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3498db',
    marginBottom: 20
  },
  logsButtonText: { color: '#3498db', fontSize: 16, fontWeight: '800' },

  // Modal Logs
  modalContainer: { flex: 1, backgroundColor: '#f4f9f5' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 40, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', elevation: 2 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1b6b3c' },
  closeBtn: { padding: 8, backgroundColor: '#f0f0f0', borderRadius: 8 },
  closeText: { color: '#333', fontWeight: 'bold' },
  logCard: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#3498db', elevation: 1 },
  logAction: { fontSize: 15, fontWeight: 'bold', color: '#222', marginBottom: 5 },
  logAdmin: { fontSize: 13, color: '#666', marginBottom: 3 },
  logDate: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  
  // Board Members styles
  boardImagePicker: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#ddd', overflow: 'hidden' },
  boardAvatar: { width: '100%', height: '100%', resizeMode: 'cover' },
  boardMemberCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 12, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
  boardMemberAvatar: { width: 50, height: 50, borderRadius: 25 },
  actionIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f1f1',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
