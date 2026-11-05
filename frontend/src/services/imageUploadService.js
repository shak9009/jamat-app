import { supabase } from '../config/supabaseClient';

/**
 * Upload image to Supabase Storage
 * Replaces ImgBB uploads with Supabase Storage (uses anon key, requires RLS policies)
 *
 * @param {Object} params
 * @param {string} params.base64Image - Base64 encoded image data
 * @param {string} params.bucket - Storage bucket name (default: 'images')
 * @param {string} params.folder - Folder path within bucket (default: 'uploads')
 * @param {string} params.fileName - Optional custom filename
 * @returns {Promise<{url: string, path: string}>} Public URL and storage path
 */
export const uploadImageToSupabase = async ({
  base64Image,
  bucket = 'images',
  folder = 'uploads',
  fileName = null,
} = {}) => {
  if (!base64Image) {
    throw new Error('No image data provided');
  }

  // Convert base64 to blob
  const base64Response = await fetch(base64Image);
  const blob = await base64Response.blob();

  // Generate unique filename
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const ext = 'jpg'; // Default to jpg
  const name = fileName || `img-${timestamp}-${randomSuffix}.${ext}`;
  const filePath = `${folder}/${name}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, blob, {
      contentType: 'image/jpeg',
      upsert: false,
      cacheControl: '3600',
    });

  if (error) {
    console.error('Supabase Storage upload error:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return {
    url: publicUrlData.publicUrl,
    path: data.path,
  };
};

/**
 * Delete image from Supabase Storage
 * @param {Object} params
 * @param {string} params.path - Storage path from upload response
 * @param {string} params.bucket - Storage bucket name (default: 'images')
 * @returns {Promise<void>}
 */
export const deleteImageFromSupabase = async ({ path, bucket = 'images' }) => {
  if (!path) return;

  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.error('Supabase Storage delete error:', error);
    throw new Error(`Delete failed: ${error.message}`);
  }
};