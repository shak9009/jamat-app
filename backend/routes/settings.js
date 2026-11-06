const express = require('express');
const { supabase } = require('../config/supabaseClient');

module.exports = () => {
  const router = express.Router();

  // GET Settings (with cache-control to minimize egress)
  router.get('/', async (req, res) => {
    try {
      const { data, error } = await supabase.from('app_settings').select('*').eq('id', '1').single();
      
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      if (error || !data) {
        return res.json({ app_name: 'JamaitApp', logo_url: null });
      }

      return res.json(data);
    } catch (err) {
      console.error('Settings GET Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT Settings (Master Admin only)
  router.put('/', async (req, res) => {
    try {
      const { app_name, logo_url } = req.body;

      const { data, error } = await supabase
        .from('app_settings')
        .upsert({
          id: '1',
          app_name, 
          logo_url, 
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return res.json({ message: 'Settings updated successfully', data });
    } catch (err) {
      console.error('Settings PUT Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST Upload Image (Fallback server-side upload with service role key)
  router.post('/upload-image', async (req, res) => {
    try {
      let { base64Image, folder = 'uploads', bucket = 'images', fileName } = req.body;
      if (!base64Image) {
        return res.status(400).json({ error: 'base64Image is required' });
      }

      if (base64Image.includes(';base64,')) {
        base64Image = base64Image.split(';base64,')[1];
      }

      const buffer = Buffer.from(base64Image, 'base64');
      const name = fileName || `img-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
      const filePath = `${folder}/${name}`;

      try {
        await supabase.storage.createBucket(bucket, { public: true });
      } catch (_) {}

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, buffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return res.json({ url: publicUrlData.publicUrl, path: filePath });
    } catch (err) {
      console.error('Image Upload Error:', err);
      return res.status(500).json({ error: err.message || 'Failed to upload image' });
    }
  });

  return router;
};
