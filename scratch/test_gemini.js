const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

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

const apiKey = env.OPENAI_API_KEY || env.GEMINI_API_KEY;
console.log('Using API key prefix:', apiKey ? apiKey.substring(0, 7) + '...' : 'none');

const client = new GoogleGenAI({ apiKey });

async function testSingle() {
  try {
    console.log('Running test 1: "im prakash"');
    const response1 = await client.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: 'im prakash' }] }]
    });
    console.log('Response 1 text:', response1.text);

    console.log('Running test 2: ["im prakash", "what are u doing"]');
    const response2 = await client.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        { role: 'user', parts: [{ text: 'im prakash' }] },
        { role: 'model', parts: [{ text: response1.text || 'hello' }] },
        { role: 'user', parts: [{ text: 'what are u doing' }] }
      ]
    });
    console.log('Response 2 text:', response2.text);
  } catch (err) {
    console.error('Error during generation:', err);
  }
}

testSingle();
