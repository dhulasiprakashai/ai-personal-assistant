const assert = require('assert');
const { executeTool, isRegisteredTool } = require('../src/lib/ai/tools');
const { mockMemories } = require('../src/lib/db/memoriesDb');

// Mock environment
process.env.MOCK_DB = 'true';

async function testUnit() {
  console.log('--- RUNNING UNIT TESTS FOR TOOLS & VALIDATIONS ---');

  // Test 1: Datetime Tool execution
  console.log('Testing datetime tool...');
  const dtRes = await executeTool('get_current_datetime', {});
  assert.ok(dtRes.date, 'Date should be returned');
  assert.ok(dtRes.time, 'Time should be returned');
  assert.ok(dtRes.timezone, 'Timezone should be returned');
  console.log('Datetime tool: PASSED', JSON.stringify(dtRes));

  // Test 2: Save Memory Tool execution
  console.log('\nTesting save_memory tool...');
  const saveRes = await executeTool('save_memory', {
    key: 'user_name',
    value: 'Prakash'
  }, { conversationId: 'conv-123' });
  assert.strictEqual(saveRes.success, true);
  const stored = mockMemories.get('conv-123:user_name');
  assert.ok(stored, 'Memory should be stored in mock DB');
  assert.strictEqual(stored.value, 'Prakash');
  console.log('Save memory tool: PASSED');

  // Test 3: Get Memory Tool execution
  console.log('\nTesting get_memory tool...');
  const getRes = await executeTool('get_memory', {
    query: 'user_name'
  }, { conversationId: 'conv-123' });
  assert.strictEqual(getRes.success, true);
  assert.strictEqual(getRes.memories.length, 1);
  assert.strictEqual(getRes.memories[0].key, 'user_name');
  assert.strictEqual(getRes.memories[0].value, 'Prakash');
  console.log('Get memory tool: PASSED', JSON.stringify(getRes));

  // Test 4: Update Memory Tool execution
  console.log('\nTesting update_memory tool...');
  const updateRes = await executeTool('update_memory', {
    key: 'user_name',
    value: 'Prakash Updated'
  }, { conversationId: 'conv-123' });
  assert.strictEqual(updateRes.success, true);
  const updated = mockMemories.get('conv-123:user_name');
  assert.strictEqual(updated.value, 'Prakash Updated');
  console.log('Update memory tool: PASSED');

  // Test 5: Delete Memory Tool execution
  console.log('\nTesting delete_memory tool...');
  const delRes = await executeTool('delete_memory', {
    key: 'user_name'
  }, { conversationId: 'conv-123' });
  assert.strictEqual(delRes.success, true);
  assert.ok(!mockMemories.has('conv-123:user_name'), 'Memory should be deleted');
  console.log('Delete memory tool: PASSED');

  // ----------------------------------------------------
  // SECURITY TESTS
  // ----------------------------------------------------
  console.log('\n--- RUNNING SECURITY VALIDATION TESTS ---');

  // Security Test 1: Unregistered tool execution rejection
  console.log('Testing unregistered tool rejection...');
  try {
    await executeTool('format_hard_drive', {});
    assert.fail('Should have rejected unregistered tool');
  } catch (err) {
    assert.ok(err.message.includes('Security Exception'), 'Should contain Security Exception error message');
    console.log('Unregistered tool rejection: PASSED (Rejected successfully: ' + err.message + ')');
  }

  // Security Test 2: Invalid memory key rejection (symbols or injection attempt)
  console.log('Testing invalid memory key rejection...');
  try {
    await executeTool('save_memory', {
      key: 'user name with spaces',
      value: 'Prakash'
    });
    assert.fail('Should have rejected key with spaces');
  } catch (err) {
    assert.ok(err.message.includes('Security Exception'), 'Should enforce strict alphanumeric keys');
    console.log('Invalid key rejection: PASSED (Rejected successfully: ' + err.message + ')');
  }

  // Security Test 3: Arbitrary SQL injection pattern detection
  console.log('Testing SQL injection pattern detection in value...');
  try {
    await executeTool('save_memory', {
      key: 'user_name',
      value: 'Prakash; DROP TABLE memories;--'
    });
    assert.fail('Should have rejected SQL injection attempt');
  } catch (err) {
    assert.ok(err.message.includes('Security Exception'), 'Should enforce SQL keyword check');
    console.log('SQL Injection block: PASSED (Rejected successfully: ' + err.message + ')');
  }

  console.log('\n--- ALL UNIT TESTS PASSED SUCCESSFULLY! ---');
}

testUnit().catch(err => {
  console.error('Unit test failed:', err);
  process.exit(1);
});
