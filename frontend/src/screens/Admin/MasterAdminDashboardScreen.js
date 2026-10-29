import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Modal, Alert, TextInput, Image, Linking, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config/apiConfig';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AdminAnalyticsChart from '../../components/AdminAnalyticsChart';
import { downloadUsersExcelFile } from '../../services/excelExportService';

export default function MasterAdminDashboardScreen({ navigation }) {
  const { logout, user } = useAuth();
  const [stats, setStats] = useState({ users: 0, admins: 0, masterAdmins: 0, unansweredQuestions: 0, loading: true });
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingQuestions, setPendingQuestions] = useState([]);
  const [showMailbox, setShowMailbox] = useState(false);
  const [replyModalData, setReplyModalData] = useState(null); // Holds the request object to reply to
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  
  const [showBoardModal, setShowBoardModal] = useState(false);
  const [boardMembers, setBoardMembers] = useState([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats
      const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'user');
      const { count: adminsCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin');
      const { count: masterAdminsCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'master_admin');
      const { count: unansweredCount } = await supabase.from('questions').select('*', { count: 'exact', head: true }).is('answer', null);

      setStats({ 
        users: usersCount || 0, 
        admins: adminsCount || 0, 
        masterAdmins: masterAdminsCount || 0, 
        unansweredQuestions: unansweredCount || 0,
        loading: false 
      });

      // Fetch pending password requests for the Mailbox
      const { data: requestsData, error: reqError } = await supabase
        .from('admin_password_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
        
      setPendingRequests(requestsData || []);

      // Fetch pending Q&A questions for the Mailbox
      const { data: questionsData, error: qError } = await supabase
        .from('questions')
        .select('*, users!askedBy(*)')
        .is('answer', null)
        .order('created_at', { ascending: false });

      setPendingQuestions(questionsData || []);

      // Fetch user registration dates for analytics graphs
      const { data: usersData } = await supabase
        .from('users')
        .select('created_at, role');
      if (usersData) setUsersList(usersData);
    } catch (err) {
      console.error(err);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  const handleResolveRequest = async (id) => {
    try {
      await supabase.from('admin_password_requests').update({ status: 'resolved' }).eq('id', id);
      Toast.show({ type: 'success', text1: 'Success', text2: 'Request marked as resolved.' });
      fetchDashboardData();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    }
  };

  const handleRejectRequest = async (id) => {
    try {
      await supabase.from('admin_password_requests').update({ status: 'rejected' }).eq('id', id);
      Toast.show({ type: 'success', text1: 'Success', text2: 'Request rejected.' });
      fetchDashboardData();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    }
  };

  const handleApprove = async () => {
    setIsSendingReply(true);
    try {
      await supabase.from('admin_password_requests').update({ status: 'approved', admin_reply: replyText.trim() }).eq('id', replyModalData.id);
      Toast.show({ type: 'success', text1: 'Success', text2: 'Request approved.' });
      setReplyModalData(null);
      setReplyText('');
      fetchDashboardData();
      setShowMailbox(true);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleReject = async () => {
    if (!replyText.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a reason for rejection.' });
      return;
    }
    setIsSendingReply(true);
    try {
      await supabase.from('admin_password_requests').update({ status: 'rejected', reject_reason: replyText.trim() }).eq('id', replyModalData.id);
      Toast.show({ type: 'success', text1: 'Success', text2: 'Request rejected.' });
      setReplyModalData(null);
      setReplyText('');
      fetchDashboardData();
      setShowMailbox(true);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleChangeAdminPassword = async () => {
    if (!replyText || replyText.length < 6) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Password must be at least 6 characters long.' });
      return;
    }
    setIsSendingReply(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${API_URL}/api/admin/force-reset-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: replyModalData.email, newPassword: replyText, requestId: replyModalData.id })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to change password');
      
      Toast.show({ type: 'success', text1: 'Success', text2: 'Admin password changed successfully.' });
      setReplyModalData(null);
      setReplyText('');
      fetchDashboardData();
      setShowMailbox(true);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleOpenMailbox = async () => {
    setShowMailbox(true);
    try {
      const unreadReqs = pendingRequests.filter(r => !r.is_read).map(r => r.id);
      const unreadQs = pendingQuestions.filter(q => !q.is_read).map(q => q.id);
      
      if (unreadReqs.length > 0) {
        await supabase.from('admin_password_requests').update({ is_read: true }).in('id', unreadReqs);
      }
      if (unreadQs.length > 0) {
        await supabase.from('questions').update({ is_read: true }).in('id', unreadQs);
      }

      setPendingRequests(pendingRequests.map(r => ({...r, is_read: true})));
      setPendingQuestions(pendingQuestions.map(q => ({...q, is_read: true})));
    } catch(err) { console.error(err); }
  };

  const handleApproveAdmin = async (reqId, payloadString) => {
    try {
      const payload = JSON.parse(payloadString);
      if (!payload.user_id) throw new Error("User ID not found in request payload");
      if (!payload.masjidId) throw new Error("Masjid ID not found in request payload");

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(`${API_URL}/api/admin/users/${payload.user_id}/make-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ assignedMasjidId: payload.masjidId })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to make user admin');
      }
      
      Toast.show({ type: 'success', text1: 'Success', text2: 'User approved and assigned to the selected Masjid!' });
      
      await supabase.from('admin_password_requests').update({ status: 'approved' }).eq('id', reqId);
      fetchDashboardData();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    }
  };

  const downloadUsersExcel = async () => {
    setIsDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated. Please login again.');

      await downloadUsersExcelFile({ token });
    } catch (err) {
      console.error('[Excel Download Error]', err);
      Toast.show({ type: 'error', text1: 'Download Failed', text2: err.message });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout securely?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => logout() }
      ]
    );
  };

  const handleOpenBoardWhatsApp = async () => {
    setShowBoardModal(true);
    setLoadingBoard(true);
    try {
      const { data, error } = await supabase.from('board_members').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      setBoardMembers(data || []);
    } catch (err) {
      console.error(err);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to fetch board members' });
    } finally {
      setLoadingBoard(false);
    }
  };

  const menuItems = [
    { label: 'Create Admin', screen: 'CreateAdmin', icon: 'person-add', color: '#8e44ad', description: 'Give email & password' },
    { label: 'Manage Events', screen: 'Events', icon: 'calendar', color: '#e67e22', description: 'Add or edit events' },
    { label: 'Manage Ulamas', screen: 'ManageUlamas', icon: 'people', color: '#27ae60', description: 'Add Ulamas & Bayans' },
    { label: 'Manage Q&A', screen: 'AskQuestions', icon: 'chatbubbles', color: '#3498db', description: 'Answer user queries' },
    { label: 'Manage Donations', screen: 'Donation', icon: 'wallet', color: '#27ae60', description: 'Track & add donations' },
    { label: 'Manage Masjids', screen: 'ManageMasjid', icon: 'moon', color: '#1b6b3c', description: 'Add/Edit Masjids' },
    { label: 'Manage Users', screen: 'ManageUsers', icon: 'people-circle', color: '#3498db', description: 'View registered users' },
    { label: 'App Settings', screen: 'Settings', icon: 'settings', color: '#7f8c8d', description: 'Change Logo & Name' },
    { label: 'User Requests', screen: 'ManageRequests', icon: 'archive', color: '#e74c3c', description: 'View user requests' },
    { label: 'Board WhatsApp', screen: 'BOARD_WHATSAPP', icon: 'logo-whatsapp', color: '#25D366', description: 'Message Board Members' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>Dashboard Overview</Text>
        <Text style={styles.headerSubtitle}>Welcome back, {user?.name || user?.email?.split('@')[0] || 'Master Admin'}!</Text>
      </View>

      {/* Unified Stats Grid */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { borderTopColor: '#1b6b3c', borderTopWidth: 4 }]}>
          <View style={[styles.statIconWrap, { backgroundColor: '#eef6f0' }]}>
            <Ionicons name="star" size={24} color="#1b6b3c" />
          </View>
          <Text style={styles.statLabel}>Master Admins</Text>
          {stats.loading ? <ActivityIndicator color="#1b6b3c" /> : <Text style={styles.statValue}>{stats.masterAdmins}</Text>}
        </View>

        <View style={[styles.statCard, { borderTopColor: '#f39c12', borderTopWidth: 4 }]}>
          <View style={[styles.statIconWrap, { backgroundColor: '#fdf3e5' }]}>
            <Ionicons name="shield-checkmark" size={24} color="#f39c12" />
          </View>
          <Text style={styles.statLabel}>Local Admins</Text>
          {stats.loading ? <ActivityIndicator color="#f39c12" /> : <Text style={styles.statValue}>{stats.admins}</Text>}
        </View>

        <View style={[styles.statCard, { borderTopColor: '#3498db', borderTopWidth: 4 }]}>
          <View style={[styles.statIconWrap, { backgroundColor: '#eef6f9' }]}>
            <Ionicons name="people" size={24} color="#3498db" />
          </View>
          <Text style={styles.statLabel}>Total Users</Text>
          {stats.loading ? <ActivityIndicator color="#3498db" /> : <Text style={styles.statValue}>{stats.users}</Text>}
        </View>
      </View>

      {/* Download Users Excel Button */}
      <TouchableOpacity
        style={styles.downloadBtn}
        onPress={downloadUsersExcel}
        activeOpacity={0.8}
        disabled={isDownloading}
      >
        {isDownloading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="download-outline" size={20} color="#fff" />
        )}
        <Text style={styles.downloadBtnText}>
          {isDownloading ? 'Preparing Excel...' : 'Download All Users (Excel)'}
        </Text>
      </TouchableOpacity>

      {/* Interactive Platform Analytics & Graphs */}
      <AdminAnalyticsChart stats={stats} usersList={usersList} />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Admin Controls</Text>
      </View>

      {/* Premium Actions Grid */}
      <View style={styles.gridContainer}>
        {menuItems.map(item => (
          <TouchableOpacity 
            key={item.label} 
            style={styles.actionCard} 
            onPress={() => item.screen === 'BOARD_WHATSAPP' ? handleOpenBoardWhatsApp() : navigation.navigate(item.screen)} 
            activeOpacity={0.8}
          >
            {item.screen === 'AskQuestions' && stats.unansweredQuestions > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{stats.unansweredQuestions}</Text>
              </View>
            )}
            <View style={[styles.actionIconWrap, { backgroundColor: item.color + '20' }]}>
              <Ionicons name={item.icon} size={24} color={item.color} />
            </View>
            <View style={styles.actionTextWrap}>
               <Text style={styles.actionTitle}>{item.label}</Text>
               <Text style={styles.actionDesc}>{item.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
        
        {/* Mailbox Button */}
        <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#fff9f0', borderColor: '#fde9c8', borderWidth: 1 }]} onPress={handleOpenMailbox} activeOpacity={0.8}>
          {(pendingRequests.filter(r => !r.is_read).length + pendingQuestions.filter(q => !q.is_read).length) > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingRequests.filter(r => !r.is_read).length + pendingQuestions.filter(q => !q.is_read).length}</Text>
            </View>
          )}
          <View style={[styles.actionIconWrap, { backgroundColor: '#fde9c8' }]}>
            <Ionicons name="mail-unread" size={24} color="#e67e22" />
          </View>
          <View style={styles.actionTextWrap}>
             <Text style={styles.actionTitle}>Requests Inbox</Text>
             <Text style={styles.actionDesc}>View admin requests</Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Logout securely</Text>
      </TouchableOpacity>

      {/* Mailbox Modal */}
      <Modal visible={showMailbox} animationType="slide" transparent={true} onRequestClose={() => setShowMailbox(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="mail-unread" size={24} color="#1b6b3c" style={{ marginRight: 10 }} />
                <Text style={styles.modalTitle}>Admin Inbox</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMailbox(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {(pendingRequests.length === 0 && pendingQuestions.length === 0) ? (
                <View style={{ alignItems: 'center', marginTop: 60 }}>
                  <Ionicons name="checkmark-circle-outline" size={60} color="#ccc" style={{ marginBottom: 15 }} />
                  <Text style={styles.emptyInbox}>No pending requests in your inbox.</Text>
                </View>
              ) : (
                <>
                  {/* Admin/User Generic Requests */}
                  {pendingRequests.map(req => (
                    <TouchableOpacity 
                      key={`req-${req.id}`} 
                      style={styles.requestCard} 
                      onPress={() => {
                        if (req.request_type !== 'become_admin') {
                          setReplyModalData(req);
                          setReplyText('');
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.requestInfo}>
                        <View style={styles.reqTypeBadge}>
                           <Ionicons name={req.request_type === 'become_admin' ? 'person-add' : 'mail'} size={14} color="#e67e22" style={{marginRight: 4}} />
                           <Text style={styles.requestType}>
                             {req.request_type === 'password_reset' ? 'Admin: Forgot Password' : 
                              req.request_type === 'admin_event_upload' ? 'Admin: New Program Uploaded' : 
                              req.request_type === 'become_admin' ? 'Join Request: Admin' :
                              (req.request_type === 'user_request' ? 'User Support Request' : 'Admin Support Request')}
                           </Text>
                        </View>
                        
                        {req.request_type === 'become_admin' ? (
                          <>
                            {(() => {
                               try {
                                 const p = JSON.parse(req.message);
                                 return (
                                   <View style={styles.reqDataGrid}>
                                     <View style={styles.reqRow}>
                                       <Ionicons name="person" size={16} color="#7f8c8d" />
                                       <Text style={styles.reqLabel}>Name:</Text>
                                       <Text style={styles.reqValue}>{p.name}</Text>
                                     </View>
                                     <View style={styles.reqRow}>
                                       <Ionicons name="call" size={16} color="#7f8c8d" />
                                       <Text style={styles.reqLabel}>Phone:</Text>
                                       <Text style={styles.reqValue}>{req.phone}</Text>
                                     </View>
                                     <View style={styles.reqRow}>
                                       <Ionicons name="card" size={16} color="#7f8c8d" />
                                       <Text style={styles.reqLabel}>Aadhar:</Text>
                                       <Text style={styles.reqValue}>{p.aadhar}</Text>
                                     </View>
                                     <View style={styles.reqRow}>
                                       <Ionicons name="moon" size={16} color="#7f8c8d" />
                                       <Text style={styles.reqLabel}>Masjid:</Text>
                                       <Text style={styles.reqValue}>{p.masjidName}</Text>
                                     </View>
                                     <View style={styles.reqRow}>
                                       <Ionicons name="location" size={16} color="#7f8c8d" />
                                       <Text style={styles.reqLabel}>Area:</Text>
                                       <Text style={styles.reqValue}>{p.area}</Text>
                                     </View>
                                   </View>
                                 );
                               } catch (e) {
                                 return <Text style={styles.requestMessage}>Error parsing request data</Text>;
                               }
                            })()}
                            {req.photo_url && (
                               <View style={styles.imageContainer}>
                                 <Image source={{ uri: req.photo_url }} style={styles.verificationImage} />
                               </View>
                            )}
                          </>
                        ) : (
                          <View style={styles.reqDataGrid}>
                            <View style={styles.reqRow}>
                              <Ionicons name="mail" size={16} color="#7f8c8d" />
                              <Text style={styles.reqValue}>{req.email}</Text>
                            </View>
                            <View style={styles.reqRow}>
                              <Ionicons name="call" size={16} color="#7f8c8d" />
                              <Text style={styles.reqValue}>{req.phone}</Text>
                            </View>
                            {req.message && (
                              <View style={styles.messageBox}>
                                <Text style={styles.requestMessage} numberOfLines={3}>"{req.message}"</Text>
                              </View>
                            )}
                          </View>
                        )}
                        <Text style={styles.requestDate}>{req.created_at || req.createdAt ? new Date(req.created_at || req.createdAt).toLocaleDateString() : 'Unknown Date'}</Text>
                      </View>
                      
                      <View style={styles.requestActionRow}>
                        {req.request_type === 'become_admin' ? (
                          <TouchableOpacity style={[styles.resolveButton, { backgroundColor: '#2ecc71', marginRight: 10 }]} onPress={() => handleApproveAdmin(req.id, req.message)} activeOpacity={0.8}>
                            <Text style={[styles.resolveButtonText, { color: '#fff' }]}>Approve as Admin</Text>
                          </TouchableOpacity>
                        ) : req.request_type === 'password_reset' ? (
                          <TouchableOpacity style={[styles.resolveButton, { backgroundColor: '#e67e22', marginRight: 10 }]} onPress={() => { setReplyModalData(req); setReplyText(''); }} activeOpacity={0.8}>
                            <Text style={[styles.resolveButtonText, { color: '#fff' }]}>Change Password</Text>
                          </TouchableOpacity>
                        ) : null}
                        
                        {req.request_type === 'become_admin' ? (
                          <TouchableOpacity style={[styles.resolveButton, { backgroundColor: '#e74c3c' }]} onPress={() => handleRejectRequest(req.id)} activeOpacity={0.8}>
                            <Text style={[styles.resolveButtonText, { color: '#fff' }]}>Reject</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity style={styles.resolveButton} onPress={() => handleResolveRequest(req.id)} activeOpacity={0.8}>
                            <Text style={styles.resolveButtonText}>Mark Resolved</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}

                  {/* User Q&A Requests */}
                  {pendingQuestions.map(q => (
                    <View key={`qa-${q.id}`} style={[styles.requestCard, { borderLeftColor: '#3498db' }]}>
                      <View style={styles.requestInfo}>
                        <View style={[styles.reqTypeBadge, { backgroundColor: '#eaf4fc' }]}>
                           <Ionicons name="chatbubbles" size={14} color="#3498db" style={{marginRight: 4}} />
                           <Text style={[styles.requestType, { color: '#3498db' }]}>User Request: Q&A</Text>
                        </View>
                        <View style={styles.reqDataGrid}>
                          <View style={styles.reqRow}>
                            <Ionicons name="person" size={16} color="#7f8c8d" />
                            <Text style={styles.reqValue}>{q.users?.name || 'Unknown User'}</Text>
                          </View>
                          {q.users?.phone ? (
                            <View style={styles.reqRow}>
                              <Ionicons name="call" size={16} color="#7f8c8d" />
                              <Text style={styles.reqValue}>{q.users.phone}</Text>
                            </View>
                          ) : null}
                          <View style={styles.messageBox}>
                            <Text style={styles.requestMessage} numberOfLines={2}>Question: {q.text ? 'Encrypted Message' : '(Image)'}</Text>
                          </View>
                        </View>
                        <Text style={styles.requestDate}>{q.created_at || q.createdAt ? new Date(q.created_at || q.createdAt).toLocaleDateString() : 'Unknown Date'}</Text>
                      </View>
                      <View style={[styles.requestActionRow, { borderTopColor: '#eaf4fc' }]}>
                        <TouchableOpacity style={[styles.resolveButton, { backgroundColor: '#3498db' }]} onPress={() => {
                          setShowMailbox(false);
                          navigation.navigate('AskQuestions');
                        }} activeOpacity={0.8}>
                          <Text style={styles.resolveButtonText}>Open Q&A Screen</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          </View>

          {/* Reply Box (Slide-up Overlay inside the Mailbox Modal) */}
          {!!replyModalData && (
            <View style={styles.replyModalContent}>
              <Text style={styles.modalTitle}>
                {replyModalData?.request_type === 'password_reset' ? `Reset Password for ${replyModalData?.email}` : `Reply to ${replyModalData?.email}`}
              </Text>
              
              <View style={styles.originalMessageWrapper}>
                <Text style={styles.originalMessageLabel}>Message:</Text>
                <Text style={styles.originalMessageText}>{replyModalData?.message || 'No message provided.'}</Text>
              </View>

              <TextInput
                style={styles.replyInput}
                placeholder={replyModalData?.request_type === 'password_reset' ? "Enter new password (min 6 chars)..." : "Type reply or rejection reason..."}
                multiline={replyModalData?.request_type !== 'password_reset'}
                numberOfLines={replyModalData?.request_type === 'password_reset' ? 1 : 4}
                value={replyText}
                onChangeText={setReplyText}
                textAlignVertical={replyModalData?.request_type === 'password_reset' ? "center" : "top"}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setReplyModalData(null); setShowMailbox(true); }}>
                  <Text style={[styles.btnText, {color: '#555'}]}>Cancel</Text>
                </TouchableOpacity>
                {replyModalData?.request_type === 'password_reset' ? (
                  <TouchableOpacity style={[styles.saveBtn, {backgroundColor: '#e67e22', flex: 1}]} onPress={handleChangeAdminPassword} disabled={isSendingReply}>
                    {isSendingReply ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Change Password</Text>}
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity style={[styles.saveBtn, {backgroundColor: '#d9534f'}]} onPress={handleReject} disabled={isSendingReply}>
                      {isSendingReply ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reject</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleApprove} disabled={isSendingReply}>
                      {isSendingReply ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Approve</Text>}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}

        </View>
      </Modal>

      {/* Board WhatsApp Modal */}
      <Modal visible={showBoardModal} animationType="slide" transparent={true} onRequestClose={() => setShowBoardModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="logo-whatsapp" size={24} color="#25D366" style={{ marginRight: 10 }} />
                <Text style={styles.modalTitle}>Contact Board</Text>
              </View>
              <TouchableOpacity onPress={() => setShowBoardModal(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {loadingBoard ? (
                <ActivityIndicator size="large" color="#25D366" style={{ marginTop: 40 }} />
              ) : boardMembers.length === 0 ? (
                <Text style={styles.emptyInbox}>No board members found.</Text>
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
                      <Text style={{ fontSize: 13, color: '#555' }}>{member.designation}</Text>
                      {member.phone ? <Text style={{ fontSize: 12, color: '#27ae60', marginTop: 2 }}>{member.phone}</Text> : <Text style={{ fontSize: 12, color: '#e74c3c', marginTop: 2 }}>No phone added</Text>}
                    </View>
                    <TouchableOpacity 
                      style={[styles.whatsappBtn, !member.phone && { backgroundColor: '#ccc' }]} 
                      disabled={!member.phone}
                      onPress={() => {
                        let phone = member.phone.replace(/[^0-9]/g, '');
                        Linking.openURL(`whatsapp://send?phone=${phone}`);
                      }}
                    >
                      <Ionicons name="logo-whatsapp" size={18} color="#fff" style={{marginRight: 6}} />
                      <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 13}}>Chat</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f9f5' },
  scrollContent: { padding: 20, paddingTop: 30, paddingBottom: 40 },
  
  headerSection: { marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1b6b3c' },
  headerSubtitle: { fontSize: 14, color: '#7f8c8d', marginTop: 4 },

  statsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 15 },
  statCard: { width: '31%', backgroundColor: '#fff', borderRadius: 16, paddingVertical: 20, paddingHorizontal: 10, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 4 },
  statIconWrap: { padding: 12, borderRadius: 14, marginBottom: 10 },
  statIcon: { fontSize: 24 },
  statLabel: { color: '#7f8c8d', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center', marginBottom: 6 },
  statValue: { color: '#2c3e50', fontSize: 24, fontWeight: '800' },

  sectionHeader: { marginTop: 15, marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#2c3e50' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  actionCard: { width: '48%', backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  actionIconWrap: { backgroundColor: '#f5f9f6', width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  actionIcon: { fontSize: 24 },
  actionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 4 },
  actionDesc: { fontSize: 12, color: '#888', lineHeight: 16 },
  badge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#e74c3c', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 4 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  logoutButton: { backgroundColor: '#111', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#f8fdfa', borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '85%', padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 15 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eaeaea', marginBottom: 15 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1b6b3c' },
  closeButton: { backgroundColor: '#f0f0f0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  closeButtonText: { color: '#333', fontWeight: 'bold', fontSize: 13 },
  modalBody: { flex: 1 },
  emptyInbox: { textAlign: 'center', color: '#888', marginTop: 15, fontSize: 16, fontWeight: '500' },
  
  requestCard: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 15, elevation: 6, borderLeftWidth: 6, borderLeftColor: '#e67e22', overflow: 'hidden' },
  requestInfo: { padding: 20, paddingBottom: 15 },
  reqTypeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fdf3e5', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 15 },
  requestType: { fontSize: 13, fontWeight: '800', color: '#e67e22' },
  
  reqDataGrid: { marginTop: 5 },
  reqRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reqLabel: { fontSize: 13, fontWeight: '700', color: '#888', width: 60, marginLeft: 8 },
  reqValue: { fontSize: 14, fontWeight: '600', color: '#333', marginLeft: 8, flex: 1 },
  
  imageContainer: { marginTop: 15, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  verificationImage: { width: '100%', height: 160, resizeMode: 'cover' },
  
  messageBox: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  requestMessage: { fontSize: 14, color: '#444', fontStyle: 'italic', lineHeight: 20 },
  requestDate: { fontSize: 12, color: '#aaa', fontWeight: '600', marginTop: 15, alignSelf: 'flex-end' },
  
  requestActionRow: { flexDirection: 'row', padding: 15, backgroundColor: '#fafafa', borderTopWidth: 1, borderTopColor: '#eee' },
  resolveButton: { flex: 1, backgroundColor: '#f0f0f0', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resolveButtonText: { color: '#555', fontWeight: 'bold', fontSize: 14 },

  replyModalContent: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', padding: 24, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: {width: 0, height: -10} },
  originalMessageWrapper: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 12, marginBottom: 20, marginTop: 15 },
  originalMessageLabel: { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 4 },
  originalMessageText: { fontSize: 14, color: '#333', fontStyle: 'italic' },
  replyInput: { backgroundColor: '#f4f6f8', borderWidth: 1, borderColor: '#eaeaea', borderRadius: 16, padding: 16, height: 120, fontSize: 15, marginBottom: 20, color: '#333' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelBtn: { backgroundColor: '#f0f0f0', paddingVertical: 14, borderRadius: 12, flex: 0.3, alignItems: 'center' },
  saveBtn: { backgroundColor: '#1b6b3c', paddingVertical: 14, borderRadius: 12, flex: 0.32, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  
  boardMemberCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 12, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, borderWidth: 1, borderColor: '#eee' },
  boardMemberAvatar: { width: 50, height: 50, borderRadius: 25 },
  whatsappBtn: { flexDirection: 'row', backgroundColor: '#25D366', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, alignItems: 'center' },

  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1b6b3c', paddingVertical: 14, borderRadius: 14, marginBottom: 20, gap: 10, shadowColor: '#1b6b3c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  downloadBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', marginLeft: 8 },
});
