const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mrcjmbvzrnhaiigschzt.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is required in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function upload() {
  const apkPath = path.resolve(__dirname, '../frontend/android/app/build/outputs/apk/release/app-release.apk');
  
  if (!fs.existsSync(apkPath)) {
    console.error(`APK not found at: ${apkPath}`);
    process.exit(1);
  }

  const fileStats = fs.statSync(apkPath);
  const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
  console.log(`📦 Found APK: ${apkPath} (${fileSizeMB} MB)`);

  const fileBuffer = fs.readFileSync(apkPath);
  const fileName = 'JamaitApp.apk';

  console.log(`🚀 Uploading to Supabase Storage bucket 'app-releases'...`);
  const { data, error } = await supabase.storage
    .from('app-releases')
    .upload(fileName, fileBuffer, {
      contentType: 'application/vnd.android.package-archive',
      upsert: true,
      cacheControl: '3600'
    });

  if (error) {
    console.error('❌ Upload failed:', error.message);
    process.exit(1);
  }

  const { data: publicUrlData } = supabase.storage
    .from('app-releases')
    .getPublicUrl(fileName);

  const directInstallUrl = publicUrlData.publicUrl;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(directInstallUrl)}`;

  console.log('\n==================================================');
  console.log('🎉 APK UPLOADED SUCCESSFULLY!');
  console.log('📲 Direct Install URL:\n' + directInstallUrl);
  console.log('\n📷 Scan QR Code to Install:\n' + qrCodeUrl);
  console.log('==================================================\n');
}

upload();
