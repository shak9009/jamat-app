const express = require('express');
const { supabase } = require('../config/supabaseClient');
const { verifyToken, requireAdmin, requireMasterAdmin } = require('../middleware/authMiddleware');
const { generateUsersExcel } = require('../services/excelService');

module.exports = function () {
  const router = express.Router();

  // Apply verifyToken middleware to all admin routes
  router.use(verifyToken);

  // ------------------------------------------------------------------
  // API: Admin Operations
  // ------------------------------------------------------------------
  router.post('/force-reset-password', requireMasterAdmin, async (req, res) => {
    const { email, newPassword, requestId } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }
    try {
      const { data: users, error: dbError } = await supabase.from('users').select('id').eq('email', email).limit(1);
      if (dbError || !users || users.length === 0) {
        return res.status(404).json({ error: 'No user found with this email' });
      }
      const uid = users[0].id;

      const { error: updateError } = await supabase.auth.admin.updateUserById(uid, { password: newPassword });
      if (updateError) throw updateError;

      if (requestId) {
        await supabase.from('admin_password_requests').update({ status: 'resolved' }).eq('id', requestId);
      }
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
      console.error('Force Reset Password Error:', err);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  router.post('/voters/bulk-import', requireAdmin, async (req, res) => {
    const { voters } = req.body;
    if (!Array.isArray(voters)) return res.status(400).json({ error: 'voters must be an array' });

    try {
      const { error } = await supabase.from('voters').insert(voters);
      if (error) throw error;
      res.json({ imported: voters.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/users/:uid/make-admin', requireMasterAdmin, async (req, res) => {
    const { assignedMasjidId } = req.body || {};

    if (assignedMasjidId) {
      const { data: users, error } = await supabase.from('users').select('id').eq('assigned_masjid_id', assignedMasjidId);

      if (!error && users) {
        const adminCount = users.filter(doc => doc.id !== req.params.uid).length;
        if (adminCount >= 2) {
          return res.status(400).json({ error: 'A masjid can have a maximum of 2 admins.' });
        }
      }
    }

    try {
      // In Supabase, role is managed in the public.users table or raw_user_meta_data
      const { error: authError } = await supabase.auth.admin.updateUserById(req.params.uid, {
        user_metadata: { role: 'admin' }
      });
      if (authError) throw authError;

      const updatePayload = { role: 'admin' };
      if (assignedMasjidId) {
        updatePayload.assigned_masjid_id = assignedMasjidId;
      }

      const { error: dbError } = await supabase.from('users').update(updatePayload).eq('id', req.params.uid);
      if (dbError) throw dbError;

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/create-admin', requireMasterAdmin, async (req, res) => {
    const { email, password, name, mobile, imageUrl, assignedMasjidId } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });

    if (assignedMasjidId) {
      const { data: users, error } = await supabase.from('users').select('id').eq('assigned_masjid_id', assignedMasjidId);
      if (!error && users && users.length >= 2) {
        return res.status(400).json({ error: 'A masjid can have a maximum of 2 admins.' });
      }
    }

    if (mobile) {
      const { data: existingUser } = await supabase.from('users').select('id').eq('phone', mobile.trim()).limit(1);
      if (existingUser && existingUser.length > 0) {
        return res.status(400).json({ error: 'This mobile number is already registered to another account.' });
      }
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password: password,
        email_confirm: true,
        user_metadata: {
          name: name.trim(),
          phone: mobile ? mobile.trim() : null,
          role: 'admin'
        }
      });

      if (authError) throw authError;

      const dbInsert = {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        phone: mobile ? mobile.trim() : null,
        role: 'admin',
        image_url: imageUrl || null
      };
      if (assignedMasjidId) {
        dbInsert.assigned_masjid_id = assignedMasjidId;
      }

      // Update the user record created by the trigger
      const { error: updateError } = await supabase.from('users').update(dbInsert).eq('id', authData.user.id);
      if (updateError) throw updateError;

      res.json({ success: true, user: authData.user });
    } catch (error) {
      console.error("Backend Error (Create Admin):", error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/reset-admin-password', requireMasterAdmin, async (req, res) => {
    const { uid, newPassword } = req.body;
    if (!uid || !newPassword) return res.status(400).json({ error: 'Missing fields' });

    try {
      const { error } = await supabase.auth.admin.updateUserById(uid, { password: newPassword });
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/delete-admin/:uid', requireMasterAdmin, async (req, res) => {
    const uid = req.params.uid;

    try {
      await supabase.from('masjids').update({ created_by: null }).eq('created_by', uid);
      await supabase.from('events').update({ created_by: null }).eq('created_by', uid);
      await supabase.from('system_logs').update({ admin_id: null }).eq('admin_id', uid);

      const { error: authError } = await supabase.auth.admin.deleteUser(uid);
      if (authError) throw authError;

      // The users table should cascade delete, but we can do it explicitly just in case
      await supabase.from('users').delete().eq('id', uid);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/update-admin/:uid', requireMasterAdmin, async (req, res) => {
    const { name, mobile, email, password, imageUrl, assignedMasjidId } = req.body;

    if (assignedMasjidId) {
      const { data: users, error } = await supabase.from('users').select('id').eq('assigned_masjid_id', assignedMasjidId);
      if (!error && users) {
        const count = users.filter(doc => doc.id !== req.params.uid).length;
        if (count >= 2) {
          return res.status(400).json({ error: 'A masjid can have a maximum of 2 admins.' });
        }
      }
    }

    try {
      let authUpdates = {};
      if (email) authUpdates.email = email;
      if (password) authUpdates.password = password;

      let userMetadata = {};
      if (name) userMetadata.name = name;
      if (mobile) userMetadata.phone = mobile;

      if (Object.keys(userMetadata).length > 0) {
        authUpdates.user_metadata = userMetadata;
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabase.auth.admin.updateUserById(req.params.uid, authUpdates);
        if (authError) throw authError;
      }

      const dbUpdates = {};
      if (name) dbUpdates.name = name;
      if (mobile !== undefined) dbUpdates.phone = mobile ? mobile.trim() : null;
      if (imageUrl !== undefined) dbUpdates.image_url = imageUrl;
      if (assignedMasjidId !== undefined) {
        dbUpdates.assigned_masjid_id = assignedMasjidId || null;
      }

      if (Object.keys(dbUpdates).length > 0) {
        const { error: dbError } = await supabase.from('users').update(dbUpdates).eq('id', req.params.uid);
        if (dbError) throw dbError;
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ------------------------------------------------------------------
  // API: Ulamas & Bayans
  // ------------------------------------------------------------------

  router.post('/ulamas', requireAdmin, async (req, res) => {
    const { name, imageUrl } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
      const { data, error } = await supabase.from('ulamas').insert([{
        name,
        image_url: imageUrl
      }]).select().single();

      if (error) throw error;
      res.json({ success: true, ulama: data });
    } catch (err) {
      console.error('Error creating ulama:', err);
      res.status(500).json({ error: 'Failed to create Ulama' });
    }
  });

  router.delete('/ulamas/:id', requireAdmin, async (req, res) => {
    try {
      const { error } = await supabase.from('ulamas').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete Ulama' });
    }
  });

  router.post('/bayans', requireAdmin, async (req, res) => {
    const { ulamaId, title, youtubeLink } = req.body;
    if (!ulamaId || !youtubeLink) return res.status(400).json({ error: 'Ulama ID and YouTube Link are required' });

    try {
      const { data, error } = await supabase.from('bayans').insert([{
        ulama_id: ulamaId,
        title: title || 'Bayan',
        youtube_link: youtubeLink
      }]).select().single();

      if (error) throw error;
      res.json({ success: true, bayan: data });
    } catch (err) {
      console.error('Error creating bayan:', err);
      res.status(500).json({ error: 'Failed to create Bayan' });
    }
  });

  router.delete('/bayans/:id', requireAdmin, async (req, res) => {
    try {
      const { error } = await supabase.from('bayans').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete Bayan' });
    }
  });

  // Helper to enrich users with metadata like occupation
  const enrichUsersWithMetadata = async (userList = []) => {
    try {
      let authMap = {};
      const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (authData && authData.users) {
        authData.users.forEach(u => {
          if (u.user_metadata) authMap[u.id] = u.user_metadata;
        });
      }

      return userList.map(u => ({
        ...u,
        occupation: u.occupation || authMap[u.id]?.occupation || 'N/A'
      }));
    } catch (e) {
      return userList.map(u => ({
        ...u,
        occupation: u.occupation || 'N/A'
      }));
    }
  };

  // ------------------------------------------------------------------
  // API: Get ALL users (bypasses RLS via service role key) - Only Master Admin
  // ------------------------------------------------------------------
  router.get('/all-users', requireMasterAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'user')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const enriched = await enrichUsersWithMetadata(data || []);
      res.json({ users: enriched });
    } catch (err) {
      console.error('Error fetching all users:', err);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // ------------------------------------------------------------------
  // API: Export Users to Styled A4 Excel (Master Admin Only)
  // ------------------------------------------------------------------
  const handleExportExcel = async (req, res) => {
    try {
      const { userIds, returnBase64 } = (req.method === 'POST' ? req.body : req.query) || {};
      let userList = [];

      if (Array.isArray(userIds) && userIds.length > 0) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .in('id', userIds)
          .order('created_at', { ascending: false });
        if (error) throw error;
        userList = data || [];
      } else {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('role', 'user')
          .order('created_at', { ascending: false });
        if (error) throw error;
        userList = data || [];
      }

      const enriched = await enrichUsersWithMetadata(userList);
      const buffer = await generateUsersExcel(enriched);
      const fileName = `Shari_Jamate_Ahle_Hadith_Users_${new Date().toISOString().slice(0, 10)}.xlsx`;

      const shouldReturnBase64 = returnBase64 === true || returnBase64 === 'true' || req.query.format === 'base64';
      if (shouldReturnBase64) {
        return res.json({
          success: true,
          fileName,
          count: userList.length,
          base64: Buffer.from(buffer).toString('base64'),
        });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('Error exporting users Excel:', err);
      res.status(500).json({ error: 'Failed to generate Excel file: ' + err.message });
    }
  };

  router.post('/users/export-excel', requireMasterAdmin, handleExportExcel);
  router.get('/users/export-excel', requireMasterAdmin, handleExportExcel);

  router.delete('/users/bulk', requireMasterAdmin, async (req, res) => {
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'An array of userIds is required' });
    }

    try {
      // 1. Instantly delete from public.users table in one batch query
      try {
        await supabase.from('users').delete().in('id', userIds);
      } catch (dbErr) {
        console.warn('public.users batch delete notice:', dbErr.message);
      }

      // 2. High-speed concurrent deletion from auth.users (worker pool of 30)
      let deleted = 0;
      const concurrency = Math.min(30, userIds.length);
      let index = 0;

      async function worker() {
        while (index < userIds.length) {
          const uid = userIds[index++];
          try {
            const { error } = await supabase.auth.admin.deleteUser(uid);
            if (!error) deleted++;
          } catch (e) {
            // Continue with remaining
          }
        }
      }

      const workers = Array.from({ length: concurrency }, () => worker());
      await Promise.all(workers);

      res.json({ success: true, deletedCount: deleted || userIds.length });
    } catch (err) {
      console.error('Bulk delete users error:', err);
      res.status(500).json({ error: 'Failed to delete users: ' + err.message });
    }
  });

  return router;
};
