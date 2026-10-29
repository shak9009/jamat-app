import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Modal } from 'react-native';
import { API_URL } from '../../config/apiConfig';
import { supabase } from '../../config/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Image as ExpoImage } from 'expo-image';

export default function CreateAdminScreen({ navigation }) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredAdmins, setRegisteredAdmins] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  const [assignedMasjidId, setAssignedMasjidId] = useState(null);
  
  const [masjids, setMasjids] = useState([]);
  const [showMasjidSelector, setShowMasjidSelector] = useState(false);
  const [isEditingMasjidSelector, setIsEditingMasjidSelector] = useState(false);
  
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [showUsers, setShowUsers] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);

  // Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState(''); // Optional for update
  const [editAssignedMasjidId, setEditAssignedMasjidId] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  
  const [editImageUri, setEditImageUri] = useState(null);
  const [editImageBase64, setEditImageBase64] = useState(null);



  const uploadImage = async (base64String) => {
    try {
      const formData = new FormData();
      formData.append('image', base64String);
      
      const imgbbKey = process.env.EXPO_PUBLIC_IMGBB_API_KEY;
      if (!imgbbKey || imgbbKey === 'PASTE_YOUR_API_KEY_HERE') throw new Error('ImgBB API key is missing from .env');

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
      throw new Error('Failed to upload image. Check ImgBB API Key.');
    }
  };

  const pickImage = async (isCamera = false, isEdit = false) => {
    try {
      let result;
      if (isCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return Alert.alert('Permission Denied', 'Camera permission is required.');
        result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return Alert.alert('Permission Denied', 'Gallery permission is required.');
        result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (isEdit) {
          setEditImageUri(result.assets[0].uri);
          setEditImageBase64(result.assets[0].base64);
        } else {
          setImageUri(result.assets[0].uri);
          setImageBase64(result.assets[0].base64);
        }
      }
    } catch (e) {
      console.error('Pick image error', e);
    }
  };

  const handleImageOption = (isEdit = false) => {
    Alert.alert('Profile Picture', 'Choose an option', [
      { text: 'Take Photo', onPress: () => pickImage(true, isEdit) },
      { text: 'Choose from Gallery', onPress: () => pickImage(false, isEdit) },
      isEdit && { text: 'Remove Photo', onPress: () => { setEditImageUri(null); setEditImageBase64(null); }, style: 'destructive' },
      { text: 'Cancel', style: 'cancel' }
    ].filter(Boolean));
  };

  useEffect(() => {
    fetchAdmins();
    fetchUsers();
    fetchMasjids();
  }, []);

  const fetchMasjids = async () => {
    try {
      const { data, error } = await supabase.from('masjids').select('id, name');
      if (error) throw error;
      setMasjids(data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchAdmins = async () => {
    try {
      setDataLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'admin')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setRegisteredAdmins(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'user')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setRegisteredUsers(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!name || !email || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error('Not authenticated');

      let finalImageUrl = null;
      if (imageBase64) {
        finalImageUrl = await uploadImage(imageBase64);
      }

      const response = await fetch(`${API_URL}/api/admin/create-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name: (name || '').trim(), 
          mobile: (mobile || '').trim(), 
          email: (email || '').trim().toLowerCase(), 
          password,
          imageUrl: finalImageUrl,
          assignedMasjidId
        })
      });

      let data;
      try { data = await response.json(); } catch (err) { throw new Error('Server returned an invalid response.'); }
      if (!response.ok) throw new Error(data?.error || 'Failed to create admin');

      Alert.alert('Success', 'Admin created successfully.');
      setName(''); setMobile(''); setEmail(''); setPassword(''); setAssignedMasjidId(null);
      setImageUri(null); setImageBase64(null);
      fetchAdmins();
      
    } catch (error) {
      console.error("Frontend Error (Create Admin):", error);
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdmin = (adminId) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to completely delete this admin? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const response = await fetch(`${API_URL}/api/admin/delete-admin/${adminId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            Alert.alert('Success', 'Admin deleted successfully.');
            fetchAdmins();
          } catch (error) {
            Alert.alert('Error', error.message);
          }
      }}
    ]);
  };

  const openEditModal = (admin) => {
    setEditingAdmin(admin);
    setEditName(admin.name || '');
    setEditMobile(admin.phone || '');
    setEditEmail(admin.email || '');
    setEditPassword(''); // Leave empty, only update if typed
    setEditAssignedMasjidId(admin.assigned_masjid_id || null);
    setEditImageUri(admin.image_url || null);
    setEditImageBase64(null);
    setEditModalVisible(true);
  };

  const handleUpdateAdmin = async () => {
    if (!editName || !editEmail) {
      Alert.alert('Missing fields', 'Name and Email are required.');
      return;
    }

    setEditLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      let finalImageUrl = editImageUri;
      if (editImageBase64) {
        finalImageUrl = await uploadImage(editImageBase64);
      }

      const response = await fetch(`${API_URL}/api/admin/update-admin/${editingAdmin.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name: editName.trim(), 
          mobile: editMobile.trim(), 
          email: editEmail.trim().toLowerCase(), 
          password: editPassword ? editPassword : undefined,
          imageUrl: finalImageUrl,
          assignedMasjidId: editAssignedMasjidId
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      Alert.alert('Success', 'Admin updated successfully.');
      setEditModalVisible(false);
      fetchAdmins();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      
      {/* Create Admin Form */}
      <View style={styles.formContainer}>
        <Text style={styles.title}>Create New Admin</Text>
        
        <TouchableOpacity style={styles.avatarPicker} onPress={() => handleImageOption(false)}>
          {imageUri ? (
            <ExpoImage source={{ uri: imageUri }} style={styles.avatarImage} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarIcon}>📷</Text>
              <Text style={styles.avatarText}>Add Photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.inputWrapper}><TextInput style={styles.input} placeholder="Name" placeholderTextColor="#aaa" value={name} onChangeText={setName} /></View>
        <View style={styles.inputWrapper}><TextInput style={styles.input} placeholder="Mobile Number" placeholderTextColor="#aaa" keyboardType="phone-pad" value={mobile} onChangeText={setMobile} /></View>
        <View style={styles.inputWrapper}><TextInput style={styles.input} placeholder="Email" placeholderTextColor="#aaa" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} /></View>
        <View style={styles.inputWrapper}><TextInput style={styles.input} placeholder="Password" placeholderTextColor="#aaa" secureTextEntry value={password} onChangeText={setPassword} /></View>
        
        <TouchableOpacity style={styles.masjidSelector} onPress={() => { setIsEditingMasjidSelector(false); setShowMasjidSelector(true); }}>
          <Text style={[styles.masjidSelectorText, !assignedMasjidId && { color: '#aaa' }]}>
            {assignedMasjidId ? masjids.find(m => m.id === assignedMasjidId)?.name || 'Masjid Selected' : 'Select Assigned Masjid (Optional)'}
          </Text>
          <Text style={styles.masjidSelectorIcon}>▼</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleCreateAdmin} disabled={loading} activeOpacity={0.8}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Admin</Text>}
        </TouchableOpacity>
      </View>

      {/* Registered Admins List */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionIcon}>📋</Text>
          <Text style={styles.sectionTitle}>Registered Admins ({registeredAdmins.length})</Text>
        </View>
        
        <View style={styles.adminsGrid}>
          {dataLoading ? (
            <ActivityIndicator color="#1b6b3c" style={{ marginTop: 20, alignSelf: 'center', width: '100%' }} />
          ) : (
            registeredAdmins.map(admin => (
              <View key={admin.id} style={styles.adminProfileCard}>
                <View style={styles.adminAvatar}>
                  {admin.image_url ? (
                    <ExpoImage source={{ uri: admin.image_url }} style={styles.avatarImageSmall} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <Text style={styles.adminAvatarText}>{admin.name ? admin.name.charAt(0).toUpperCase() : 'A'}</Text>
                  )}
                </View>
                <Text style={styles.adminName} numberOfLines={1}>{admin.name}</Text>
                {admin.assigned_masjid_id && (
                  <Text style={styles.adminMasjidName} numberOfLines={1}>
                    {masjids.find(m => m.id === admin.assigned_masjid_id)?.name || 'Unknown Masjid'}
                  </Text>
                )}
                <Text style={styles.adminPhone}>{admin.phone || 'No phone'}</Text>
                <Text style={styles.adminDate}>Joined: {admin.created_at || admin.createdAt ? new Date(admin.created_at || admin.createdAt).toLocaleDateString() : 'Unknown Date'}</Text>
                
                {/* Action Buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.actionBtnEdit} onPress={() => openEditModal(admin)}>
                    <Text style={styles.actionIcon}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtnDelete} onPress={() => handleDeleteAdmin(admin.id)}>
                    <Text style={styles.actionIcon}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
          {registeredAdmins.length === 0 && !dataLoading && (
            <Text style={styles.emptyText}>No admins registered yet.</Text>
          )}
        </View>
      </View>

      {/* Registered Users Dropdown */}
      <View style={[styles.sectionContainer, { marginTop: 30 }]}>
        <TouchableOpacity 
          style={styles.dropdownHeader} 
          onPress={() => setShowUsers(!showUsers)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.sectionIcon}>👥</Text>
            <Text style={styles.sectionTitle}>Registered Users ({registeredUsers.length})</Text>
          </View>
          <Text style={{ fontSize: 18, color: '#1b6b3c', fontWeight: 'bold' }}>
            {showUsers ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {showUsers && (
          <View style={[styles.adminsGrid, { marginTop: 15 }]}>
            {usersLoading ? (
              <ActivityIndicator color="#1b6b3c" style={{ marginTop: 20, alignSelf: 'center', width: '100%' }} />
            ) : (
              registeredUsers.map(user => (
                <View key={user.id} style={styles.adminProfileCard}>
                  <View style={styles.adminAvatar}>
                    {user.image_url ? (
                      <ExpoImage source={{ uri: user.image_url }} style={styles.avatarImageSmall} contentFit="cover" cachePolicy="memory-disk" />
                    ) : (
                      <Text style={styles.adminAvatarText}>{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</Text>
                    )}
                  </View>
                  <Text style={styles.adminName} numberOfLines={1}>{user.name || 'No Name'}</Text>
                  <Text style={styles.adminPhone}>{user.phone || 'No phone'}</Text>
                  <Text style={styles.adminDate}>Joined: {user.created_at || user.createdAt ? new Date(user.created_at || user.createdAt).toLocaleDateString() : 'Unknown Date'}</Text>
                </View>
              ))
            )}
            {registeredUsers.length === 0 && !usersLoading && (
              <Text style={styles.emptyText}>No users registered yet.</Text>
            )}
          </View>
        )}
      </View>

      {/* Edit Admin Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Admin</Text>
            
            <TouchableOpacity style={styles.avatarPickerModal} onPress={() => handleImageOption(true)}>
              {editImageUri ? (
                <ExpoImage source={{ uri: editImageUri }} style={styles.avatarImageModal} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View style={styles.avatarPlaceholderModal}>
                  <Text style={styles.avatarIcon}>📷</Text>
                  <Text style={styles.avatarText}>Update Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.label}>Name</Text>
            <View style={styles.inputWrapper}><TextInput style={styles.input} value={editName} onChangeText={setEditName} /></View>
            
            <Text style={styles.label}>Mobile</Text>
            <View style={styles.inputWrapper}><TextInput style={styles.input} value={editMobile} onChangeText={setEditMobile} keyboardType="phone-pad" /></View>
            
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}><TextInput style={styles.input} value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" autoCapitalize="none" /></View>
            
            <Text style={styles.label}>New Password (Optional)</Text>
            <View style={styles.inputWrapper}><TextInput style={styles.input} value={editPassword} onChangeText={setEditPassword} secureTextEntry placeholder="Leave blank to keep current password" placeholderTextColor="#aaa" /></View>
            
            <Text style={styles.label}>Assigned Masjid</Text>
            <TouchableOpacity style={[styles.masjidSelector, { marginBottom: 5 }]} onPress={() => { setIsEditingMasjidSelector(true); setShowMasjidSelector(true); }}>
              <Text style={[styles.masjidSelectorText, !editAssignedMasjidId && { color: '#aaa' }]}>
                {editAssignedMasjidId ? masjids.find(m => m.id === editAssignedMasjidId)?.name || 'Masjid Selected' : 'Select Assigned Masjid (Optional)'}
              </Text>
              <Text style={styles.masjidSelectorIcon}>▼</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleUpdateAdmin} disabled={editLoading}>
                {editLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnSaveText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Masjid Selector Modal */}
      <Modal visible={showMasjidSelector} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Select Masjid</Text>
            
            <TouchableOpacity 
              style={styles.masjidOption} 
              onPress={() => {
                if (isEditingMasjidSelector) setEditAssignedMasjidId(null);
                else setAssignedMasjidId(null);
                setShowMasjidSelector(false);
              }}
            >
              <Text style={styles.masjidOptionText}>None (No Masjid Assigned)</Text>
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
              {masjids.map(m => (
                <TouchableOpacity 
                  key={m.id} 
                  style={styles.masjidOption} 
                  onPress={() => {
                    if (isEditingMasjidSelector) setEditAssignedMasjidId(m.id);
                    else setAssignedMasjidId(m.id);
                    setShowMasjidSelector(false);
                  }}
                >
                  <Text style={styles.masjidOptionText}>{m.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.modalBtnCancel, { width: '100%', marginTop: 15 }]} onPress={() => setShowMasjidSelector(false)}>
              <Text style={styles.modalBtnCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f9f5' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  
  formContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3, marginBottom: 25 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 20, color: '#1b6b3c', textAlign: 'center' },
  inputWrapper: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, backgroundColor: '#fafafa' },
  input: { height: 52, fontSize: 16, color: '#333' },
  button: { backgroundColor: '#1b6b3c', borderRadius: 12, height: 52, justifyContent: 'center', alignItems: 'center', marginTop: 5, shadowColor: '#1b6b3c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },

  // Registered Admins Grid
  sectionContainer: { marginTop: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 },
  dropdownHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#e0f0e3', paddingVertical: 12, borderRadius: 10, paddingLeft: 10, paddingRight: 15 },
  sectionIcon: { fontSize: 22, marginRight: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#222' },
  
  adminsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  adminProfileCard: { width: '48%', backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: '#f0f0f0' },
  adminAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#e0f0e3', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  adminAvatarText: { fontSize: 26, fontWeight: '900', color: '#1b6b3c' },
  adminName: { fontSize: 15, fontWeight: '700', color: '#222', textAlign: 'center', marginBottom: 2 },
  adminMasjidName: { fontSize: 11, fontWeight: '600', color: '#1b6b3c', textAlign: 'center', marginBottom: 4, backgroundColor: '#eef6f0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  adminPhone: { fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 6, fontWeight: '500' },
  adminDate: { fontSize: 11, color: '#aaa', textAlign: 'center', marginBottom: 15 },
  
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  actionBtnEdit: { backgroundColor: '#e0f0e3', padding: 8, borderRadius: 8 },
  actionBtnDelete: { backgroundColor: '#ffe5e5', padding: 8, borderRadius: 8 },
  actionIcon: { fontSize: 16 },
  
  emptyText: { color: '#888', fontSize: 14, fontStyle: 'italic', padding: 10, textAlign: 'center', width: '100%' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', width: '100%', borderRadius: 16, padding: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#333', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 5, marginLeft: 5 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  modalBtnCancel: { width: '48%', paddingVertical: 14, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
  modalBtnCancelText: { color: '#555', fontWeight: 'bold' },
  modalBtnSave: { width: '48%', paddingVertical: 14, borderRadius: 10, backgroundColor: '#1b6b3c', alignItems: 'center' },
  modalBtnSaveText: { color: '#fff', fontWeight: 'bold' },

  // Avatar Picker Styles
  avatarPicker: { alignSelf: 'center', marginBottom: 20, width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0f0f0', overflow: 'hidden', borderWidth: 2, borderColor: '#1b6b3c', justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarIcon: { fontSize: 30, marginBottom: 5 },
  avatarText: { fontSize: 12, color: '#666', fontWeight: '600' },
  
  avatarImageSmall: { width: '100%', height: '100%', borderRadius: 30 },
  
  avatarPickerModal: { alignSelf: 'center', marginBottom: 15, width: 90, height: 90, borderRadius: 45, backgroundColor: '#f0f0f0', overflow: 'hidden', borderWidth: 2, borderColor: '#1b6b3c', justifyContent: 'center', alignItems: 'center' },
  avatarImageModal: { width: '100%', height: '100%' },
  avatarPlaceholderModal: { justifyContent: 'center', alignItems: 'center' },

  masjidSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 15, height: 52, backgroundColor: '#fafafa', marginBottom: 15 },
  masjidSelectorText: { fontSize: 16, color: '#333' },
  masjidSelectorIcon: { fontSize: 12, color: '#666' },
  masjidOption: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  masjidOptionText: { fontSize: 16, color: '#333' }
});
