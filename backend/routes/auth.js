const express = require('express');
const { supabase } = require('../config/supabaseClient');

module.exports = function() {
  const router = express.Router();

  // ------------------------------------------------------------------
  // API: Send OTP
  // ------------------------------------------------------------------
  router.post('/send-otp', async (req, res) => {
    const { phone, email } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }

    try {
      const { data: phoneQuery } = await supabase.from('users').select('id').eq('phone', phone).limit(1);
      if (phoneQuery && phoneQuery.length > 0) {
        return res.status(400).json({ error: 'This phone number is already registered. Please login.' });
      }

      if (email) {
        const { data: emailQuery } = await supabase.from('users').select('id').eq('email', email.toLowerCase().trim()).limit(1);
        if (emailQuery && emailQuery.length > 0) {
          return res.status(400).json({ error: 'This email address is already registered.' });
        }
      }

      if (req.body.aadhaar) {
        const { data: aadhaarQuery } = await supabase.from('users').select('id').eq('aadhaar', req.body.aadhaar.trim()).limit(1);
        if (aadhaarQuery && aadhaarQuery.length > 0) {
          return res.status(400).json({ error: 'This Aadhaar number is already registered.' });
        }
      }
    } catch (err) {
      console.error('Error checking existing user:', err);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    // Save OTP to DB
    await supabase.from('otps').delete().eq('phone', phone); // Clear old OTPs
    await supabase.from('otps').insert([{ phone, otp, expires_at: expiresAt }]);

    console.log('\n=============================================');
    console.log(`📱 DUMMY OTP FOR ${phone} IS: ${otp}`);
    console.log('=============================================\n');
    
    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    if (false /* fast2smsKey */) { // Temporarily disabled Fast2SMS
      try {
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': fast2smsKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Your Jamait App OTP is: ${otp}`,
            language: 'english',
            route: 'q',
            numbers: phone
          })
        });
        const result = await response.json();
        if (!result.return) {
          console.error('Fast2SMS Error:', result);
        } else {
          console.log(`SMS Sent successfully to ${phone} via Fast2SMS`);
        }
      } catch (err) {
        console.error('Error sending SMS via Fast2SMS:', err);
      }
    }

    res.json({ success: true, message: 'OTP sent successfully' });
  });

  // ------------------------------------------------------------------
  // API: Send OTP for Password Reset
  // ------------------------------------------------------------------
  router.post('/send-reset-otp', async (req, res) => {
    const { phone } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }

    try {
      const { data: users, error } = await supabase.from('users').select('*').eq('phone', phone).limit(1);
      if (error || !users || users.length === 0) {
        return res.status(400).json({ error: 'This phone number is not registered.' });
      }

      const existingUser = users[0];

      if (existingUser.role === 'master_admin') {
        return res.status(403).json({ error: 'Master Admin password cannot be reset via the app.' });
      }

      if (existingUser.role === 'admin') {
        return res.json({ role: existingUser.role, email: existingUser.email });
      }

    } catch (err) {
      return res.status(400).json({ error: 'This phone number is not registered.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    // Save OTP to DB
    await supabase.from('otps').delete().eq('phone', phone); // Clear old OTPs
    await supabase.from('otps').insert([{ phone, otp, expires_at: expiresAt }]);

    console.log(`[DEV ONLY] Reset Password OTP for ${phone} is ${otp}`);

    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    if (false /* fast2smsKey */) { // Temporarily disabled Fast2SMS
      try {
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': fast2smsKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Your Jamait App Password Reset OTP is: ${otp}`,
            language: 'english',
            route: 'q',
            numbers: phone
          })
        });
        const result = await response.json();
        if (!result.return) {
          console.error('Fast2SMS Error:', result);
        } else {
          console.log(`Reset SMS Sent successfully to ${phone} via Fast2SMS`);
        }
      } catch (err) {
        console.error('Error sending Reset SMS via Fast2SMS:', err);
      }
    }

    res.json({ message: 'OTP sent successfully', role: 'user' });
  });

  // ------------------------------------------------------------------
  // API: Admin Request Password Reset (Uploads image)
  // ------------------------------------------------------------------
  router.post('/admin-request-password-reset', async (req, res) => {
    const { phone, email, base64Image, message } = req.body;
    
    if (!phone || !email || !base64Image) {
      return res.status(400).json({ error: 'Phone, email, and photo are required.' });
    }

    try {
      const buffer = Buffer.from(base64Image, 'base64');
      const fileExt = 'jpeg';
      const fileName = `adminpwdreq-${Date.now()}.${fileExt}`;
      const filePath = `requests/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, buffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('images').getPublicUrl(filePath);
      const publicUrl = publicUrlData.publicUrl;

      const { error: insertError } = await supabase.from('admin_password_requests').insert([{
        email,
        phone,
        photo_url: publicUrl,
        message,
        request_type: 'password_reset',
        status: 'pending'
      }]);

      if (insertError) throw insertError;

      res.json({ success: true });
    } catch (err) {
      console.error('Admin Password Request Error:', err);
      res.status(500).json({ error: 'Failed to submit password reset request.' });
    }
  });

  // ------------------------------------------------------------------
  // API: Verify OTP & Register
  // ------------------------------------------------------------------
  router.post('/verify-otp-register', async (req, res) => {
    const { phone, otp, name, email, aadhaar, password, occupation } = req.body;
    
    if (!phone || !otp || !name || !email || !aadhaar || !password || !occupation || !occupation.trim()) {
      return res.status(400).json({ error: 'All fields including Occupation are required' });
    }

    const { data: record, error: otpError } = await supabase.from('otps').select('*').eq('phone', phone).single();
    
    if (otpError || !record || new Date() > new Date(record.expires_at) || record.otp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password: password,
        email_confirm: true,
        user_metadata: {
          name: name.trim(),
          phone: phone.trim(),
          aadhaar: aadhaar.trim(),
          occupation: occupation.trim(),
          role: 'user'
        }
      });

      if (authError) {
        if (authError.message.includes('already registered') || authError.status === 422) {
          return res.status(400).json({ error: 'This email address is already registered. Please login or use a different email.' });
        }
        throw authError;
      }

      // Sync into public.users table (try with occupation first, fallback if schema cache hasn't refreshed)
      try {
        await supabase.from('users').upsert({
          id: authData.user.id,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          aadhaar: aadhaar.trim(),
          occupation: occupation.trim(),
          role: 'user'
        });
      } catch (upsertErr) {
        try {
          await supabase.from('users').upsert({
            id: authData.user.id,
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            aadhaar: aadhaar.trim(),
            role: 'user'
          });
        } catch (fallbackErr) {
          console.warn('public.users fallback upsert error:', fallbackErr.message);
        }
      }

      // Clear OTP from DB
      await supabase.from('otps').delete().eq('phone', phone);
      res.json({ success: true, message: 'Registration successful' });

    } catch (err) {
      console.error('Registration Error:', err);
      res.status(500).json({ error: 'Internal server error during registration' });
    }
  });

  // ------------------------------------------------------------------
  // API: Get Email By Phone (For Login Flow)
  // ------------------------------------------------------------------
  router.post('/get-email-by-phone', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    try {
      const { data: users, error } = await supabase.from('users').select('email').eq('phone', phone).limit(1);

      if (error || !users || users.length === 0) {
        return res.status(404).json({ error: 'No user found with this phone number' });
      }

      res.json({ email: users[0].email });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ------------------------------------------------------------------
  // API: Forgot Password Verify OTP & Reset
  // ------------------------------------------------------------------
  router.post('/verify-otp', async (req, res) => {
    const { phone, otp, newPassword } = req.body;
    
    if (!phone || !otp || !newPassword) {
      return res.status(400).json({ error: 'Phone, OTP, and New Password are required' });
    }

    const { data: record, error: otpError } = await supabase.from('otps').select('*').eq('phone', phone).single();
    
    if (otpError || !record || new Date() > new Date(record.expires_at) || record.otp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    try {
      const { data: users, error } = await supabase.from('users').select('id').eq('phone', phone).limit(1);

      if (error || !users || users.length === 0) {
        return res.status(404).json({ error: 'No user found with this phone number' });
      }

      const uid = users[0].id;

      const { error: updateError } = await supabase.auth.admin.updateUserById(uid, { password: newPassword });
      
      if (updateError) throw updateError;

      await supabase.from('otps').delete().eq('phone', phone);
      res.json({ success: true, message: 'Password reset successfully' });
    } catch (err) {
      console.error('Password Reset Error:', err);
      res.status(500).json({ error: 'Internal server error while resetting password' });
    }
  });

  // ------------------------------------------------------------------
  // API: Get User Requests
  // ------------------------------------------------------------------
  router.get('/my-requests', async (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError) throw userError;
      
      const uid = userData.user.id;
      
      const { data, error } = await supabase.from('admin_password_requests')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ------------------------------------------------------------------
  // API: Login (For Web/App passing email/password instead of direct Supabase login)
  // Note: Direct Supabase login is preferred in the frontend, but we keep this for compatibility.
  // ------------------------------------------------------------------
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;

      let userProfile = { role: 'user' }; 
      const { data: userDoc } = await supabase.from('users').select('*').eq('id', data.user.id).single();
      
      if (userDoc) {
        userProfile = userDoc;
      }

      res.json({ success: true, token: data.session.access_token, uid: data.user.id, user: userProfile });
    } catch (err) {
      console.error('Login error:', err);
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  return router;
};
