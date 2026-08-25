const { spawn } = require('child_process');
const http = require('http');

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

  // Wait 120 seconds for startup
  await wait(120000);

  try {
    // ----------------------------------------------------
    // Test 1: Save memory in first conversation
    // ----------------------------------------------------
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

    console.log('Sleeping 15 seconds to respect rate limits...');
    await wait(15000);

    // ----------------------------------------------------
    // Test 2: Existing memory recall in new conversation
    // ----------------------------------------------------
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

    console.log('Sleeping 15 seconds to respect rate limits...');
    await wait(15000);

    // ----------------------------------------------------
    // Test 3: Save memory (favorite color = blue)
    // ----------------------------------------------------
    console.log('\n--- Sending Message 3: "My favorite color is blue." (New Conversation 3) ---');
    const res3 = await request({
      hostname: '127.0.0.1',
      port: 3004,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      message: 'My favorite color is blue.'
    });
    console.log('Res 3 Status:', res3.statusCode);
    console.log('Res 3 Body:', res3.body);

    console.log('Sleeping 15 seconds to respect rate limits...');
    await wait(15000);

    // ----------------------------------------------------
    // Test 4: Explicit memory retrieval
    // ----------------------------------------------------
    console.log('\n--- Sending Message 4: "What do you remember about my favorite color?" (New Conversation 4) ---');
    const res4 = await request({
      hostname: '127.0.0.1',
      port: 3004,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      message: 'What do you remember about my favorite color?'
    });
    console.log('Res 4 Status:', res4.statusCode);
    console.log('Res 4 Body:', res4.body);

    console.log('Sleeping 15 seconds to respect rate limits...');
    await wait(15000);

    // ----------------------------------------------------
    // Test 5: Update memory (favorite color = green now)
    // ----------------------------------------------------
    console.log('\n--- Sending Message 5: "My favorite color is green now." (New Conversation 5) ---');
    const res5 = await request({
      hostname: '127.0.0.1',
      port: 3004,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      message: 'My favorite color is green now.'
    });
    console.log('Res 5 Status:', res5.statusCode);
    console.log('Res 5 Body:', res5.body);

    console.log('Sleeping 15 seconds to respect rate limits...');
    await wait(15000);

    // ----------------------------------------------------
    // Test 6: Delete memory (Forget my favorite color)
    // ----------------------------------------------------
    console.log('\n--- Sending Message 6: "Forget my favorite color." (New Conversation 6) ---');
    const res6 = await request({
      hostname: '127.0.0.1',
      port: 3004,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      message: 'Forget my favorite color.'
    });
    console.log('Res 6 Status:', res6.statusCode);
    console.log('Res 6 Body:', res6.body);

    console.log('Sleeping 15 seconds to respect rate limits...');
    await wait(15000);

    // ----------------------------------------------------
    // Test 7: Unknown memory (What is my favorite car?)
    // ----------------------------------------------------
    console.log('\n--- Sending Message 7: "What is my favorite car?" (New Conversation 7) ---');
    const res7 = await request({
      hostname: '127.0.0.1',
      port: 3004,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      message: 'What is my favorite car?'
    });
    console.log('Res 7 Status:', res7.statusCode);
    console.log('Res 7 Body:', res7.body);

    console.log('Sleeping 15 seconds to respect rate limits...');
    await wait(15000);

    // ----------------------------------------------------
    // Test 8: Normal Chat (hello)
    // ----------------------------------------------------
    console.log('\n--- Sending Message 8: "hello" (New Conversation 8) ---');
    const res8 = await request({
      hostname: '127.0.0.1',
      port: 3004,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      message: 'hello'
    });
    console.log('Res 8 Status:', res8.statusCode);
    console.log('Res 8 Body:', res8.body);

    console.log('Sleeping 15 seconds to respect rate limits...');
    await wait(15000);

    // ----------------------------------------------------
    // Test 9: Datetime regression (What time is it?)
    // ----------------------------------------------------
    console.log('\n--- Sending Message 9: "What time is it?" (New Conversation 9) ---');
    const res9 = await request({
      hostname: '127.0.0.1',
      port: 3004,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      message: 'What time is it?'
    });
    console.log('Res 9 Status:', res9.statusCode);
    console.log('Res 9 Body:', res9.body);

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
