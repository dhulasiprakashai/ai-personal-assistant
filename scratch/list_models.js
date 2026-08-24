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
  try {
    const list = await client.models.list();
    // list might have an array inside it or be an iterable
    console.log('Fields on list response:', Object.keys(list));
    
    // Find inside list
    let modelsArray = [];
    if (Array.isArray(list)) {
      modelsArray = list;
    } else if (list.models && Array.isArray(list.models)) {
      modelsArray = list.models;
    } else if (typeof list[Symbol.iterator] === 'function') {
      modelsArray = Array.from(list);
    } else {
      // Check other properties
      for (const key of Object.keys(list)) {
        if (Array.isArray(list[key])) {
          modelsArray = list[key];
          break;
        }
      }
    }
    
    console.log(`Found ${modelsArray.length} models`);
    const names = modelsArray.map(m => m.name || m);
    console.log('Model names list:', names);
    const has36 = names.some(n => String(n).includes('gemini-3.6-flash'));
    console.log('Is gemini-3.6-flash in the list?', has36);
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
