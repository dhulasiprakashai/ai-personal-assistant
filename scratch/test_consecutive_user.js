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
const client = new GoogleGenAI({ apiKey });

async function run() {
  console.log('Sending consecutive user messages to Gemini...');
  try {
    const res = await client.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        { role: 'user', parts: [{ text: 'im prakash' }] },
        { role: 'user', parts: [{ text: 'what are u doing' }] }
      ]
    });
    console.log('Success:', res.text);
  } catch (err) {
    console.error('Error occurred:');
    console.error(err);
    if (err.stack) {
      console.error(err.stack);
    }
  }
}

run();
