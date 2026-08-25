import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { executeTool } from '../src/lib/ai/tools';

// Load environment variables from .env into process.env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.trim().split('=');
    if (parts[0]) {
      process.env[parts[0]] = parts.slice(1).join('=');
    }
  });
}

async function testWebSearch() {
  console.log('--- RUNNING WEB SEARCH UNIT TESTS ---');

  // Test 1: Real search query execution
  console.log('Testing valid web search tool call...');
  try {
    const res = await executeTool('web_search', {
      query: 'latest space exploration news'
    });
    
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.results), 'results should be an array');
    console.log(`Web search returned ${res.results.length} result(s).`);
    if (res.results.length > 0) {
      const first = res.results[0];
      assert.ok(first.title, 'first result should have a title');
      assert.ok(first.url, 'first result should have a url');
      assert.ok(first.snippet, 'first result should have a snippet');
      console.log('Sample result:', JSON.stringify(first));
    }
    console.log('Valid web search tool: PASSED');
  } catch (err: any) {
    console.error('Valid web search tool: FAILED', err.message);
    throw err;
  }

  // ----------------------------------------------------
  // SECURITY & VALIDATION TESTS
  // ----------------------------------------------------
  console.log('\n--- RUNNING SECURITY & VALIDATION TESTS ---');

  // Security Test 1: Empty search query rejection
  console.log('Testing empty query rejection...');
  try {
    await executeTool('web_search', { query: '' });
    assert.fail('Should have rejected empty query');
  } catch (err: any) {
    assert.ok(err.message.includes('cannot be empty'), 'Should contain cannot be empty message');
    console.log('Empty query validation: PASSED (Rejected: ' + err.message + ')');
  }

  // Security Test 2: Query length limit validation (200 characters limit)
  console.log('Testing query length limit rejection...');
  try {
    const longQuery = 'a'.repeat(201);
    await executeTool('web_search', { query: longQuery });
    assert.fail('Should have rejected query exceeding 200 characters');
  } catch (err: any) {
    assert.ok(err.message.includes('exceeds maximum allowed length'), 'Should contain exceeds maximum allowed length message');
    console.log('Query length limit: PASSED (Rejected: ' + err.message + ')');
  }

  // Security Test 3: SQL Injection pattern in search query block
  console.log('Testing SQL injection pattern in search query...');
  try {
    await executeTool('web_search', { query: 'news; DROP TABLE conversations;--' });
    assert.fail('Should have rejected SQL injection attempt');
  } catch (err: any) {
    assert.ok(err.message.includes('Security Exception'), 'Should enforce SQL keyword check');
    console.log('SQL Injection block: PASSED (Rejected: ' + err.message + ')');
  }

  console.log('\n--- ALL WEB SEARCH UNIT TESTS PASSED SUCCESSFULLY! ---');
}

testWebSearch().catch(err => {
  console.error('Web search unit test failed:', err);
  process.exit(1);
});
