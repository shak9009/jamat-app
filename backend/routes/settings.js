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

  return router;
};
