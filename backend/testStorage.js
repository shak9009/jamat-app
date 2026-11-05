const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Please set them in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Error listing buckets:', error.message);
    return;
  }
  console.log('Buckets:', buckets.map(b => b.name));

  const bucketName = 'app-releases';
  const exists = buckets.some(b => b.name === bucketName);
  if (!exists) {
    const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true
    });
    if (createError) {
      console.error('Error creating bucket:', createError.message);
    } else {
      console.log('Bucket created successfully:', bucketName);
    }
  } else {
    console.log('Bucket already exists:', bucketName);
  }
}

checkBucket();