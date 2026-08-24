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
    console.log('Fetching conversations...');
    const { data: convs, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(5);

    if (convError) {
      console.error('Error fetching conversations:', convError);
      return;
    }

    console.log('Conversations:', JSON.stringify(convs, null, 2));

    if (convs.length > 0) {
      const convId = convs[0].id;
      console.log(`\nFetching messages for conversation ${convId}...`);
      const { data: msgs, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (msgError) {
        console.error('Error fetching messages:', msgError);
        return;
      }

      console.log('Messages:', JSON.stringify(msgs, null, 2));
    }
  } catch (err) {
    console.error('Catch block error:', err);
  }
}

run();
