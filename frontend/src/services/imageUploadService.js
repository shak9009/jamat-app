import { supabase } from '../config/supabaseClient';
import { API_URL } from '../config/apiConfig';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';

/**
 * Robust Image Upload to Supabase Storage
 * Supports raw Base64, Data URI, and file:// URIs.
 * Uses native ArrayBuffer decoding (replaces unstable fetch-to-blob in React Native).
 * Automatically falls back to backend service role upload if client RLS/bucket fails.
 *
 * @param {Object|string} params - Upload options object OR raw base64 string
 * @param {string} [secondaryFolder='uploads'] - Folder if params is passed as string
 * @returns {Promise<{url: string, path: string}>} Public URL and storage path
 */
export const uploadImageToSupabase = async (params, secondaryFolder = 'uploads') => {
  let base64Image = null;
  let bucket = 'images';
  let folder = 'uploads';
  let fileName = null;

  if (typeof params === 'string') {
    base64Image = params;
    folder = secondaryFolder || 'uploads';
  } else if (params && typeof params === 'object') {
    base64Image = params.base64Image || params.image || params.uri || null;
    bucket = params.bucket || 'images';
    folder = params.folder || 'uploads';
    fileName = params.fileName || null;
  }

  if (!base64Image) {
    throw new Error('No image data provided for upload');
  }

  let cleanBase64 = base64Image;

  // 1. If it's a file:// URI, read directly as base64 via FileSystem
  if (typeof cleanBase64 === 'string' && cleanBase64.startsWith('file://')) {
    try {
      cleanBase64 = await FileSystem.readAsStringAsync(cleanBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (fsErr) {
      console.warn('FileSystem read URI error:', fsErr?.message);
    }
  }

  // 2. Strip data URI prefix (e.g. "data:image/jpeg;base64,")
  if (typeof cleanBase64 === 'string' && cleanBase64.includes(';base64,')) {
    cleanBase64 = cleanBase64.split(';base64,')[1];
  }

  // Clean any leading/trailing whitespace or newlines
  if (typeof cleanBase64 === 'string') {
    cleanBase64 = cleanBase64.trim();
  }

  // 3. Generate unique filename
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const ext = 'jpg';
  const name = fileName || `img-${timestamp}-${randomSuffix}.${ext}`;
  const filePath = `${folder}/${name}`;

  let publicUrl = null;
  let storagePath = filePath;

  // 4. Try Direct Supabase Storage Upload using base64-arraybuffer
  try {
    const arrayBuffer = decode(cleanBase64);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600',
      });

    if (!error && data) {
      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      if (publicUrlData && publicUrlData.publicUrl) {
        publicUrl = publicUrlData.publicUrl;
        storagePath = data.path;
      }
    } else if (error) {
      console.warn('Direct Supabase Storage upload failed, trying backend fallback:', error.message);
    }
  } catch (directErr) {
    console.warn('Direct upload exception, trying backend fallback:', directErr?.message);
  }

  // 5. Automatic Backend Fallback (Service Role Key bypasses RLS/bucket restrictions)
  if (!publicUrl) {
    try {
      console.log('Attempting backend upload fallback via:', `${API_URL}/api/upload-image`);
      const backendRes = await fetch(`${API_URL}/api/upload-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Image: cleanBase64,
          folder,
          bucket,
          fileName: name,
        }),
      });

      const backendData = await backendRes.json();
      if (backendRes.ok && backendData.url) {
        publicUrl = backendData.url;
        storagePath = backendData.path || filePath;
      } else {
        throw new Error(backendData.error || 'Server upload failed');
      }
    } catch (backendErr) {
      console.error('All image upload methods failed:', backendErr);
      throw new Error(`Upload failed: ${backendErr.message || 'Please check your connection and try again.'}`);
    }
  }

  return {
    url: publicUrl,
    path: storagePath,
    toString: () => publicUrl,
  };
};

/**
 * Delete image from Supabase Storage
 */
export const deleteImageFromSupabase = async ({ path, bucket = 'images' }) => {
  if (!path) return;

  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      console.warn('Supabase Storage delete warning:', error.message);
    }
  } catch (err) {
    console.warn('Delete image exception:', err?.message);
  }
};

export default {
  uploadImageToSupabase,
  deleteImageFromSupabase,
};
