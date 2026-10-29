require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Supabase Client is used in routes directly, no need for global auth/db here
const { supabase } = require('./config/supabaseClient');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// OTPs are now handled via Supabase DB
// Route Imports
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const donationRoutes = require('./routes/donation');
const settingsRoutes = require('./routes/settings');

// Rate Limiting (Egress)
let cachedLimit = 500;
let lastFetchTime = 0;

const getDailyLimit = async () => {
  const now = Date.now();
  if (now - lastFetchTime > 60000) { // Refresh every 1 minute
    try {
      if (supabase) {
        const { data, error } = await supabase.from('app_settings').select('value').eq('id', '1').single();
        if (!error && data && data.value && data.value.daily_api_limit) {
          cachedLimit = parseInt(data.value.daily_api_limit, 10);
        }
      }
      lastFetchTime = now;
    } catch (err) {
      console.error('Error fetching rate limit:', err?.message);
    }
  }
  return cachedLimit;
};

const apiLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours window
  max: getDailyLimit, 
  message: { error: 'Daily request limit exceeded. Please try again tomorrow.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiter to all API routes
app.use('/api', apiLimiter);

// Health Check route
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: '🚀 Jamait Backend is running cleanly' });
});

// Use Routes
app.use('/api', authRoutes());
app.use('/api/admin', adminRoutes());
app.use('/api/donation', donationRoutes());
app.use('/api/settings', settingsRoutes());

// ------------------------------------------------------------------
// Server Initialization
// ------------------------------------------------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  console.log(`🚀 Jamait backend running cleanly on port ${PORT}`);
});
