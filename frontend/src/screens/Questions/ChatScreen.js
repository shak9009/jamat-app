import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { encryptMessage, decryptMessage } from '../../config/encryption';
import { API_URL } from '../../config/apiConfig';
import { uploadImageToSupabase } from '../../services/imageUploadService';
import Toast from 'react-native-toast-message';

export default function ChatScreen({ route, navigation }) {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin' || role === 'master_admin';

  const chatUserId = route?.params?.chatUserId;
  const chatUserName = route?.params?.chatUserName || (isAdmin ? 'User' : 'Jamait Support');
  const chatUserEmail = route?.params?.chatUserEmail || '';

  // The conversation is anchored around the user's ID
  const activeUserId = isAdmin ? chatUserId : user?.id;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({
      title: chatUserName,
      headerStyle: { backgroundColor: '#1b6b3c' },
      headerTintColor: '#fff',
    });

    if (activeUserId) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 4000); // Polling every 4s for real-time replies
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [activeUserId]);

  const fetchMessages = async () => {
    if (!activeUserId) return;

    try {
      // 1. Try Backend API first (Service Role Key bypasses RLS cleanly)
      let backendFetched = false;
      try {
        const response = await fetch(`${API_URL}/api/qa/messages?userId=${activeUserId}&isAdmin=${isAdmin}`);
        const data = await response.json();
        if (response.ok && data.success && Array.isArray(data.messages)) {
          setMessages(data.messages);
          backendFetched = true;
        }
      } catch (apiErr) {
        console.warn('Backend fetch QA messages fallback to Supabase:', apiErr.message);
      }

      // 2. Direct Supabase fallback
      if (!backendFetched) {
        const { data, error } = await supabase
          .from('support_messages')
          .select('*')
          .or(`sender_id.eq.${activeUserId},receiver_id.eq.${activeUserId}`)
          .order('created_at', { ascending: true });

        if (error) throw error;

        const decrypted = (data || []).map(m => ({
          ...m,
          text: m.text ? decryptMessage(m.text) : ''
        }));

        setMessages(decrypted);

        // If admin viewing, mark unread user messages as read
        if (isAdmin && data && data.length > 0) {
          const unread = data.filter(m => m.sender_id === activeUserId && !m.is_read).map(m => m.id);
          if (unread.length > 0) {
            await supabase.from('support_messages').update({ is_read: true }).in('id', unread);
          }
        }
      }
    } catch (err) {
      console.error('Fetch messages error:', err);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0]);
      }
    } catch (err) {
      console.warn('Image picker error:', err);
    }
  };

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed && !selectedImage) return;

    if (!user?.id) {
      Toast.show({
        type: 'error',
        text1: 'Sign In Required',
        text2: 'Please sign in to send questions or messages.',
        position: 'top',
      });
      return;
    }

    setUploading(true);
    const messageContent = trimmed;
    const currentSelectedImage = selectedImage;
    setText('');
    setSelectedImage(null);

    // Optimistic UI preview
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      sender_id: user.id,
      receiver_id: isAdmin ? activeUserId : null,
      text: messageContent,
      image_url: currentSelectedImage?.uri || null,
      created_at: new Date().toISOString(),
      is_read: false,
    };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      let uploadedUrl = null;
      if (currentSelectedImage) {
        Toast.show({ type: 'info', text1: 'Uploading attachment...', position: 'top', visibilityTime: 2000 });
        const uploadResult = await uploadImageToSupabase(
          currentSelectedImage.base64 || currentSelectedImage.uri,
          'chat'
        );
        uploadedUrl = uploadResult?.url || uploadResult;
      }

      const receiverId = isAdmin ? activeUserId : null;

      // 1. Try Backend API first (Service Role Key bypasses RLS)
      let sentViaBackend = false;
      try {
        const response = await fetch(`${API_URL}/api/qa/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender_id: user.id,
            receiver_id: receiverId,
            text: messageContent,
            image_url: uploadedUrl,
          }),
        });

        const data = await response.json();
        if (response.ok && data.success) {
          sentViaBackend = true;
        }
      } catch (backendErr) {
        console.warn('Backend send QA message warning:', backendErr.message);
      }

      // 2. Direct Supabase fallback
      if (!sentViaBackend) {
        const encryptedText = messageContent ? encryptMessage(messageContent) : encryptMessage('(Image Only)');
        const { error } = await supabase.from('support_messages').insert({
          sender_id: user.id,
          receiver_id: receiverId,
          text: encryptedText,
          image_url: uploadedUrl,
          is_read: false,
        });

        if (error) throw error;
      }

      // Refresh chat list to get real DB row
      fetchMessages();
    } catch (err) {
      console.error('Send message error:', err);
      Toast.show({
        type: 'error',
        text1: 'Message Failed',
        text2: err.message || 'Could not send message. Please try again.',
        position: 'top',
      });
      // Revert optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setText(messageContent);
      setSelectedImage(currentSelectedImage);
    } finally {
      setUploading(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.sender_id === user?.id;

    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperRight : styles.messageWrapperLeft]}>
        <View style={[styles.messageBubble, isMe ? styles.messageBubbleRight : styles.messageBubbleLeft]}>
          <Text style={[styles.senderLabel, isMe ? styles.senderLabelRight : styles.senderLabelLeft]}>
            {isMe ? 'You' : (isAdmin ? (chatUserName || 'User') : 'Jamait Support')}
          </Text>

          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.messageImage} />
          ) : null}

          {item.text && item.text !== '(Image Only)' ? (
            <Text style={[styles.messageText, isMe ? styles.messageTextRight : styles.messageTextLeft]}>
              {item.text}
            </Text>
          ) : null}

          <View style={styles.timeRow}>
            <Text style={[styles.timeText, isMe ? styles.timeTextRight : styles.timeTextLeft]}>
              {item.created_at
                ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : ''}
            </Text>
            {isMe && (
              <Ionicons
                name={item.is_read ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={item.is_read ? '#34b7f1' : '#888'}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header Info Banner for Admins */}
      {isAdmin && (
        <View style={styles.adminHeaderBanner}>
          <Ionicons name="person-circle" size={24} color="#1b6b3c" />
          <View style={{ flex: 1 }}>
            <Text style={styles.adminHeaderText} numberOfLines={1}>{chatUserName}</Text>
            {chatUserEmail ? <Text style={styles.adminSubText} numberOfLines={1}>{chatUserEmail}</Text> : null}
          </View>
        </View>
      )}

      {/* Messages List */}
      <View style={styles.chatBackground}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1b6b3c" />
            <Text style={{ marginTop: 10, color: '#666' }}>Loading conversation...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={54} color="#b2d8c0" />
                <Text style={styles.emptyTitle}>
                  {isAdmin ? 'No messages yet from this user' : 'Ask Your Question'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {isAdmin
                    ? 'Reply here to send advice, guidance, or answers directly to this user.'
                    : 'Type your Islamic question or inquiry below. Jamait committee & Ulamas will reply to you directly.'}
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Selected Image Preview */}
      {selectedImage && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: selectedImage.uri }} style={styles.previewThumbnail} />
          <TouchableOpacity style={styles.removeImageBtn} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.iconButton} onPress={pickImage} activeOpacity={0.7}>
          <Ionicons name="camera-outline" size={26} color="#1b6b3c" />
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          placeholder={isAdmin ? 'Write reply to user...' : 'Ask your question here...'}
          placeholderTextColor="#999"
          value={text}
          onChangeText={setText}
          multiline
        />

        <TouchableOpacity
          style={[styles.sendButton, (!text.trim() && !selectedImage) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={uploading || (!text.trim() && !selectedImage)}
          activeOpacity={0.8}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f1' },
  adminHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#c8e6c9',
    gap: 10,
  },
  adminHeaderText: { fontSize: 15, fontWeight: '700', color: '#0a3d1f' },
  adminSubText: { fontSize: 12, color: '#555' },
  chatBackground: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 14, paddingBottom: 20 },
  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#0a3d1f', marginTop: 14 },
  emptySubtitle: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 18 },

  messageWrapper: { marginBottom: 10, flexDirection: 'row' },
  messageWrapperRight: { justifyContent: 'flex-end' },
  messageWrapperLeft: { justifyContent: 'flex-start' },

  messageBubble: {
    maxWidth: '82%',
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  messageBubbleRight: { backgroundColor: '#dcf8c6', borderBottomRightRadius: 4 },
  messageBubbleLeft: { backgroundColor: '#ffffff', borderBottomLeftRadius: 4 },

  senderLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  senderLabelRight: { color: '#075e54', alignSelf: 'flex-end' },
  senderLabelLeft: { color: '#1b6b3c' },

  messageText: { fontSize: 15, lineHeight: 20, marginBottom: 2 },
  messageTextRight: { color: '#111' },
  messageTextLeft: { color: '#111' },

  timeRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 2 },
  timeText: { fontSize: 10 },
  timeTextRight: { color: '#667781' },
  timeTextLeft: { color: '#667781' },

  messageImage: { width: 220, height: 220, borderRadius: 10, marginBottom: 6, resizeMode: 'cover' },

  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0ebd7',
    padding: 10,
    paddingHorizontal: 16,
  },
  previewThumbnail: { width: 56, height: 56, borderRadius: 8, borderWidth: 2, borderColor: '#fff' },
  removeImageBtn: {
    marginLeft: 12,
    backgroundColor: '#e74c3c',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  iconButton: { padding: 6, marginRight: 6 },
  textInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 15,
    maxHeight: 100,
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#1b6b3c',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#a3c2b0',
  },
});
