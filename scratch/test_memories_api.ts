import assert from 'assert';
import { spawn } from 'child_process';
import http from 'http';

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(options: http.RequestOptions, body?: any): Promise<{ statusCode?: number; headers: http.IncomingHttpHeaders; body: string }> {
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
  console.log('Starting next dev server on port 3005...');
  const devServer = spawn('npx', ['next', 'dev', '-p', '3005'], {
    env: { ...process.env, MOCK_DB: 'true' },
    shell: true
  });

  devServer.stdout.on('data', (data) => {
    process.stdout.write(`[SERVER] ${data}`);
  });

  devServer.stderr.on('data', (data) => {
    process.stderr.write(`[SERVER ERROR] ${data}`);
  });

  // Wait 120 seconds for startup and compilation
  await wait(120000);

  try {
    console.log('\n--- Test 1: POST (Create Memory) ---');
    const resPost = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: '/api/memories',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      key: 'user_alias',
      value: 'Sam'
    });
    console.log('POST Status:', resPost.statusCode);
    console.log('POST Body:', resPost.body);
    const postData = JSON.parse(resPost.body);
    assert.strictEqual(resPost.statusCode, 200);
    assert.strictEqual(postData.success, true);

    console.log('\n--- Test 2: GET (Fetch Memories) ---');
    const resGet = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: '/api/memories',
      method: 'GET'
    });
    console.log('GET Status:', resGet.statusCode);
    console.log('GET Body:', resGet.body);
    const getData = JSON.parse(resGet.body);
    assert.strictEqual(resGet.statusCode, 200);
    assert.strictEqual(getData.success, true);
    const found = getData.memories.find((m: any) => m.key === 'user_alias');
    assert.ok(found, 'Should find key user_alias');
    assert.strictEqual(found.value, 'Sam');

    console.log('\n--- Test 3: POST (Update Existing Key) ---');
    const resUpdate = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: '/api/memories',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      key: 'user_alias',
      value: 'Sam Updated'
    });
    console.log('Update Status:', resUpdate.statusCode);
    console.log('Update Body:', resUpdate.body);
    assert.strictEqual(resUpdate.statusCode, 200);

    const resGetAfterUpdate = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: '/api/memories',
      method: 'GET'
    });
    const getAfterUpdateData = JSON.parse(resGetAfterUpdate.body);
    const updatedMem = getAfterUpdateData.memories.find((m: any) => m.key === 'user_alias');
    assert.strictEqual(updatedMem.value, 'Sam Updated', 'Should successfully overwrite key value without duplicates');

    console.log('\n--- Test 4: DELETE (Remove Memory) ---');
    const resDel = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: '/api/memories?key=user_alias',
      method: 'DELETE'
    });
    console.log('DELETE Status:', resDel.statusCode);
    console.log('DELETE Body:', resDel.body);
    assert.strictEqual(resDel.statusCode, 200);
    const delData = JSON.parse(resDel.body);
    assert.strictEqual(delData.deleted, true);

    const resGetAfterDel = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: '/api/memories',
      method: 'GET'
    });
    const getAfterDelData = JSON.parse(resGetAfterDel.body);
    const foundAfterDel = getAfterDelData.memories.find((m: any) => m.key === 'user_alias');
    assert.ok(!foundAfterDel, 'Key user_alias should be deleted');

    console.log('\n--- Test 5: POST Security (Invalid Key rejection) ---');
    const resSec1 = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: '/api/memories',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      key: 'key with spaces',
      value: 'Sam'
    });
    console.log('Invalid key POST Status:', resSec1.statusCode);
    console.log('Invalid key POST Body:', resSec1.body);
    assert.strictEqual(resSec1.statusCode, 400);
    assert.ok(resSec1.body.includes('Security Exception'));

    console.log('\n--- Test 6: POST Security (SQL Injection rejection) ---');
    const resSec2 = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: '/api/memories',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      key: 'user_name',
      value: 'Sam; DROP TABLE memories;--'
    });
    console.log('SQL Injection POST Status:', resSec2.statusCode);
    console.log('SQL Injection POST Body:', resSec2.body);
    assert.strictEqual(resSec2.statusCode, 400);
    assert.ok(resSec2.body.includes('Security Exception'));

    console.log('\n--- Test 7: GET Security (Invalid Conversation ID rejection) ---');
    const resSec3 = await request({
      hostname: '127.0.0.1',
      port: 3005,
      path: '/api/memories?conversationId=invalid-format-id',
      method: 'GET'
    });
    console.log('Invalid Conversation ID GET Status:', resSec3.statusCode);
    console.log('Invalid Conversation ID GET Body:', resSec3.body);
    assert.strictEqual(resSec3.statusCode, 400);
    assert.ok(resSec3.body.includes('Security Exception'));

    console.log('\n--- ALL PHASE 1 INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
  } catch (err) {
    console.error('Test suite failed:', err);
    process.exit(1);
  } finally {
    console.log('Cleaning up...');
    const taskkill = spawn('powershell', ['-Command', 'Stop-Process -Id (Get-NetTCPConnection -LocalPort 3005 -ErrorAction SilentlyContinue).OwningProcess -Force'], { shell: true });
    taskkill.on('exit', () => {
      console.log('Dev server on 3005 killed.');
      process.exit(0);
    });
  }
}

run();
