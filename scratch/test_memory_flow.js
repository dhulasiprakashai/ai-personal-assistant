const { spawn } = require('child_process');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env variables
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.trim().split('=');
  if (parts[0]) {
    env[parts[0]] = parts.slice(1).join('=');
  }
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('Starting next dev server on port 3004...');
  const devServer = spawn('npx', ['next', 'dev', '-p', '3004'], {
    env: { ...process.env },
    shell: true
  });

  devServer.stdout.on('data', (data) => {
    process.stdout.write(`[SERVER STDOUT] ${data}`);
  });

  devServer.stderr.on('data', (data) => {
    process.stderr.write(`[SERVER STDERR] ${data}`);
  });

  // Wait 75 seconds for startup
  await wait(75000);

  try {
    console.log('\n--- Sending Message 1: "My name is Prakash." (New Conversation 1) ---');
    const res1 = await request({
      hostname: '127.0.0.1',
      port: 3004,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      message: 'My name is Prakash.'
    });

    console.log('Res 1 Status:', res1.statusCode);
    console.log('Res 1 Body:', res1.body);

    const parsed1 = JSON.parse(res1.body);
    const conversationId1 = parsed1.conversationId;

    if (!conversationId1) {
      console.error('No conversationId returned');
      process.exit(1);
    }

    // Wait a couple of seconds for memory extraction background execution to complete
    await wait(5000);

    console.log('\n--- Querying Supabase memories table for conversation ID:', conversationId1, '---');
    const { data: memories, error } = await supabase
      .from('memories')
      .select('*')
      .eq('conversation_id', conversationId1);

    if (error) {
      console.error('Supabase fetch memories error:', error);
    } else {
      console.log('Memories found in Supabase:', JSON.stringify(memories, null, 2));
    }

    console.log('\n--- Sending Message 2: "What is my name?" (New Conversation 2) ---');
    const res2 = await request({
      hostname: '127.0.0.1',
      port: 3004,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      message: 'What is my name?'
    });

    console.log('Res 2 Status:', res2.statusCode);
    console.log('Res 2 Body:', res2.body);

    console.log('\n--- Sending Message 3: "What is my favorite color?" (New Conversation 3) ---');
    const res3 = await request({
      hostname: '127.0.0.1',
      port: 3004,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      message: 'What is my favorite color?'
    });

    console.log('Res 3 Status:', res3.statusCode);
    console.log('Res 3 Body:', res3.body);

    console.log('\n--- Sending Message 4: "hello" (New Conversation 4) ---');
    const res4 = await request({
      hostname: '127.0.0.1',
      port: 3004,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      message: 'hello'
    });

    console.log('Res 4 Status:', res4.statusCode);
    console.log('Res 4 Body:', res4.body);

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    console.log('Cleaning up...');
    const taskkill = spawn('powershell', ['-Command', 'Stop-Process -Id (Get-NetTCPConnection -LocalPort 3004 -ErrorAction SilentlyContinue).OwningProcess -Force'], { shell: true });
    taskkill.on('exit', () => {
      console.log('Dev server on 3004 killed.');
      process.exit(0);
    });
  }
}

run();
