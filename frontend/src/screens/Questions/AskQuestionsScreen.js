import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { decryptMessage } from '../../config/encryption';
import ChatScreen from './ChatScreen';

export default function AskQuestionsScreen({ navigation, route }) {
  const { user, role } = useAuth();
  const isAdmin = role === 'master_admin';
  const [chatList, setChatList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      fetchChatList();
      const interval = setInterval(fetchChatList, 10000); // Polling every 10s
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  const fetchChatList = async () => {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const chatsMap = new Map();
      const userCache = {};

      for (const msg of (data || [])) {
        const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!otherUserId) continue;

        if (!userCache[otherUserId]) {
          const { data: uData } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('id', otherUserId)
            .single();

          if (uData) {
            userCache[otherUserId] = uData;
          } else {
            userCache[otherUserId] = { id: otherUserId, name: 'User' };
          }
        }
        
        const otherUser = userCache[otherUserId];

        if (!chatsMap.has(otherUserId)) {
          chatsMap.set(otherUserId, {
            userId: otherUserId,
            userName: otherUser.name || 'User',
            userEmail: otherUser.email,
            lastMessage: msg.text ? decryptMessage(msg.text) : 'Image',
            lastMessageTime: msg.created_at,
            unreadCount: (msg.sender_id === otherUserId && !msg.is_read) ? 1 : 0
          });
        } else {
          if (msg.sender_id === otherUserId && !msg.is_read) {
            chatsMap.get(otherUserId).unreadCount += 1;
          }
        }
      }

      setChatList(Array.from(chatsMap.values()));
    } catch (err) {
      console.error('Error fetching chat list:', err);
    } finally {
      setLoading(false);
    }
  };

  // If normal user, directly render the ChatScreen
  if (!isAdmin) {
    return <ChatScreen route={route} navigation={navigation} />;
  }

  const renderChatItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.chatCard} 
      activeOpacity={0.7}
      onPress={() => navigation.navigate('ChatScreen', { chatUserId: item.userId, chatUserName: item.userName })}
    >
      <View style={styles.avatar}>
        <Ionicons name="person" size={24} color="#1b6b3c" />
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{item.userName}</Text>
          <Text style={styles.chatTime}>{new Date(item.lastMessageTime).toLocaleDateString()}</Text>
        </View>
        <View style={styles.chatFooter}>
          <Text style={styles.chatLastMessage} numberOfLines={1}>{item.lastMessage}</Text>
          {item.unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#1b6b3c" style={{marginTop: 20}} />
      ) : (
        <FlatList
          data={chatList}
          keyExtractor={item => item.userId}
          renderItem={renderChatItem}
          contentContainerStyle={{ padding: 15 }}
          ListEmptyComponent={<Text style={styles.empty}>No active chats found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  chatCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e0ebd7', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  chatInfo: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  chatName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  chatTime: { fontSize: 12, color: '#888' },
  chatFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatLastMessage: { fontSize: 14, color: '#666', flex: 1, paddingRight: 10 },
  badge: { backgroundColor: '#25D366', borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 16 }
});
