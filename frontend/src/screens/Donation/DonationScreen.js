import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Alert, ActivityIndicator, FlatList, TextInput } from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import QRCode from 'react-native-qrcode-svg';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';

export default function DonationScreen() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin' || role === 'master_admin';
  
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // User States
  const [screenshot, setScreenshot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);

  // Admin States
  const [donations, setDonations] = useState([]);
  const [adminTab, setAdminTab] = useState('pending'); // 'pending', 'verified', 'settings'
  const [donationSettings, setDonationSettings] = useState({ upi_id: '', bank_name: '', account_no: '', ifsc: '', qr_url: '' });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetchSettings();
    if (isAdmin) fetchDonations();
  }, [isAdmin, adminTab]);

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

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 'donation_details')
        .single();

      if (data && data.value) {
        setSettings(data.value);
        if (isAdmin) setDonationSettings(data.value || { upi_id: '', bank_name: '', account_no: '', ifsc: '', qr_url: '' });
      }
    } catch (err) {
      console.error('Error fetching donation settings:', err);
    } finally {
      if (!isAdmin) setLoading(false);
    }
  };

  const fetchDonations = async () => {
    setLoading(true);
    try {
      let queryBuilder = supabase
        .from('donations')
        .select('*, users(*)')
        .order('created_at', { ascending: false });

      if (adminTab === 'pending') {
        queryBuilder = queryBuilder.eq('status', 'pending');
      } else if (adminTab === 'verified') {
        queryBuilder = queryBuilder.eq('status', 'verified');
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;

      const fetched = (data || []).map(d => ({
        ...d,
        users: Array.isArray(d.users) ? d.users[0] : (d.users || {})
      }));
      setDonations(fetched);
    } catch (err) {
      console.error('Error fetching donations:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- Admin Methods ---
  const handleVerifyDonation = async (donationId, amountStr) => {
    const amount = parseFloat(amountStr) || 0;
    if (amount <= 0) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a valid amount to verify this donation.' });
      return;
    }

    try {
      const { error } = await supabase
        .from('donations')
        .update({ status: 'verified', amount })
        .eq('id', donationId);

      if (error) throw error;
      
      Toast.show({ type: 'success', text1: 'Success', text2: 'Donation verified successfully.' });
      fetchDonations();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    }
  };

  const handleRejectDonation = async (donationId) => {
    Alert.alert('Reject Donation', 'Are you sure you want to reject this donation record?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase
            .from('donations')
            .update({ status: 'rejected' })
            .eq('id', donationId);

          if (error) throw error;
          fetchDonations();
        } catch (err) {
          Toast.show({ type: 'error', text1: 'Error', text2: err.message });
        }
      }}
    ]);
  };

  const handleSaveDonationSettings = async () => {
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          id: 'donation_details',
          value: donationSettings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      Toast.show({ type: 'success', text1: 'Success', text2: 'Donation settings updated successfully.' });
      fetchSettings(); // Refresh settings
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to update settings' });
    } finally {
      setSavingSettings(false);
    }
  };

  // --- User Methods ---
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) setScreenshot(result.assets[0]);
  };

  const saveDonationRecord = async () => {
    if (!screenshot) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please upload a screenshot of your payment' });
      return;
    }
    setSubmitting(true);
    try {
      let publicUrl = null;
      if (screenshot.base64) {
        Toast.show({ type: 'info', text1: 'Uploading...', text2: 'Uploading payment screenshot' });
        publicUrl = await uploadImageToImgbb(screenshot.base64);
      }

      const generatedTxnId = `REC-${Date.now()}`;

      const { error } = await supabase.from('donations').insert({
        user_id: user?.id || null,
        amount: 0,
        transaction_id: generatedTxnId,
        screenshot_url: publicUrl,
        status: 'pending'
      });

      if (error) throw error;
      
      setReceipt({
        date: new Date().toLocaleString(),
        name: user?.name || 'User',
        phone: user?.phone || '',
        txnId: generatedTxnId
      });
      setScreenshot(null);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Could not record donation details' });
    } finally {
      setSubmitting(false);
    }
  };

  // --- RENDER ADMIN ---
  if (isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Manage Donations</Text>
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, adminTab === 'pending' && styles.tabActive]} onPress={() => setAdminTab('pending')}>
            <Text style={[styles.tabText, adminTab === 'pending' && styles.tabTextActive]}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, adminTab === 'verified' && styles.tabActive]} onPress={() => setAdminTab('verified')}>
            <Text style={[styles.tabText, adminTab === 'verified' && styles.tabTextActive]}>Verified</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, adminTab === 'settings' && styles.tabActive]} onPress={() => setAdminTab('settings')}>
            <Text style={[styles.tabText, adminTab === 'settings' && styles.tabTextActive]}>Settings</Text>
          </TouchableOpacity>
        </View>

        {adminTab === 'settings' ? (
          <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
            <View style={styles.formContainer}>
              <Text style={styles.subtitle}>Update Donation Details</Text>

              <Text style={styles.label}>UPI ID</Text>
              <TextInput style={styles.input} value={donationSettings.upi_id} onChangeText={t => setDonationSettings({...donationSettings, upi_id: t})} placeholder="e.g. jamait@upi" />

              <Text style={styles.label}>Bank Account Name</Text>
              <TextInput style={styles.input} value={donationSettings.bank_name} onChangeText={t => setDonationSettings({...donationSettings, bank_name: t})} placeholder="Account Name" />

              <Text style={styles.label}>Account Number</Text>
              <TextInput style={styles.input} value={donationSettings.account_no} onChangeText={t => setDonationSettings({...donationSettings, account_no: t})} placeholder="Account Number" keyboardType="numeric" />

              <Text style={styles.label}>IFSC Code</Text>
              <TextInput style={styles.input} value={donationSettings.ifsc} onChangeText={t => setDonationSettings({...donationSettings, ifsc: t})} placeholder="IFSC Code" />

              <TouchableOpacity style={styles.payButton} onPress={handleSaveDonationSettings} disabled={savingSettings}>
                <Text style={styles.buttonText}>{savingSettings ? 'Saving...' : 'Save Details'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : loading ? (
          <ActivityIndicator size="large" color="#1b6b3c" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={donations}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={<Text style={styles.emptyText}>No {adminTab} donations found.</Text>}
            renderItem={({ item }) => (
              <DonationAdminCard item={item} onVerify={handleVerifyDonation} onReject={handleRejectDonation} isVerified={adminTab === 'verified'} />
            )}
          />
        )}
      </View>
    );
  }

  // --- RENDER USER ---
  if (loading) return <ActivityIndicator size="large" color="#1b6b3c" style={{ marginTop: 40 }} />;

  if (receipt) {
    return (
      <View style={styles.receiptContainer}>
        <View style={styles.receiptCard}>
          <View style={styles.checkIcon}><Text style={{color: 'white', fontSize: 30}}>✓</Text></View>
          <Text style={styles.receiptTitle}>Donation Initiated</Text>
          <Text style={styles.receiptDesc}>Jazakallah Khair for your generous contribution.</Text>
          <View style={styles.receiptDetails}>
            <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Name</Text><Text style={styles.receiptValue}>{receipt.name}</Text></View>
            <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Txn ID</Text><Text style={[styles.receiptValue, { fontSize: 12 }]}>{receipt.txnId}</Text></View>
            <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Status</Text><Text style={[styles.receiptValue, { color: '#b45309' }]}>Pending Verification</Text></View>
          </View>
          <TouchableOpacity style={styles.button} onPress={() => setReceipt(null)}><Text style={styles.buttonText}>Make Another Donation</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Support Jamaat E Ahle Hadees</Text>
      
      {settings?.upi_id ? (
        <View style={styles.qrContainer}>
          <Text style={styles.subtitle}>Scan to Donate (UPI)</Text>
          <View style={{ backgroundColor: 'white', padding: 10, borderRadius: 10, marginBottom: 10 }}>
            <QRCode value={`upi://pay?pa=${settings.upi_id}&pn=${encodeURIComponent(settings.bank_name || 'JamaitApp')}&cu=INR`} size={180} />
          </View>
          <Text style={{ fontSize: 13, color: '#666' }}>UPI ID: {settings.upi_id}</Text>
        </View>
      ) : settings?.qr_url ? (
        <View style={styles.qrContainer}>
          <Text style={styles.subtitle}>Scan to Donate</Text>
          <Image source={{ uri: settings.qr_url }} style={styles.qrCode} />
        </View>
      ) : null}

      <View style={styles.bankContainer}>
        <Text style={styles.subtitle}>Bank Transfer Details</Text>
        <View style={styles.detailRow}><Text style={styles.label}>Account Name:</Text><Text style={styles.value}>{settings?.bank_name || 'N/A'}</Text></View>
        <View style={styles.detailRow}><Text style={styles.label}>Account Number:</Text><Text style={styles.value}>{settings?.account_no || 'N/A'}</Text></View>
        <View style={styles.detailRow}><Text style={styles.label}>IFSC Code:</Text><Text style={styles.value}>{settings?.ifsc || 'N/A'}</Text></View>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.subtitle}>Completed your payment?</Text>
        <Text style={{fontSize: 13, color: '#666', marginBottom: 12}}>Upload a screenshot of your successful payment to generate a receipt.</Text>
        
        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
          <Text style={styles.uploadButtonText}>{screenshot ? '✓ Screenshot Selected (Change)' : '+ Upload Screenshot'}</Text>
        </TouchableOpacity>
        {screenshot && <Image source={{ uri: screenshot.uri }} style={styles.previewImage} />}
        
        <TouchableOpacity style={styles.payButton} onPress={saveDonationRecord} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? 'Generating...' : 'Generate Receipt'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Child component for Admin Card to handle its own amount state safely
const DonationAdminCard = ({ item, onVerify, onReject, isVerified }) => {
  const [amount, setAmount] = useState(item.amount ? item.amount.toString() : '');

  return (
    <View style={styles.adminCard}>
      <Text style={styles.adminTxnText}>Txn: {item.transaction_id}</Text>
      <Text style={styles.adminDonorText}>From: {item.users?.name || 'Unknown User'} ({item.users?.phone || 'No Phone'})</Text>
      <Text style={styles.adminDateText}>{item.created_at || item.createdAt ? new Date(item.created_at || item.createdAt).toLocaleString() : 'Unknown Date'}</Text>
      
      {item.screenshot_url && (
        <Image source={{ uri: item.screenshot_url }} style={styles.adminImage} />
      )}

      {!isVerified ? (
        <View style={styles.adminActionArea}>
          <TextInput
            style={styles.amountInput}
            placeholder="Enter Amount (₹)"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
          <View style={styles.adminActionRow}>
            <TouchableOpacity style={styles.adminRejectBtn} onPress={() => onReject(item.id)}>
              <Text style={styles.btnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminVerifyBtn} onPress={() => onVerify(item.id, amount)}>
              <Text style={styles.btnText}>Verify Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedText}>Verified Amount: ₹{item.amount}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, backgroundColor: '#f4f9f5' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 20, color: '#1b6b3c', textAlign: 'center' },
  
  // Tabs
  tabRow: { flexDirection: 'row', marginBottom: 15, backgroundColor: '#e0f0e3', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width:0, height:1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  tabText: { color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#1b6b3c', fontWeight: 'bold' },
  
  // Admin Card
  adminCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 15, shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  adminTxnText: { fontWeight: '700', color: '#333', fontSize: 14, marginBottom: 4 },
  adminDonorText: { color: '#555', fontSize: 14, marginBottom: 4 },
  adminDateText: { color: '#999', fontSize: 12, marginBottom: 12 },
  adminImage: { width: '100%', height: 200, resizeMode: 'contain', borderRadius: 8, marginBottom: 15, backgroundColor: '#f0f0f0' },
  adminActionArea: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 },
  amountInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  adminActionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  adminRejectBtn: { flex: 0.48, backgroundColor: '#d9534f', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  adminVerifyBtn: { flex: 0.48, backgroundColor: '#1b6b3c', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  verifiedBadge: { backgroundColor: '#e0f0e3', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  verifiedText: { color: '#1b6b3c', fontWeight: 'bold', fontSize: 15 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },

  // User Styles (unchanged mostly)
  subtitle: { fontSize: 16, fontWeight: '600', color: '#1b6b3c', marginBottom: 15 },
  qrContainer: { alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '100%', marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  qrCode: { width: 200, height: 200, marginBottom: 10, resizeMode: 'contain' },
  bankContainer: { width: '100%', backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontSize: 14, color: '#666', fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fafafa', borderRadius: 8, paddingHorizontal: 12, height: 45, fontSize: 15, color: '#333', marginBottom: 15 },
  value: { fontSize: 14, color: '#222', fontWeight: '600' },
  formContainer: { width: '100%', backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  uploadButton: { padding: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#1b6b3c', borderRadius: 8, alignItems: 'center', marginBottom: 16, borderStyle: 'dashed' },
  uploadButtonText: { color: '#1b6b3c', fontWeight: '600' },
  previewImage: { width: '100%', height: 150, borderRadius: 8, marginBottom: 16, resizeMode: 'cover' },
  button: { backgroundColor: '#1b6b3c', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  payButton: { backgroundColor: '#1b6b3c', padding: 16, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  receiptContainer: { flex: 1, backgroundColor: '#f0f4f2', justifyContent: 'center', padding: 20 },
  receiptCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  checkIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  receiptTitle: { fontSize: 22, fontWeight: 'bold', color: '#111', marginBottom: 8 },
  receiptDesc: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  receiptDetails: { width: '100%', backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 24 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  receiptLabel: { color: '#666', fontSize: 14 },
  receiptValue: { color: '#111', fontSize: 14, fontWeight: '600' },
});
