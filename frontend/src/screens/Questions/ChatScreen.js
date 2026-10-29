import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { encryptMessage, decryptMessage } from '../../config/encryption';
import Toast from 'react-native-toast-message';

export default function ChatScreen({ route, navigation }) {
  const chatUserId = route.params?.chatUserId;
  const chatUserName = route.params?.chatUserName || 'Support Chat';
  
  const { user, role } = useAuth();
  const isAdmin = role === 'master_admin';
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
      headerTintColor: '#fff'
    });
    fetchMessages();
    
    const interval = setInterval(fetchMessages, 5000); // Polling every 5s
    return () => clearInterval(interval);
  }, [activeUserId]);

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

  const fetchMessages = async () => {
    if (!activeUserId) return;
    try {
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
      
      if (isAdmin && data && data.length > 0) {
        const unread = data.filter(m => m.sender_id === activeUserId && !m.is_read).map(m => m.id);
        if (unread.length > 0) {
          await supabase.from('support_messages').update({ is_read: true }).in('id', unread);
        }
      }
    } catch (err) {
      console.error('Fetch messages error:', err);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled) setSelectedImage(result.assets[0]);
  };

  const sendMessage = async () => {
    if (!text.trim() && !selectedImage) return;
    setUploading(true);
    try {
      let imageUrl = null;
      if (selectedImage?.base64) {
        Toast.show({ type: 'info', text1: 'Uploading...', text2: 'Uploading image' });
        imageUrl = await uploadImageToImgbb(selectedImage.base64);
      }

      const encryptedText = text.trim() ? encryptMessage(text.trim()) : encryptMessage('(Image Only)');
      const receiver_id = isAdmin ? chatUserId : null;

      const { error } = await supabase.from('support_messages').insert({
        sender_id: user.id,
        receiver_id: receiver_id,
        text: encryptedText,
        image_url: imageUrl,
        is_read: false
      });

      if (error) throw error;

      setText('');
      setSelectedImage(null);
      fetchMessages();
    } catch (err) {
      console.error('Send message error:', err);
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to send message' });
    } finally {
      setUploading(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.sender_id === user.id;
    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperRight : styles.messageWrapperLeft]}>
        <View style={[styles.messageBubble, isMe ? styles.messageBubbleRight : styles.messageBubbleLeft]}>
          {item.image_url && <Image source={{ uri: item.image_url }} style={styles.messageImage} />}
          {item.text !== '(Image Only)' && <Text style={[styles.messageText, isMe ? styles.messageTextRight : styles.messageTextLeft]}>{item.text}</Text>}
          <Text style={[styles.timeText, isMe ? styles.timeTextRight : styles.timeTextLeft]}>
            {item.created_at || item.createdAt ? new Date(item.created_at || item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown Time'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={styles.chatBackground}>
        {loading ? (
          <ActivityIndicator size="large" color="#1b6b3c" style={{marginTop: 20}} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({animated: true})}
            onLayout={() => flatListRef.current?.scrollToEnd({animated: true})}
            ListEmptyComponent={<Text style={styles.emptyText}>Start a conversation...</Text>}
          />
        )}
      </View>

      {selectedImage && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: selectedImage.uri }} style={styles.previewThumbnail} />
          <TouchableOpacity style={styles.removeImageBtn} onPress={() => setSelectedImage(null)}>
            <Text style={styles.removeImageText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.iconButton} onPress={pickImage}>
          <Ionicons name="camera-outline" size={28} color="#888" />
        </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          placeholder="Message"
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={uploading}>
          {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={20} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e5ddd5' },
  chatBackground: { flex: 1 },
  listContent: { padding: 15, paddingBottom: 20 },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 16 },
  
  messageWrapper: { marginBottom: 10, flexDirection: 'row' },
  messageWrapperRight: { justifyContent: 'flex-end' },
  messageWrapperLeft: { justifyContent: 'flex-start' },
  
  messageBubble: { maxWidth: '80%', padding: 10, paddingHorizontal: 14, borderRadius: 16, elevation: 1, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.1, shadowRadius: 1 },
  messageBubbleRight: { backgroundColor: '#dcf8c6', borderBottomRightRadius: 4 },
  messageBubbleLeft: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  
  messageText: { fontSize: 16, marginBottom: 4 },
  messageTextRight: { color: '#000' },
  messageTextLeft: { color: '#000' },
  
  timeText: { fontSize: 11, alignSelf: 'flex-end' },
  timeTextRight: { color: '#667781' },
  timeTextLeft: { color: '#667781' },
  
  messageImage: { width: 220, height: 220, borderRadius: 10, marginBottom: 5, resizeMode: 'cover' },
  
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#f0f0f0', paddingBottom: Platform.OS === 'ios' ? 30 : 10 },
  iconButton: { padding: 8, marginRight: 5 },
  textInput: { flex: 1, backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, fontSize: 16, maxHeight: 100 },
  sendButton: { backgroundColor: '#1b6b3c', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  
  previewContainer: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#e5ddd5', padding: 10 },
  previewThumbnail: { width: 60, height: 60, borderRadius: 8, borderWidth: 2, borderColor: '#fff' },
  removeImageBtn: { position: 'absolute', top: 5, left: 60, backgroundColor: 'red', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  removeImageText: { color: '#fff', fontSize: 10, fontWeight: 'bold' }
});
