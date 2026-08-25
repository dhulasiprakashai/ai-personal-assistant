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
  const models = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
  for (const model of models) {
    console.log(`Testing model: ${model}...`);
    try {
      const res = await client.models.generateContent({
        model: model,
        contents: [{ role: 'user', parts: [{ text: 'hello' }] }]
      });
      console.log(`Success with ${model}:`, res.text);
      return; // Stop if we find a working model
    } catch (err) {
      console.error(`Failed with ${model}:`, err.message || err);
    }
  }
}

run();
