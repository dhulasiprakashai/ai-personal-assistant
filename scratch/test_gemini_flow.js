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
  console.log('--- TEST 1: Single turn user request ---');
  const history1 = [
    {
      role: 'user',
      parts: [{ text: 'im prakash' }]
    }
  ];
  
  try {
    const res1 = await client.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: history1,
      config: {
        systemInstruction: 'You are a helpful assistant.'
      }
    });
    console.log('Res 1 Success:', res1.text);
    
    console.log('\n--- TEST 2: Multi-turn (history) request ---');
    const history2 = [
      {
        role: 'user',
        parts: [{ text: 'im prakash' }]
      },
      {
        role: 'model',
        parts: [{ text: res1.text || 'Nice to meet you, Prakash! How can I help you today?' }]
      },
      {
        role: 'user',
        parts: [{ text: 'what are u doing' }]
      }
    ];
    
    console.log('Sending history2:', JSON.stringify(history2, null, 2));
    
    const res2 = await client.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: history2,
      config: {
        systemInstruction: 'You are a helpful assistant.'
      }
    });
    console.log('Res 2 Success:', res2.text);
  } catch (err) {
    console.error('Error occurred:');
    console.error(err);
    if (err.stack) {
      console.error(err.stack);
    }
  }
}

run();
