import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Modal, TextInput, Alert, ScrollView, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import { supabase } from '../../config/supabaseClient';

export default function ManageMasjidScreen({ navigation }) {
  const { logout, user, role } = useAuth();
  const { globalSettings } = useSettings();
  
  const [masjids, setMasjids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignedMasjidId, setAssignedMasjidId] = useState(user?.assigned_masjid_id || null);
  
  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Time Picker State
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activeTimeField, setActiveTimeField] = useState({ prayer: null, type: null });
  const [tempTime, setTempTime] = useState(new Date());
  
  // Form State
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [image, setImage] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState(null);
  
  const [timings, setTimings] = useState({
    fajr: { azaan: '', jamat: '' },
    dhuhr: { azaan: '', jamat: '' },
    asr: { azaan: '', jamat: '' },
    maghrib: { azaan: '', jamat: '' },
    isha: { azaan: '', jamat: '' },
    jumuah: { azaan: '', jamat: '' },
  });
  
  // Committee State
  const [imam, setImam] = useState({ name: '', image_url: '' });
  const [mutawalli, setMutawalli] = useState({ name: '', image_url: '' });
  const [khatib, setKhatib] = useState({ name: '', image_url: '' });
  const [moazzan, setMoazzan] = useState({ name: '', image_url: '' });
  const [committeeMembers, setCommitteeMembers] = useState([{ name: '', image_url: '' }]);

  useEffect(() => {
    fetchMasjids();
  }, [user?.id, role]);

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

  const fetchMasjids = async () => {
    setLoading(true);
    try {
      let myAssignedId = user?.assigned_masjid_id || null;

      if (role === 'admin') {
        // Query Supabase users table to get the latest assigned_masjid_id
        if (!myAssignedId && user?.id) {
          try {
            const { data: supaUser } = await supabase
              .from('users')
              .select('assigned_masjid_id')
              .eq('id', user.id)
              .single();
            if (supaUser?.assigned_masjid_id) {
              myAssignedId = supaUser.assigned_masjid_id;
            }
          } catch (e) {
            console.warn('Error fetching assigned masjid from Supabase:', e);
          }
        }

        setAssignedMasjidId(myAssignedId);

        if (!myAssignedId) {
          // Regular admin with no assigned masjid can NEVER see or edit any masjids
          setMasjids([]);
          setLoading(false);
          return;
        }

        // Fetch ONLY their assigned masjid from Supabase
        const { data: supaMasjid, error: smError } = await supabase
          .from('masjids')
          .select('*')
          .eq('id', myAssignedId)
          .single();

        if (smError) {
          console.warn('Supabase fetch assigned masjid error:', smError);
        }

        setMasjids(supaMasjid ? [supaMasjid] : []);
        setLoading(false);
        return;
      }

      // Master admin: load all masjids from Supabase
      const { data: supaMasjids, error: smError } = await supabase
        .from('masjids')
        .select('*')
        .order('created_at', { ascending: false });

      if (smError) {
        console.warn('Error fetching masjids from Supabase:', smError);
      }
      setMasjids(supaMasjids || []);
    } catch (err) {
      console.error(err);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to fetch Masjids' });
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    if (role !== 'master_admin') {
      Alert.alert('Permission Denied', 'Only Master Admin can create new masjids.');
      return;
    }
    setEditingId(null);
    setName('');
    setAddress('');
    setImage(null);
    setExistingImageUrl(null);
    setTimings({
      fajr: { azaan: '', jamat: '' },
      dhuhr: { azaan: '', jamat: '' },
      asr: { azaan: '', jamat: '' },
      maghrib: { azaan: '', jamat: '' },
      isha: { azaan: '', jamat: '' },
      jumuah: { azaan: '', jamat: '' },
    });
    setImam({ name: '', image_url: '' });
    setMutawalli({ name: '', image_url: '' });
    setKhatib({ name: '', image_url: '' });
    setMoazzan({ name: '', image_url: '' });
    setCommitteeMembers([{ name: '', image_url: '' }]);
    setShowFormModal(true);
  };

  const openEditModal = (masjid) => {
    // If regular admin, they can ONLY edit their assigned masjid!
    if (role === 'admin') {
      const allowedId = assignedMasjidId || user?.assigned_masjid_id;
      if (!allowedId || masjid.id !== allowedId) {
        Alert.alert('Permission Denied', 'You are only authorized to edit your assigned masjid.');
        return;
      }
    }

    setEditingId(masjid.id);
    setName(masjid.name);
    setAddress(masjid.address || '');
    setImage(null);
    setExistingImageUrl(masjid.image_url);
    
    const t = masjid.timings_json || {};
    const parseTime = (val) => {
      if (!val) return { azaan: '', jamat: '' };
      if (typeof val === 'string') return { azaan: '', jamat: val };
      return {
        azaan: typeof val.azaan === 'string' ? val.azaan : '',
        jamat: typeof val.jamat === 'string' ? val.jamat : ''
      };
    };

    setTimings({
      fajr: parseTime(t.fajr),
      dhuhr: parseTime(t.dhuhr),
      asr: parseTime(t.asr),
      maghrib: parseTime(t.maghrib),
      isha: parseTime(t.isha),
      jumuah: parseTime(t.jumuah),
    });
    
    const c = masjid.committee_json || {};
    setImam({ name: c.imam?.name || '', image_url: c.imam?.image_url || '' });
    setMutawalli({ name: c.mutavalli?.name || '', image_url: c.mutavalli?.image_url || '' });
    setKhatib({ name: c.khatib?.name || '', image_url: c.khatib?.image_url || '' });
    setMoazzan({ name: c.moazzan?.name || '', image_url: c.moazzan?.image_url || '' });
    
    if (c.members && c.members.length > 0) {
      setCommitteeMembers(c.members.map(m => ({ name: m.name || '', image_url: m.image_url || '' })));
    } else {
      setCommitteeMembers([{ name: '', image_url: '' }]);
    }
    
    setShowFormModal(true);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled) setImage(result.assets[0]);
  };

  const pickMemberImage = async (setMemberState) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      try {
        Toast.show({ type: 'info', text1: 'Uploading...', text2: 'Uploading member photo' });
        const publicUrl = await uploadImageToImgbb(result.assets[0].base64);
        
        setMemberState(prev => {
          if (typeof prev === 'object' && prev !== null) {
            return { ...prev, image_url: publicUrl };
          }
          return { name: '', image_url: publicUrl };
        });
        Toast.show({ type: 'success', text1: 'Uploaded', text2: 'Member photo uploaded successfully' });
      } catch (err) {
        Toast.show({ type: 'error', text1: 'Upload Error', text2: err.message });
      }
    }
  };

  const handleSaveMasjid = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Masjid Name is required' });
      return;
    }

    setIsSubmitting(true);
    try {
      let finalImageUrl = existingImageUrl;
      if (image?.base64) {
        Toast.show({ type: 'info', text1: 'Uploading...', text2: 'Uploading masjid image' });
        finalImageUrl = await uploadImageToImgbb(image.base64);
      }

      const committee_json = {
        imam: imam.name.trim() ? imam : null,
        mutavalli: mutawalli.name.trim() ? mutawalli : null,
        khatib: khatib.name.trim() ? khatib : null,
        moazzan: moazzan.name.trim() ? moazzan : null,
        members: committeeMembers.filter(m => m.name.trim())
      };

      // Validation for regular admin
      if (role === 'admin') {
        const allowedId = assignedMasjidId || user?.assigned_masjid_id;
        if (!editingId) {
          Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Local admins cannot add new masjids.' });
          return;
        }
        if (!allowedId || editingId !== allowedId) {
          Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'You can only edit your assigned masjid.' });
          return;
        }
      }

      if (editingId) {
        const { error: updateError } = await supabase.from('masjids').update({
          name: name.trim(),
          address: address.trim(),
          timings_json: timings,
          committee_json: committee_json,
          image_url: finalImageUrl
        }).eq('id', editingId);

        if (updateError) throw updateError;
        Toast.show({ type: 'success', text1: 'Success', text2: 'Masjid updated successfully!' });
      } else {
        if (role !== 'master_admin') {
          Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Only Master Admin can add new masjids.' });
          return;
        }
        const insertItem = {
          name: name.trim(),
          address: address.trim(),
          timings_json: timings,
          committee_json: committee_json,
          image_url: finalImageUrl
        };
        const { error: insertError } = await supabase.from('masjids').insert([insertItem]);
        if (insertError) throw insertError;
        Toast.show({ type: 'success', text1: 'Success', text2: 'Masjid added successfully!' });
      }

      setShowFormModal(false);
      fetchMasjids();
    } catch (err) {
      console.error(err);
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Operation failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMasjid = (id) => {
    if (role !== 'master_admin') {
      Alert.alert('Permission Denied', 'Only Master Admin can delete masjids.');
      return;
    }
    Alert.alert('Delete Masjid', 'Are you sure you want to delete this masjid?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive', 
        onPress: async () => {
          try {
            setIsSubmitting(true);
            const { error: delError } = await supabase.from('masjids').delete().eq('id', id);
            if (delError) throw delError;

            Toast.show({ type: 'success', text1: 'Success', text2: 'Masjid deleted successfully!' });
            setShowFormModal(false);
            fetchMasjids();
          } catch (err) {
            console.error(err);
            Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to delete' });
          } finally {
            setIsSubmitting(false);
          }
        }
      }
    ]);
  };

  const updateTiming = (prayer, type, value) => {
    setTimings(prev => ({
      ...prev,
      [prayer]: { ...prev[prayer], [type]: value }
    }));
  };

  const openTimePicker = (prayer, type, currentTimeStr) => {
    let dateObj = new Date();
    if (currentTimeStr) {
       const match = currentTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
       if (match) {
          let [_, h, m, ampm] = match;
          h = parseInt(h);
          if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
          if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
          dateObj.setHours(h, parseInt(m), 0, 0);
       }
    }
    setTempTime(dateObj);
    setActiveTimeField({ prayer, type });
    setShowTimePicker(true);
  };

  const onTimeChange = (event, selectedDate) => {
    if (Platform.OS !== 'ios') setShowTimePicker(false);
    if (selectedDate) {
      setTempTime(selectedDate);
      let h = selectedDate.getHours();
      let m = selectedDate.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      m = m < 10 ? `0${m}` : m;
      const timeStr = `${h}:${m} ${ampm}`;
      updateTiming(activeTimeField.prayer, activeTimeField.type, timeStr);
    }
  };

  return (
    <View style={styles.container}>

      {/* Master Admin can add a new masjid */}
      {role === 'master_admin' && (
        <TouchableOpacity style={styles.addButton} onPress={openAddModal} activeOpacity={0.8}>
          <Ionicons name="add-circle" size={24} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.addButtonText}>Add New Masjid</Text>
        </TouchableOpacity>
      )}

      {/* Informational Banner for regular admin */}
      {role === 'admin' && (
        <View style={styles.assignedBanner}>
          <View style={styles.bannerIconWrap}>
            <Ionicons name="shield-checkmark" size={22} color="#1b6b3c" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.assignedBannerTitle}>
              {assignedMasjidId && masjids.length > 0 ? `Assigned: ${masjids[0]?.name}` : 'No Masjid Assigned'}
            </Text>
            <Text style={styles.assignedBannerSubtitle}>
              {assignedMasjidId && masjids.length > 0
                ? 'You can only update prayer timings and committee details for this masjid.'
                : 'You have not been assigned to a masjid yet. Please contact Master Admin to assign your masjid.'}
            </Text>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#1b6b3c" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={masjids}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isAuthorized = role === 'master_admin' || (role === 'admin' && (item.id === assignedMasjidId || item.id === user?.assigned_masjid_id));
            return (
              <View style={styles.masjidCard}>
                <TouchableOpacity 
                  onPress={() => {
                    if (!isAuthorized) {
                      Alert.alert('Permission Denied', 'You are only authorized to edit your assigned masjid.');
                      return;
                    }
                    openEditModal(item);
                  }} 
                  activeOpacity={isAuthorized ? 0.9 : 1} 
                  style={{ flex: 1 }}
                >
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.cardImage} />
                  ) : (
                    <View style={styles.cardImagePlaceholder}>
                      <Ionicons name="business" size={40} color="#c5d6cb" />
                    </View>
                  )}
                  <View style={styles.cardOverlay} />
                  
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cardAddress} numberOfLines={2}>{item.address || 'No address provided'}</Text>
                  </View>
                </TouchableOpacity>
                
                {isAuthorized && (
                  <TouchableOpacity style={styles.editIconBtn} onPress={() => openEditModal(item)}>
                     <Ionicons name="pencil" size={16} color="#1b6b3c" />
                  </TouchableOpacity>
                )}
                
                {role === 'master_admin' && (
                  <TouchableOpacity style={styles.deleteIconBtn} onPress={() => handleDeleteMasjid(item.id)}>
                     <Ionicons name="trash" size={16} color="#e74c3c" />
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={48} color="#aaa" style={{ marginBottom: 10 }} />
              <Text style={styles.emptyText}>
                {role === 'admin'
                  ? (assignedMasjidId ? 'Assigned masjid details could not be loaded.' : 'No masjid assigned to your account. Please contact Master Admin.')
                  : 'No Masjids added yet.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Add / Edit Form Modal */}
      <Modal visible={showFormModal} animationType="slide" transparent={false} onRequestClose={() => setShowFormModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#f4f9f5' }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Masjid' : 'Add New Masjid'}</Text>
            <TouchableOpacity onPress={() => setShowFormModal(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#1b6b3c" />
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
            
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Basic Details</Text>
              
              <Text style={styles.label}>Masjid Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter Masjid Name" placeholderTextColor="#aaa" />

              <Text style={styles.label}>Address</Text>
              <TextInput style={[styles.input, { height: 80, paddingTop: 15 }]} value={address} onChangeText={setAddress} placeholder="Enter full address" placeholderTextColor="#aaa" multiline textAlignVertical="top" />

              <Text style={styles.label}>Masjid Image</Text>
              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage} activeOpacity={0.8}>
                {image ? (
                  <Image source={{ uri: image.uri }} style={styles.previewImage} />
                ) : existingImageUrl ? (
                  <Image source={{ uri: existingImageUrl }} style={styles.previewImage} />
                ) : (
                  <View style={styles.imagePlaceholderBox}>
                    <View style={styles.cameraIconWrap}>
                       <Ionicons name="camera" size={30} color="#1b6b3c" />
                    </View>
                    <Text style={{ color: '#555', marginTop: 10, fontWeight: '600' }}>Tap to pick an image</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Prayer Timings</Text>
              <View style={styles.timingHeader}>
                <Text style={[styles.timingHeaderCol, { flex: 1.2, textAlign: 'left' }]}>Prayer</Text>
                <Text style={styles.timingHeaderCol}>Azaan</Text>
                <Text style={styles.timingHeaderCol}>Jamat</Text>
              </View>

              {['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'jumuah'].map((prayer) => (
                <View key={prayer} style={styles.timingRow}>
                  <Text style={styles.prayerLabel}>{prayer.charAt(0).toUpperCase() + prayer.slice(1)}</Text>
                  
                  <TouchableOpacity 
                    style={styles.timeInputTouch} 
                    onPress={() => openTimePicker(prayer, 'azaan', timings[prayer].azaan)}
                  >
                    <Text style={[styles.timeText, !timings[prayer].azaan && {color: '#999'}]}>
                      {timings[prayer].azaan || '--:--'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.timeInputTouch} 
                    onPress={() => openTimePicker(prayer, 'jamat', timings[prayer].jamat)}
                  >
                    <Text style={[styles.timeText, !timings[prayer].jamat && {color: '#999'}]}>
                      {timings[prayer].jamat || '--:--'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Committee Details</Text>
              
              <Text style={styles.label}>Imam</Text>
              <View style={styles.memberInputWrapper}>
                <TouchableOpacity onPress={() => pickMemberImage(setImam)} style={styles.memberImagePicker}>
                   {imam.image_url ? <Image source={{ uri: imam.image_url }} style={styles.memberImage} /> : <Ionicons name="camera" size={20} color="#1b6b3c" />}
                </TouchableOpacity>
                <TextInput style={styles.memberInput} value={imam.name} onChangeText={(txt) => setImam(prev => ({...prev, name: txt}))} placeholder="Enter Imam Name" placeholderTextColor="#aaa" />
              </View>

              <Text style={[styles.label, {marginTop: 15}]}>Mutawalli</Text>
              <View style={styles.memberInputWrapper}>
                <TouchableOpacity onPress={() => pickMemberImage(setMutawalli)} style={styles.memberImagePicker}>
                   {mutawalli.image_url ? <Image source={{ uri: mutawalli.image_url }} style={styles.memberImage} /> : <Ionicons name="camera" size={20} color="#1b6b3c" />}
                </TouchableOpacity>
                <TextInput style={styles.memberInput} value={mutawalli.name} onChangeText={(txt) => setMutawalli(prev => ({...prev, name: txt}))} placeholder="Enter Mutawalli Name" placeholderTextColor="#aaa" />
              </View>

              <Text style={[styles.label, {marginTop: 15}]}>Regular Khatib</Text>
              <View style={styles.memberInputWrapper}>
                <TouchableOpacity onPress={() => pickMemberImage(setKhatib)} style={styles.memberImagePicker}>
                   {khatib.image_url ? <Image source={{ uri: khatib.image_url }} style={styles.memberImage} /> : <Ionicons name="camera" size={20} color="#1b6b3c" />}
                </TouchableOpacity>
                <TextInput style={styles.memberInput} value={khatib.name} onChangeText={(txt) => setKhatib(prev => ({...prev, name: txt}))} placeholder="Enter Khatib Name" placeholderTextColor="#aaa" />
              </View>

              <Text style={[styles.label, {marginTop: 15}]}>Moazzan</Text>
              <View style={styles.memberInputWrapper}>
                <TouchableOpacity onPress={() => pickMemberImage(setMoazzan)} style={styles.memberImagePicker}>
                   {moazzan.image_url ? <Image source={{ uri: moazzan.image_url }} style={styles.memberImage} /> : <Ionicons name="camera" size={20} color="#1b6b3c" />}
                </TouchableOpacity>
                <TextInput style={styles.memberInput} value={moazzan.name} onChangeText={(txt) => setMoazzan(prev => ({...prev, name: txt}))} placeholder="Enter Moazzan Name" placeholderTextColor="#aaa" />
              </View>

              <Text style={[styles.label, { marginTop: 15 }]}>Committee Members</Text>
              {committeeMembers.map((member, index) => (
                <View key={index} style={[styles.memberInputWrapper, { marginBottom: 12 }]}>
                  <TouchableOpacity onPress={() => pickMemberImage((updater) => {
                      setCommitteeMembers(prev => {
                          const newArr = [...prev];
                          const updatedObj = typeof updater === 'function' ? updater(newArr[index]) : updater;
                          newArr[index] = updatedObj;
                          return newArr;
                      });
                  })} style={styles.memberImagePicker}>
                     {member.image_url ? <Image source={{ uri: member.image_url }} style={styles.memberImage} /> : <Ionicons name="camera" size={20} color="#1b6b3c" />}
                  </TouchableOpacity>
                  <TextInput
                    style={styles.memberInput}
                    value={member.name}
                    onChangeText={(text) => {
                      const newMembers = [...committeeMembers];
                      newMembers[index].name = text;
                      setCommitteeMembers(newMembers);
                    }}
                    placeholder="Enter Member Name"
                    placeholderTextColor="#aaa"
                  />
                  {committeeMembers.length > 1 && (
                    <TouchableOpacity 
                      style={styles.deleteMemberBtnInline}
                      onPress={() => {
                        const newMembers = committeeMembers.filter((_, i) => i !== index);
                        setCommitteeMembers(newMembers);
                      }}
                    >
                      <Ionicons name="trash" size={20} color="#e74c3c" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity style={styles.addMemberBtn} onPress={() => setCommitteeMembers([...committeeMembers, { name: '', image_url: '' }])}>
                <Text style={styles.addMemberText}>+ Add Another Member</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveMasjid} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editingId ? 'Update Masjid' : 'Save Masjid'}</Text>}
            </TouchableOpacity>
            
            {editingId && role === 'master_admin' && (
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#fee', marginTop: 15, elevation: 0, shadowOpacity: 0, shadowRadius: 0 }]} onPress={() => handleDeleteMasjid(editingId)} disabled={isSubmitting}>
                <Text style={[styles.saveBtnText, { color: '#e74c3c' }]}>Delete Masjid</Text>
              </TouchableOpacity>
            )}
            
            <View style={{ height: 60 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {showTimePicker && (
        <DateTimePicker
          value={tempTime}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={onTimeChange}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f9f5' },
  
  addButton: { backgroundColor: '#1b6b3c', margin: 20, paddingVertical: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#1b6b3c', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  
  gridContainer: { paddingHorizontal: 15, paddingBottom: 30 },
  gridRow: { justifyContent: 'space-between', marginBottom: 15 },
  
  masjidCard: { width: '48%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, position: 'relative' },
  cardImage: { width: '100%', height: 140, resizeMode: 'cover' },
  cardImagePlaceholder: { width: '100%', height: 140, backgroundColor: '#e9f2eb', justifyContent: 'center', alignItems: 'center' },
  cardOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: 140, backgroundColor: 'rgba(0,0,0,0.2)' },
  cardContent: { padding: 15, backgroundColor: '#fff' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 4 },
  cardAddress: { fontSize: 12, color: '#777', fontWeight: '500', lineHeight: 16 },
  editIconBtn: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 4, zIndex: 2 },
  deleteIconBtn: { position: 'absolute', top: 10, right: 48, width: 32, height: 32, borderRadius: 16, backgroundColor: '#fee', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 4, zIndex: 2 },
  
  emptyText: { textAlign: 'center', marginTop: 40, color: '#888', fontSize: 16, fontWeight: '600' },

  // Modal Styles
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 40, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', elevation: 2 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1b6b3c' },
  closeBtn: { backgroundColor: '#f0f0f0', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  
  formContainer: { padding: 20 },
  formSection: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1b6b3c', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
  
  label: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eaeaea', borderRadius: 12, paddingHorizontal: 16, height: 54, fontSize: 15, color: '#333', marginBottom: 15 },
  
  imagePickerBtn: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#eaeaea', backgroundColor: '#f9f9f9', borderStyle: 'dashed' },
  previewImage: { width: '100%', height: 200, resizeMode: 'cover' },
  imagePlaceholderBox: { height: 160, justifyContent: 'center', alignItems: 'center' },
  cameraIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#eef6f0', justifyContent: 'center', alignItems: 'center' },
  
  timingHeader: { flexDirection: 'row', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 15 },
  timingHeaderCol: { flex: 1, fontWeight: '800', color: '#888', textAlign: 'center', fontSize: 12, textTransform: 'uppercase' },
  timingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  prayerLabel: { flex: 1.2, fontSize: 15, fontWeight: '700', color: '#333' },
  timeInputTouch: { flex: 1, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eaeaea', borderRadius: 10, height: 44, marginHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  timeText: { fontSize: 14, color: '#111', fontWeight: '600' },
  addMemberBtn: { paddingVertical: 12, paddingHorizontal: 15, backgroundColor: '#eef6f0', borderRadius: 10, alignSelf: 'flex-start', marginTop: 5 },
  addMemberText: { color: '#1b6b3c', fontWeight: '800', fontSize: 13 },
  memberInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eaeaea', borderRadius: 12, padding: 6, marginBottom: 15 },
  memberImagePicker: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#eef6f0', justifyContent: 'center', alignItems: 'center', marginRight: 10, overflow: 'hidden' },
  memberImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  memberInput: { flex: 1, height: 42, fontSize: 15, color: '#333' },
  deleteMemberBtnInline: { padding: 10, justifyContent: 'center', alignItems: 'center' },

  saveBtn: { backgroundColor: '#1b6b3c', marginTop: 10, paddingVertical: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#1b6b3c', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  // Admin Banner Styles
  assignedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef6f0',
    borderColor: '#c3e6cb',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 10,
  },
  bannerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    elevation: 1,
  },
  assignedBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1b6b3c',
    marginBottom: 2,
  },
  assignedBannerSubtitle: {
    fontSize: 12,
    color: '#3d6349',
    lineHeight: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 30,
  },
});
