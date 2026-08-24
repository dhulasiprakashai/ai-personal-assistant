const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.trim().split('=');
  if (parts[0]) {
    env[parts[0]] = parts.slice(1).join('=');
  }
});

const supabaseUrl = env.SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
});

async function run() {
  try {
    console.log('Inserting conversation...');
    const { data, error } = await supabase
      .from('conversations')
      .insert({ title: 'Test from script' })
      .select('id')
      .single();

    if (error) {
      console.error('Supabase error:', error);
    } else {
      console.log('Successfully inserted conversation:', data);
    }
  } catch (err) {
    console.error('Catch block error:', err);
  }
}

run();
