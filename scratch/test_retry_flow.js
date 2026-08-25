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
  console.log('Starting next dev server on port 3003 (test retry flow)...');
  const env = { ...process.env };
  delete env.MOCK_DB;

  const devServer = spawn('npx', ['next', 'dev', '-p', '3003'], {
    env,
    shell: true
  });

  devServer.stdout.on('data', (data) => {
    process.stdout.write(`[SERVER STDOUT] ${data}`);
  });

  devServer.stderr.on('data', (data) => {
    process.stderr.write(`[SERVER STDERR] ${data}`);
  });

  // Wait 55 seconds for Turbopack to compile nextconfig etc.
  console.log('Waiting 55 seconds for Next.js dev server compilation...');
  await wait(55000);

  try {
    console.log('\n--- Sending First Request ("im prakash") ---');
    const res1 = await request({
      hostname: '127.0.0.1',
      port: 3003,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      message: 'im prakash'
    });

    console.log('Res 1 Status:', res1.statusCode);
    console.log('Res 1 Body:', res1.body);

    const parsed1 = JSON.parse(res1.body);
    const conversationId = parsed1.conversationId;

    if (!conversationId) {
      console.error('No conversationId returned from first request');
      process.exit(1);
    }

    console.log('\nWaiting 15 seconds to simulate user typing and idle socket timeout...');
    await wait(15000);

    console.log('\n--- Sending Second Request ("what are u doing") ---');
    const res2 = await request({
      hostname: '127.0.0.1',
      port: 3003,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      message: 'what are u doing',
      conversationId: conversationId
    });

    console.log('Res 2 Status:', res2.statusCode);
    console.log('Res 2 Body:', res2.body);

    console.log('\nWaiting 15 seconds to simulate user typing and idle socket timeout...');
    await wait(15000);

    console.log('\n--- Sending Third Request ("what is my name") ---');
    const res3 = await request({
      hostname: '127.0.0.1',
      port: 3003,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      message: 'what is my name',
      conversationId: conversationId
    });

    console.log('Res 3 Status:', res3.statusCode);
    console.log('Res 3 Body:', res3.body);

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    console.log('Test completed. Cleaning up.');
    const taskkill = spawn('powershell', ['-Command', 'Stop-Process -Id (Get-NetTCPConnection -LocalPort 3003 -ErrorAction SilentlyContinue).OwningProcess -Force'], { shell: true });
    taskkill.on('exit', () => {
      console.log('Dev server on 3003 killed.');
      process.exit(0);
    });
  }
}

run();
