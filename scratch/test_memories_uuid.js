const assert = require('assert');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

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

function killPort(port) {
  return new Promise((resolve) => {
    console.log(`Stopping server on port ${port}...`);
    const taskkill = spawn('powershell', ['-Command', `Stop-Process -Id (Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess -Force`], { shell: true });
    taskkill.on('exit', () => {
      resolve();
    });
  });
}

async function waitForServer(port) {
  console.log(`Waiting for server to become responsive on port ${port}...`);
  for (let i = 0; i < 60; i++) { // Poll for up to 120 seconds
    try {
      const res = await request({
        hostname: '127.0.0.1',
        port: port,
        path: '/api/conversations',
        method: 'GET'
      });
      if (res.statusCode === 200) {
        console.log(`Server is ready on port ${port}!`);
        return;
      }
    } catch (e) {
      // Ignore and retry
    }
    await wait(2000);
  }
  throw new Error(`Server failed to start on port ${port} within 120 seconds`);
}

async function run() {
  const testPort = 3006;
  
  // Ensure port is free before starting
  await killPort(testPort);

  // ==========================================
  // PHASE 1: Mock DB Mode (MOCK_DB = true)
  // ==========================================
  console.log('\n==========================================');
  console.log('PHASE 1: Testing MOCK_DB = true');
  console.log('==========================================');
  
  console.log(`Starting next dev server on port ${testPort} with MOCK_DB=true...`);
  const devServerMock = spawn('npx', ['next', 'dev', '-p', String(testPort)], {
    env: { ...process.env, MOCK_DB: 'true' },
    shell: true
  });

  try {
    // Wait for server compilation
    await waitForServer(testPort);

    console.log('\n[MOCK] Test 1.1: POST (Create Memory with no conversationId - should default to default-session)');
    const resPostDefault = await request({
      hostname: '127.0.0.1',
      port: testPort,
      path: '/api/memories',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      key: 'test_mock_key',
      value: 'mock_value'
    });
    console.log('Status:', resPostDefault.statusCode);
    console.log('Body:', resPostDefault.body);
    assert.strictEqual(resPostDefault.statusCode, 200);
    const postDataDefault = JSON.parse(resPostDefault.body);
    assert.strictEqual(postDataDefault.success, true);

    console.log('\n[MOCK] Test 1.2: GET (Fetch Memories with no conversationId)');
    const resGetDefault = await request({
      hostname: '127.0.0.1',
      port: testPort,
      path: '/api/memories',
      method: 'GET'
    });
    console.log('Status:', resGetDefault.statusCode);
    console.log('Body:', resGetDefault.body);
    assert.strictEqual(resGetDefault.statusCode, 200);
    const getDataDefault = JSON.parse(resGetDefault.body);
    assert.strictEqual(getDataDefault.success, true);
    const foundDefault = getDataDefault.memories.find(m => m.key === 'test_mock_key');
    assert.ok(foundDefault);
    assert.strictEqual(foundDefault.value, 'mock_value');

    console.log('\n[MOCK] Test 1.3: POST (Create Memory with valid UUID)');
    const uuid = '22222222-2222-2222-2222-222222222222';
    const resPostUuid = await request({
      hostname: '127.0.0.1',
      port: testPort,
      path: '/api/memories',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      conversationId: uuid,
      key: 'test_uuid_key',
      value: 'uuid_value'
    });
    console.log('Status:', resPostUuid.statusCode);
    console.log('Body:', resPostUuid.body);
    assert.strictEqual(resPostUuid.statusCode, 200);

    console.log('\n[MOCK] Test 1.4: POST (Rejection of invalid non-UUID, non-fallback format)');
    const resPostInvalid = await request({
      hostname: '127.0.0.1',
      port: testPort,
      path: '/api/memories',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      conversationId: 'completely-invalid-id',
      key: 'key',
      value: 'value'
    });
    console.log('Status:', resPostInvalid.statusCode);
    console.log('Body:', resPostInvalid.body);
    assert.strictEqual(resPostInvalid.statusCode, 400);
    const postDataInvalid = JSON.parse(resPostInvalid.body);
    assert.ok(postDataInvalid.error.includes('Security Exception: Invalid conversation ID format'));

  } catch (err) {
    console.error('[MOCK TESTS FAILED]', err);
    await killPort(testPort);
    process.exit(1);
  }

  // Stop the mock server
  await killPort(testPort);
  await wait(5000);

  // ==========================================
  // PHASE 2: Live Database Mode (MOCK_DB = false)
  // ==========================================
  console.log('\n==========================================');
  console.log('PHASE 2: Testing MOCK_DB = false (Live Supabase)');
  console.log('==========================================');

  console.log(`Starting next dev server on port ${testPort} with MOCK_DB=false and cloud SUPABASE_URL...`);
  const devServerLive = spawn('npx', ['next', 'dev', '-p', String(testPort)], {
    env: {
      ...process.env,
      MOCK_DB: 'false',
      SUPABASE_URL: 'https://mmzajaadqhlvhseifcuc.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY
    },
    shell: true
  });

  try {
    // Wait for server compilation
    await waitForServer(testPort);

    console.log('\n[LIVE] Test 2.1: POST (Rejection of missing conversationId)');
    const resPostMissing = await request({
      hostname: '127.0.0.1',
      port: testPort,
      path: '/api/memories',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      key: 'test_live_key',
      value: 'live_value'
    });
    console.log('Status:', resPostMissing.statusCode);
    console.log('Body:', resPostMissing.body);
    assert.strictEqual(resPostMissing.statusCode, 400);
    const postDataMissing = JSON.parse(resPostMissing.body);
    assert.ok(postDataMissing.error.includes('Security Exception: Missing required conversation ID'));

    console.log('\n[LIVE] Test 2.2: POST (Rejection of fallback "default-session")');
    const resPostFallback = await request({
      hostname: '127.0.0.1',
      port: testPort,
      path: '/api/memories',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      conversationId: 'default-session',
      key: 'test_live_key',
      value: 'live_value'
    });
    console.log('Status:', resPostFallback.statusCode);
    console.log('Body:', resPostFallback.body);
    assert.strictEqual(resPostFallback.statusCode, 400);
    const postDataFallback = JSON.parse(resPostFallback.body);
    assert.ok(postDataFallback.error.includes('Security Exception: Invalid conversation ID format'));

    console.log('\n[LIVE] Test 2.3: POST (Valid UUID should proceed to database query)');
    // Use an existing conversation UUID from conversations table: df28cf2f-7195-42b0-bc4c-5beb198edb65
    const liveConversationUuid = 'df28cf2f-7195-42b0-bc4c-5beb198edb65';
    const resPostLiveUuid = await request({
      hostname: '127.0.0.1',
      port: testPort,
      path: '/api/memories',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      conversationId: liveConversationUuid,
      key: 'test_live_uuid_key',
      value: 'live_uuid_value'
    });
    console.log('Status:', resPostLiveUuid.statusCode);
    console.log('Body:', resPostLiveUuid.body);
    assert.strictEqual(resPostLiveUuid.statusCode, 200);
    const postDataLiveUuid = JSON.parse(resPostLiveUuid.body);
    assert.strictEqual(postDataLiveUuid.success, true);

    console.log('\n[LIVE] Test 2.4: GET (Fetch Memories with valid UUID - should return data)');
    const resGetLiveUuid = await request({
      hostname: '127.0.0.1',
      port: testPort,
      path: `/api/memories?conversationId=${liveConversationUuid}`,
      method: 'GET'
    });
    console.log('Status:', resGetLiveUuid.statusCode);
    console.log('Body:', resGetLiveUuid.body);
    assert.strictEqual(resGetLiveUuid.statusCode, 200);
    const getDataLiveUuid = JSON.parse(resGetLiveUuid.body);
    assert.strictEqual(getDataLiveUuid.success, true);
    const foundLiveMem = getDataLiveUuid.memories.find(m => m.key === 'test_live_uuid_key');
    assert.ok(foundLiveMem);
    assert.strictEqual(foundLiveMem.value, 'live_uuid_value');

    console.log('\n[LIVE] Test 2.5: DELETE (Clean up the live memory)');
    const resDelLive = await request({
      hostname: '127.0.0.1',
      port: testPort,
      path: `/api/memories?conversationId=${liveConversationUuid}&key=test_live_uuid_key`,
      method: 'DELETE'
    });
    console.log('Status:', resDelLive.statusCode);
    console.log('Body:', resDelLive.body);
    assert.strictEqual(resDelLive.statusCode, 200);
    const delDataLive = JSON.parse(resDelLive.body);
    assert.strictEqual(delDataLive.success, true);
    assert.strictEqual(delDataLive.deleted, true);

    console.log('\n[LIVE] Test 2.6: GET (Confirm cleanup)');
    const resGetAfterDel = await request({
      hostname: '127.0.0.1',
      port: testPort,
      path: `/api/memories?conversationId=${liveConversationUuid}`,
      method: 'GET'
    });
    const getDataAfterDel = JSON.parse(resGetAfterDel.body);
    const foundAfterDel = getDataAfterDel.memories.find(m => m.key === 'test_live_uuid_key');
    assert.ok(!foundAfterDel, 'Live key should be deleted');

    console.log('\n==========================================');
    console.log('ALL PHASE 2 LIVE COMPATIBILITY TESTS PASSED!');
    console.log('==========================================');

  } catch (err) {
    console.error('[LIVE TESTS FAILED]', err);
    await killPort(testPort);
    process.exit(1);
  }

  // Stop the live server
  await killPort(testPort);
  console.log('\nTests completed successfully!');
  process.exit(0);
}

run();
