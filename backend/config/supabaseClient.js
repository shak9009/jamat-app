const { createClient } = require('@supabase/supabase-js');

const rawUrl = process.env.SUPABASE_URL;
const SUPABASE_URL = (rawUrl && !rawUrl.includes('YOUR_') && rawUrl.startsWith('http'))
  ? rawUrl
  : 'https://mrcjmbvzrnhaiigschzt.supabase.co';

const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = (rawKey && !rawKey.includes('YOUR_') && rawKey.startsWith('eyJ'))
  ? rawKey
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yY2ptYnZ6cm5oYWlpZ3NjaHp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjU4NTk2MiwiZXhwIjoyMTAyMTYxOTYyfQ.auCaNTxgrV9t-u24Z5mmSlzmQ2mNOD5p44PZZsFVcWo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = { supabase };
