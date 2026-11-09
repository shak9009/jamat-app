const express = require('express');
const { supabase } = require('../config/supabaseClient');
const crypto = require('crypto');

// Secret key matching frontend/src/config/encryption.js
const CryptoJS = require('crypto-js');
const SECRET_KEY = process.env.EXPO_PUBLIC_ENCRYPTION_KEY || 'default-super-secret-key-123';

function decryptText(ciphertext) {
  if (!ciphertext) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    if (!originalText) return ciphertext;
    return originalText;
  } catch (err) {
    return ciphertext;
  }
}

function encryptText(text) {
  if (!text) return text;
  try {
    return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
  } catch (err) {
    return text;
  }
}

module.exports = function() {
  const router = express.Router();

  // ------------------------------------------------------------------
  // GET /api/qa/chats
  // Returns all active chats grouped by user for admins
  // ------------------------------------------------------------------
  router.get('/chats', async (req, res) => {
    try {
      const { data: messages, error } = await supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const chatsMap = new Map();
      const userCache = {};

      for (const msg of (messages || [])) {
        // The user who is asking the question is either sender (if user) or receiver (if admin replied)
        // If receiver_id is null, sender_id is definitely the user asking
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

        // Skip chats if both sender and receiver are master_admin or admin chatting with themselves
        if (!chatsMap.has(targetUserId)) {
          chatsMap.set(targetUserId, {
            userId: targetUserId,
            userName: targetUser.name || 'User',
            userEmail: targetUser.email || '',
            userPhone: targetUser.phone || '',
            userRole: targetUser.role || 'user',
            userImage: targetUser.image_url || null,
            lastMessage: msg.text ? decryptText(msg.text) : (msg.image_url ? '📷 Image' : ''),
            lastMessageTime: msg.created_at,
            unreadCount: (!msg.receiver_id && !msg.is_read) ? 1 : 0
          });
        } else {
          if (!msg.receiver_id && !msg.is_read) {
            chatsMap.get(targetUserId).unreadCount += 1;
          }
        }
      }

      const chatList = Array.from(chatsMap.values());
      res.json({ success: true, chats: chatList });
    } catch (err) {
      console.error('Error fetching QA chats:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch chats' });
    }
  });

  // ------------------------------------------------------------------
  // GET /api/qa/messages
  // Returns all messages for a specific user ID
  // ------------------------------------------------------------------
  router.get('/messages', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const decryptedMessages = (data || []).map(m => ({
        ...m,
        text: m.text ? decryptText(m.text) : ''
      }));

      // If isAdmin query param is passed, mark unread messages from this user as read
      if (req.query.isAdmin === 'true' && data && data.length > 0) {
        const unreadIds = data
          .filter(m => m.sender_id === userId && !m.is_read)
          .map(m => m.id);

        if (unreadIds.length > 0) {
          await supabase
            .from('support_messages')
            .update({ is_read: true })
            .in('id', unreadIds);
        }
      }

      res.json({ success: true, messages: decryptedMessages });
    } catch (err) {
      console.error('Error fetching QA messages:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch messages' });
    }
  });

  // ------------------------------------------------------------------
  // POST /api/qa/send
  // Sends a support message using Service Role Key (bypassing RLS)
  // ------------------------------------------------------------------
  router.post('/send', async (req, res) => {
    const { sender_id, receiver_id, text, image_url } = req.body;

    if (!sender_id) {
      return res.status(400).json({ error: 'sender_id is required' });
    }

    if (!text && !image_url) {
      return res.status(400).json({ error: 'Message text or image is required' });
    }

    try {
      const encryptedText = text ? encryptText(text.trim()) : encryptText('(Image Only)');

      const { data, error } = await supabase
        .from('support_messages')
        .insert([{
          sender_id,
          receiver_id: receiver_id || null,
          text: encryptedText,
          image_url: image_url || null,
          is_read: false
        }])
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        message: {
          ...data,
          text: text ? text.trim() : '(Image Only)'
        }
      });
    } catch (err) {
      console.error('Error sending QA message:', err);
      res.status(500).json({ error: err.message || 'Failed to send message' });
    }
  });

  // ------------------------------------------------------------------
  // POST /api/qa/mark-read
  // ------------------------------------------------------------------
  router.post('/mark-read', async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    try {
      await supabase
        .from('support_messages')
        .update({ is_read: true })
        .eq('sender_id', userId)
        .eq('is_read', false);

      res.json({ success: true });
    } catch (err) {
      console.error('Error marking QA read:', err);
      res.status(500).json({ error: err.message || 'Failed to mark as read' });
    }
  });

  return router;
};

