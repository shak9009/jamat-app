import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, StyleSheet, Image, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export default function EventsScreen() {
  const [events, setEvents] = useState([]);
  const { role, user } = useAuth();
  const isAdmin = role === 'admin' || role === 'master_admin';

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEvent, setCurrentEvent] = useState({ id: null, title: '', speaker_name: '', description: '', date: new Date(), image_url: '', eventType: 'city', masjid_id: null });
  const [uploading, setUploading] = useState(false);
  const [adminMasjidId, setAdminMasjidId] = useState(null);
  const [masjidsList, setMasjidsList] = useState([]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateMode, setDateMode] = useState('date');

  useEffect(() => {
    fetchEvents();
    if (role === 'admin') {
      fetchAdminMasjidId();
    } else if (role === 'master_admin') {
      fetchMasjidsList();
    }
  }, []);

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

  const fetchMasjidsList = async () => {
    try {
      const { data, error } = await supabase
        .from('masjids')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setMasjidsList(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAdminMasjidId = async () => {
    try {
      if (user?.assigned_masjid_id) {
        setAdminMasjidId(user.assigned_masjid_id);
        return;
      }
      if (user?.id) {
        const { data: supaUser } = await supabase
          .from('users')
          .select('assigned_masjid_id')
          .eq('id', user.id)
          .single();
        if (supaUser?.assigned_masjid_id) {
          setAdminMasjidId(supaUser.assigned_masjid_id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, masjids(*), users(*)')
        .order('date_time', { ascending: true });

      if (error) throw error;

      const formattedEvents = (data || []).map(d => ({
        ...d,
        masjids: Array.isArray(d.masjids) ? d.masjids[0] : (d.masjids || {}),
        users: Array.isArray(d.users) ? d.users[0] : (d.users || {})
      }));

      setEvents(formattedEvents);
    } catch (error) {
      console.error('Fetch Events Error:', error);
    }
  };

  const onDateChange = (event, selectedDate) => {
    const newDate = selectedDate || currentEvent.date;
    setShowDatePicker(Platform.OS === 'ios');
    setCurrentEvent({ ...currentEvent, date: newDate });
  };

  const showMode = (mode) => {
    setShowDatePicker(true);
    setDateMode(mode);
  };

  const handleImagePickOptions = () => {
    Alert.alert(
      "Select Image",
      "Choose an option",
      [
        { text: "Camera", onPress: takePhoto },
        { text: "Gallery", onPress: pickImageFromGallery },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const processImageResult = async (result) => {
    if (!result.canceled && result.assets[0]?.base64) {
      setUploading(true);
      try {
        Toast.show({ type: 'info', text1: 'Uploading...', text2: 'Uploading event poster' });
        const publicUrl = await uploadImageToImgbb(result.assets[0].base64);
        setCurrentEvent({ ...currentEvent, image_url: publicUrl });
        Toast.show({ type: 'success', text1: 'Uploaded', text2: 'Image uploaded successfully' });
      } catch (err) {
        Toast.show({ type: 'error', text1: 'Upload Error', text2: err.message });
      } finally {
        setUploading(false);
      }
    }
  };

  const pickImageFromGallery = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });
    processImageResult(result);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission needed', text2: 'Camera permission is required to take photos' });
      return;
    }
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });
    processImageResult(result);
  };

  const openAddModal = () => {
    setIsEditing(false);
    setCurrentEvent({ id: null, title: '', speaker_name: '', description: '', date: new Date(), image_url: '', eventType: 'city', masjid_id: null });
    setShowModal(true);
  };

  const openEditModal = (event) => {
    setIsEditing(true);
    setCurrentEvent({
      id: event.id,
      title: event.title,
      speaker_name: event.speaker_name || '',
      description: event.description || '',
      date: new Date(event.date_time),
      image_url: event.image_url || '',
      eventType: event.masjid_id ? 'masjid' : 'city',
      masjid_id: event.masjid_id || null
    });
    setShowModal(true);
  };

  const handleSaveEvent = async () => {
    if (!currentEvent.title || !currentEvent.date) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Title and Date are required.' });
      return;
    }

    try {
      const eventData = {
        title: currentEvent.title,
        speaker_name: currentEvent.speaker_name,
        description: currentEvent.description,
        date_time: currentEvent.date.toISOString(),
        image_url: currentEvent.image_url,
        created_by: user.id
      };

      if (role === 'admin') {
        if (currentEvent.eventType === 'masjid' && adminMasjidId) {
          eventData.masjid_id = adminMasjidId;
        } else {
          eventData.masjid_id = null; // City level
        }
      } else if (role === 'master_admin') {
        eventData.masjid_id = null; // Master admin always creates city level
      }

      if (isEditing) {
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', currentEvent.id);
        if (error) throw error;
        Toast.show({ type: 'success', text1: 'Success', text2: 'Event updated successfully.' });
      } else {
        const { error } = await supabase
          .from('events')
          .insert([eventData]);
        if (error) throw error;
        Toast.show({ type: 'success', text1: 'Success', text2: 'Event added successfully.' });
      }

      setShowModal(false);
      fetchEvents();
    } catch (err) {
      console.error('Save Event Error:', err);
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    }
  };

  const handleDeleteEvent = (id) => {
    Alert.alert('Delete Event', 'Are you sure you want to delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase.from('events').delete().eq('id', id);
            if (error) throw error;
            fetchEvents();
          } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: error.message });
          }
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      {isAdmin && (
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Text style={styles.addButtonText}>+ Add New Event</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={events}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.image} />
            ) : null}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                {item.speaker_name ? (
                  <Text style={styles.speakerText}>Speaker: {item.speaker_name}</Text>
                ) : null}
                {item.masjids?.name ? (
                  <Text style={styles.masjidText}>
                    Added by: {item.users?.name || 'Admin'} (Masjid: {item.masjids.name})
                  </Text>
                ) : (
                  <Text style={[styles.masjidText, { color: '#8e44ad' }]}>
                    Added by: {item.users?.name || 'Master Admin'} (City Committee)
                  </Text>
                )}
                <Text style={styles.date}>{new Date(item.date_time).toLocaleString()}</Text>
              </View>
              {(role === 'master_admin' || (role === 'admin' && item.created_by === user?.id)) && (
                <View style={styles.actionRow}>
                  <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionBtn}>
                    <Ionicons name="pencil" size={22} color="#3498db" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteEvent(item.id)} style={styles.actionBtn}>
                    <Ionicons name="trash" size={22} color="#e74c3c" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <Text style={styles.desc}>{item.description}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No upcoming Jamat events.</Text>}
      />

      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{isEditing ? 'Edit Event' : 'Add New Event'}</Text>

            <TextInput style={styles.input} placeholder="Event Title / Topic Name" value={currentEvent.title} onChangeText={t => setCurrentEvent({ ...currentEvent, title: t })} />
            <TextInput style={styles.input} placeholder="Speaker Name" value={currentEvent.speaker_name} onChangeText={t => setCurrentEvent({ ...currentEvent, speaker_name: t })} />

            {role === 'admin' && (
              <View style={{ marginBottom: 15 }}>
                <Text style={styles.datePickerLabel}>Event Type:</Text>
                <View style={styles.dateButtonsRow}>
                  <TouchableOpacity style={[styles.dateBtn, currentEvent.eventType === 'masjid' && { backgroundColor: '#1b6b3c', borderColor: '#1b6b3c' }]} onPress={() => setCurrentEvent({ ...currentEvent, eventType: 'masjid' })}>
                    <Text style={[styles.dateBtnText, currentEvent.eventType === 'masjid' && { color: '#fff' }]}> Masjid</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.dateBtn, currentEvent.eventType === 'city' && { backgroundColor: '#1b6b3c', borderColor: '#1b6b3c' }]} onPress={() => setCurrentEvent({ ...currentEvent, eventType: 'city' })}>
                    <Text style={[styles.dateBtnText, currentEvent.eventType === 'city' && { color: '#fff' }]}>City Level</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.datePickerContainer}>
              <Text style={styles.datePickerLabel}>Event Date & Time:</Text>
              <View style={styles.dateButtonsRow}>
                <TouchableOpacity style={styles.dateBtn} onPress={() => showMode('date')}>
                  <Text style={styles.dateBtnText}>{currentEvent.date.toLocaleDateString()}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateBtn} onPress={() => showMode('time')}>
                  <Text style={styles.dateBtnText}>{currentEvent.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
              </View>
              {showDatePicker && (
                <DateTimePicker
                  value={currentEvent.date}
                  mode={dateMode}
                  is24Hour={false}
                  display="default"
                  onChange={onDateChange}
                />
              )}
            </View>

            <TextInput style={[styles.input, { height: 80 }]} placeholder="Description" multiline value={currentEvent.description} onChangeText={t => setCurrentEvent({ ...currentEvent, description: t })} />

            <TouchableOpacity style={styles.imagePickerBtn} onPress={handleImagePickOptions} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator color="#1b6b3c" />
              ) : (
                <Text style={styles.imagePickerText}>
                  {currentEvent.image_url ? 'Image Uploaded ✓ (Tap to change)' : (role === 'master_admin' ? 'Upload Poster (Optional)' : 'Upload Image (Optional)')}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEvent}>
                <Text style={styles.btnText}>{isEditing ? 'Update Event' : 'Save Event'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f4f9f5' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3, borderLeftWidth: 4, borderLeftColor: '#1b6b3c' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { padding: 5 },
  actionIcon: { fontSize: 18 },
  title: { fontWeight: 'bold', fontSize: 18, color: '#222' },
  speakerText: { fontSize: 14, color: '#e67e22', fontWeight: '600', marginTop: 2 },
  masjidText: { fontSize: 13, color: '#3498db', fontWeight: '500', marginTop: 2 },
  date: { color: '#1b6b3c', marginTop: 4, fontSize: 13, fontWeight: '600' },
  desc: { color: '#555', marginTop: 8, lineHeight: 20 },
  empty: { textAlign: 'center', color: '#999', marginVertical: 40 },
  image: { width: '100%', height: 180, borderRadius: 8, marginBottom: 12 },
  addButton: { backgroundColor: '#1b6b3c', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 15 },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 15, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1b6b3c', marginBottom: 15 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: '#fafafa' },
  datePickerContainer: { marginBottom: 12 },
  datePickerLabel: { fontSize: 14, color: '#555', marginBottom: 5, fontWeight: '500' },
  dateButtonsRow: { flexDirection: 'row', gap: 10 },
  dateBtn: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, backgroundColor: '#fafafa', alignItems: 'center' },
  dateBtnText: { color: '#333', fontSize: 14 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cancelBtn: { backgroundColor: '#888', padding: 12, borderRadius: 8, flex: 0.48, alignItems: 'center' },
  saveBtn: { backgroundColor: '#1b6b3c', padding: 12, borderRadius: 8, flex: 0.48, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  imagePickerBtn: { backgroundColor: '#e0f0e3', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#1b6b3c', borderStyle: 'dashed' },
  imagePickerText: { color: '#1b6b3c', fontWeight: 'bold', fontSize: 14 }
});
