import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { decryptMessage } from '../../config/encryption';
import { API_URL } from '../../config/apiConfig';
import ChatScreen from './ChatScreen';

export default function AskQuestionsScreen({ navigation, route }) {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin' || role === 'master_admin';
  const [chatList, setChatList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: isAdmin ? 'Manage Q&A Chats' : 'Jamait Q&A Support',
      headerStyle: { backgroundColor: '#1b6b3c' },
      headerTintColor: '#fff',
    });

    if (isAdmin) {
      fetchChatList();
      const interval = setInterval(fetchChatList, 6000); // Polling every 6s for new incoming questions
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  const fetchChatList = async () => {
    try {
      // 1. Try backend API first (uses Service Role Key to bypass RLS)
      try {
        const res = await fetch(`${API_URL}/api/qa/chats`);
        const json = await res.json();
        if (res.ok && json.success && Array.isArray(json.chats)) {
          setChatList(json.chats);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      } catch (apiErr) {
        console.warn('Backend fetch QA chats warning, trying Supabase direct:', apiErr.message);
      }

      // 2. Direct Supabase fallback
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const chatsMap = new Map();
      const userCache = {};

      for (const msg of (data || [])) {
        const targetUserId = msg.receiver_id ? msg.receiver_id : msg.sender_id;
        if (!targetUserId) continue;

        if (!userCache[targetUserId]) {
          const { data: uData } = await supabase
            .from('users')
            .select('id, name, email, phone, role, image_url')
            .eq('id', targetUserId)
            .single();

          userCache[targetUserId] = uData || { id: targetUserId, name: 'User' };
        }

        const targetUser = userCache[targetUserId];

        if (!chatsMap.has(targetUserId)) {
          chatsMap.set(targetUserId, {
            userId: targetUserId,
            userName: targetUser.name || 'User',
            userEmail: targetUser.email || '',
            userPhone: targetUser.phone || '',
            userRole: targetUser.role || 'user',
            userImage: targetUser.image_url || null,
            lastMessage: msg.text ? decryptMessage(msg.text) : (msg.image_url ? '📷 Image' : ''),
            lastMessageTime: msg.created_at,
            unreadCount: (!msg.receiver_id && !msg.is_read) ? 1 : 0
          });
        } else {
          if (!msg.receiver_id && !msg.is_read) {
            chatsMap.get(targetUserId).unreadCount += 1;
          }
        }
      }

      setChatList(Array.from(chatsMap.values()));
    } catch (err) {
      console.error('Error fetching chat list:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchChatList();
  }, [isAdmin]);

  // If normal user, directly render the ChatScreen
  if (!isAdmin) {
    return <ChatScreen route={route} navigation={navigation} />;
  }

  const renderChatItem = ({ item }) => {
    const messageDate = item.lastMessageTime ? new Date(item.lastMessageTime) : null;
    const timeDisplay = messageDate
      ? (new Date().toDateString() === messageDate.toDateString()
          ? messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' }))
      : '';

    return (
      <TouchableOpacity 
        style={styles.chatCard} 
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ChatScreen', {
          chatUserId: item.userId,
          chatUserName: item.userName,
          chatUserEmail: item.userEmail,
          chatUserPhone: item.userPhone,
        })}
      >
        <View style={styles.avatar}>
          {item.userImage ? (
            <Image source={{ uri: item.userImage }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={24} color="#1b6b3c" />
          )}
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName} numberOfLines={1}>{item.userName}</Text>
            <Text style={styles.chatTime}>{timeDisplay}</Text>
          </View>

          {item.userEmail ? (
            <Text style={styles.userEmailText} numberOfLines={1}>✉️ {item.userEmail}</Text>
          ) : null}

          <View style={styles.chatFooter}>
            <Text style={[styles.chatLastMessage, item.unreadCount > 0 && styles.chatLastMessageUnread]} numberOfLines={1}>
              {item.lastMessage || 'No message text'}
            </Text>
            {item.unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={16} color="#bbb" />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.adminBanner}>
        <Ionicons name="chatbubbles" size={20} color="#1b6b3c" />
        <Text style={styles.adminBannerText}>
          {role === 'master_admin' ? 'Master Admin Q&A Inbox' : 'Admin Q&A Inbox'}
        </Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1b6b3c" />
          <Text style={{ marginTop: 12, color: '#666' }}>Loading user questions...</Text>
        </View>
      ) : (
        <FlatList
          data={chatList}
          keyExtractor={item => item.userId}
          renderItem={renderChatItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1b6b3c']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={56} color="#ccc" />
              <Text style={styles.emptyTitle}>No Questions Yet</Text>
              <Text style={styles.emptySubtitle}>When users ask questions, they will appear here for you to reply.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faf9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#c8e6c9',
    gap: 8,
  },
  adminBannerText: { fontSize: 13, fontWeight: '700', color: '#1b6b3c' },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eef2ee',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0ebd7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  chatInfo: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  chatName: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', flex: 1, marginRight: 8 },
  chatTime: { fontSize: 11, color: '#888' },
  userEmailText: { fontSize: 12, color: '#666', marginBottom: 4 },
  chatFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatLastMessage: { fontSize: 13, color: '#777', flex: 1, paddingRight: 10 },
  chatLastMessageUnread: { color: '#0a3d1f', fontWeight: 'bold' },
  badge: {
    backgroundColor: '#25D366',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#555', marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
