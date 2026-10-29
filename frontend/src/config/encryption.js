import CryptoJS from 'crypto-js';

// The secret key used to encrypt/decrypt Q&A messages. 
// In production, this should be an environment variable.
const SECRET_KEY = process.env.EXPO_PUBLIC_ENCRYPTION_KEY || 'default-super-secret-key-123';

export const encryptMessage = (text) => {
  if (!text) return text;
  try {
    return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
  } catch (err) {
    console.error('Encryption failed:', err);
    return text;
  }
};

export const decryptMessage = (ciphertext) => {
  if (!ciphertext) return ciphertext;
  try {
    // If it's plain text (not encrypted), decryption might return empty or throw
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    
    // If decryption yields empty but ciphertext wasn't empty, it probably wasn't encrypted
    if (!originalText) return ciphertext;
    
    return originalText;
  } catch (err) {
    // Fallback to original text for backward compatibility with unencrypted messages
    return ciphertext;
  }
};
