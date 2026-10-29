require('dotenv').config();
const { supabase } = require('./config/supabaseClient');

async function createAdmins() {
  const masterAdminEmail = 'jamateahlehadees085@jamat.com';
  const masterAdminPassword = 'ahlehadees.085';
  const adminEmail = 'admin@jamait.com';
  const adminPassword = 'Password@123';

  console.log('Setting up Master Admin and Admin accounts...');

  try {
    // 1. Setup Master Admin
    let masterAdminId;

    // Check if user exists
    const { data: existingMaster } = await supabase.from('users').select('id').eq('email', masterAdminEmail).single();

    if (existingMaster) {
      masterAdminId = existingMaster.id;
      await supabase.auth.admin.updateUserById(masterAdminId, { password: masterAdminPassword, user_metadata: { role: 'master_admin' } });
      console.log(`Updated existing Master Admin: ${masterAdminEmail}`);
    } else {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: masterAdminEmail,
        password: masterAdminPassword,
        email_confirm: true,
        user_metadata: {
          name: 'Master Admin',
          role: 'master_admin'
        }
      });
      if (createError) throw createError;
      masterAdminId = newUser.user.id;
      console.log(`Created new Master Admin: ${masterAdminEmail}`);

      // Update the user record created by the trigger
      await supabase.from('users').update({
        name: 'Master Admin',
        role: 'master_admin'
      }).eq('id', masterAdminId);
    }

    // 2. Setup Admin
    let normalAdminId;
    const { data: existingAdmin } = await supabase.from('users').select('id').eq('email', adminEmail).single();

    if (existingAdmin) {
      normalAdminId = existingAdmin.id;
      await supabase.auth.admin.updateUserById(normalAdminId, { password: adminPassword, user_metadata: { role: 'admin' } });
      console.log(`Updated existing Admin: ${adminEmail}`);
    } else {
      const { data: newAdminUser, error: adminCreateError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          name: 'App Admin',
          role: 'admin'
        }
      });
      if (adminCreateError) throw adminCreateError;
      normalAdminId = newAdminUser.user.id;
      console.log(`Created new Admin: ${adminEmail}`);

      // Update the user record created by the trigger
      await supabase.from('users').update({
        name: 'App Admin',
        role: 'admin'
      }).eq('id', normalAdminId);
    }

    console.log('\n--- SUCCESS ---');
    console.log(`Master Admin -> Email: ${masterAdminEmail} | Password: ${masterAdminPassword}`);
    console.log(`Admin        -> Email: ${adminEmail} | Password: ${adminPassword}`);
    console.log('-----------------\n');
    process.exit(0);

  } catch (error) {
    console.error('Error creating admins:', error);
    process.exit(1);
  }
}

createAdmins();
