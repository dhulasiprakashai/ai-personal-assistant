import { GoogleGenAI } from '@google/genai';
import { SYSTEM_INSTRUCTION } from './openai';

let geminiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey && process.env.OPENAI_API_KEY) {
      const key = process.env.OPENAI_API_KEY;
      if (key.startsWith('AQ.') || key.startsWith('AIza') || !key.startsWith('sk-')) {
        apiKey = key;
      }
    }
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables');
    }
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

export async function getGeminiCompletionWithHistory(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<string> {
  const client = getGeminiClient();

  // Filter out any system messages from the history array to pass separately
  const historyContents = messages
    .filter((msg) => msg.role !== 'system')
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: msg.content }],
    }));

  console.log('[GEMINI] Request started');
  console.log('[GEMINI] Model: gemini-3.6-flash');
  console.log(`[GEMINI] Generating content with history of ${historyContents.length} turns`);

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: historyContents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });
    console.log('[GEMINI] Request completed');
    return response.text || 'No response from AI.';
  } catch (err: unknown) {
    let errMsg = err instanceof Error ? err.message : String(err);
    if (process.env.GEMINI_API_KEY) {
      errMsg = errMsg.replace(new RegExp(process.env.GEMINI_API_KEY, 'g'), 'REDACTED');
    }
    if (process.env.OPENAI_API_KEY) {
      errMsg = errMsg.replace(new RegExp(process.env.OPENAI_API_KEY, 'g'), 'REDACTED');
    }
    console.error(`[GEMINI ERROR] ${errMsg}`);
    throw err;
  }
}

