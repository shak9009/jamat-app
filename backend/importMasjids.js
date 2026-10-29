require('dotenv').config();
const { supabase } = require('./config/supabaseClient');

async function importKurnoolMasjids() {
  try {
    console.log('Fetching from URL...');
    const res = await fetch('https://vdcrbvyrlaxblfvovxcx.supabase.co/functions/v1/directus-api/items/masjid_list?fields=*&limit=1000&sort=id&filter[status][_eq]=active');
    const json = await res.json();
    
    if (!json.data || !Array.isArray(json.data)) {
      throw new Error('Invalid data format received');
    }
    
    console.log(`Received ${json.data.length} total masjids.`);
    
    // Filter for Kurnool
    const kurnoolMasjids = json.data.filter(m => {
      const text = JSON.stringify(m).toLowerCase();
      return text.includes('kurnool');
    });
    
    console.log(`Found ${kurnoolMasjids.length} masjids containing "kurnool".`);
    
    if (kurnoolMasjids.length === 0) {
      console.log('No Kurnool masjids found to insert.');
      return;
    }
    
    console.log('Sample Kurnool Masjid:', kurnoolMasjids[0].name || kurnoolMasjids[0].masjid_name);
    
    // Map to our schema
    // Our masjids table has: id, name, address, timings_json, committee_json, image_url
    const insertData = kurnoolMasjids.map(m => {
      return {
        name: m.name || m.masjid_name || 'Unnamed Masjid',
        address: m.address || m.location || '',
        timings_json: m.timings || m.namaz_timings || {},
        committee_json: m.committee || {},
        image_url: m.image_url || m.image || null
      };
    });
    
    console.log('Inserting into Supabase...');
    const { data, error } = await supabase.from('masjids').insert(insertData).select();
    
    if (error) {
      console.error('Insert error:', error);
    } else {
      console.log(`Successfully inserted ${data.length} Kurnool masjids into the database!`);
    }
    
  } catch (error) {
    console.error('Error importing:', error);
  }
}

importKurnoolMasjids();
