import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Image, Modal } from 'react-native';
import { supabase } from '../../config/supabaseClient';

import { API_URL } from '../../config/apiConfig';

export default function ManageRequestsScreen() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending'); // 'pending' or 'resolved'
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, [tab]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_requests')
        .select('*, users(*)')
        .eq('status', tab)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const fetchedRequests = data.map(d => ({
         ...d,
         users: Array.isArray(d.users) ? d.users[0] : d.users
      }));

      setRequests(fetchedRequests);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (item, newStatus) => {
    try {
      const { error } = await supabase.from('user_requests').update({ status: newStatus }).eq('id', item.id);
      if (error) throw error;

      if (newStatus === 'resolved' && item.user_id) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const response = await fetch(`${API_URL}/api/admin/users/${item.user_id}/make-admin`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to make user admin');
        }
      }

      fetchRequests();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.dateText}>{item.created_at || item.createdAt ? new Date(item.created_at || item.createdAt).toLocaleString() : 'Unknown Date'}</Text>
      <Text style={styles.userText}>From: {item.users?.name || 'Unknown'} ({item.users?.phone || 'No Phone'})</Text>
      
      <View style={styles.messageBox}>
        <Text style={styles.messageText}>{item.message}</Text>
      </View>

      {item.image_url && (
        <TouchableOpacity onPress={() => setSelectedImage(item.image_url)}>
          <Image source={{ uri: item.image_url }} style={styles.requestImage} />
        </TouchableOpacity>
      )}

      {tab === 'pending' ? (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.resolveBtn} onPress={() => handleUpdateStatus(item, 'resolved')}>
            <Text style={styles.btnText}>Mark as Resolved</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={() => handleUpdateStatus(item, 'rejected')}>
            <Text style={styles.btnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Status: {item.status.toUpperCase()}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'pending' && styles.tabActive]} onPress={() => setTab('pending')}>
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'resolved' && styles.tabActive]} onPress={() => setTab('resolved')}>
          <Text style={[styles.tabText, tab === 'resolved' && styles.tabTextActive]}>Resolved</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1b6b3c" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.emptyText}>No {tab} requests found.</Text>}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      <Modal visible={!!selectedImage} transparent={true} onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.modalBg}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedImage(null)}>
            <Text style={{color: 'white', fontSize: 20}}>Close</Text>
          </TouchableOpacity>
          {selectedImage && <Image source={{ uri: selectedImage }} style={styles.fullImage} />}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f9f5', padding: 16 },
  tabRow: { flexDirection: 'row', marginBottom: 15, backgroundColor: '#e0f0e3', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#fff', elevation: 2 },
  tabText: { color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#1b6b3c', fontWeight: 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 15, elevation: 3 },
  dateText: { color: '#999', fontSize: 12, marginBottom: 4 },
  userText: { color: '#333', fontWeight: 'bold', marginBottom: 10 },
  messageBox: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  messageText: { color: '#444', fontSize: 15 },
  requestImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 12, resizeMode: 'cover' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  resolveBtn: { backgroundColor: '#1b6b3c', padding: 12, borderRadius: 8, flex: 0.65, alignItems: 'center' },
  rejectBtn: { backgroundColor: '#d9534f', padding: 12, borderRadius: 8, flex: 0.3, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  statusBadge: { backgroundColor: '#e0f0e3', padding: 10, borderRadius: 8, alignItems: 'center' },
  statusText: { color: '#1b6b3c', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10 },
  fullImage: { width: '90%', height: '80%', resizeMode: 'contain' }
});
