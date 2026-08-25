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
    console.log('\n--- Sending Message 1: "hello" (Normal Conversation) ---');
    const res1 = await request({
      hostname: '127.0.0.1',
      port: 3004,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      message: 'hello'
    });

    console.log('Res 1 Status:', res1.statusCode);
    console.log('Res 1 Body:', res1.body);

    const parsed1 = JSON.parse(res1.body);
    const conversationId = parsed1.conversationId;

    // Sleep to respect free tier rate limit of 5 requests per minute
    console.log('Sleeping 15 seconds to respect rate limits...');
    await wait(15000);

    console.log('\n--- Sending Message 2: "What is the current time?" (Datetime Tool Request) ---');
    const res2 = await request({
      hostname: '127.0.0.1',
      port: 3004,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      message: 'What is the current time?',
      conversationId
    });

    console.log('Res 2 Status:', res2.statusCode);
    console.log('Res 2 Body:', res2.body);

    console.log('Sleeping 15 seconds to respect rate limits...');
    await wait(15000);

    console.log('\n--- Sending Message 3: "What date is it today?" (Date Request) ---');
    const res3 = await request({
      hostname: '127.0.0.1',
      port: 3004,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      message: 'What date is it today?',
      conversationId
    });

    console.log('Res 3 Status:', res3.statusCode);
    console.log('Res 3 Body:', res3.body);

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
