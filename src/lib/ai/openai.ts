import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not defined in environment variables');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export const SYSTEM_INSTRUCTION = `You are a helpful AI personal assistant.

Be clear, concise, accurate, and practical.

Help the user understand information, solve problems, plan tasks, and make decisions.

Never claim that you performed an external action unless a real tool actually performed that action.

If a capability is not available, clearly say so.`;

export async function getChatCompletion(message: string): Promise<string> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user', content: message },
    ],
  });

  return response.choices[0]?.message?.content || 'No response from AI.';
}

export async function getChatCompletionWithHistory(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<string> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
  });

  return response.choices[0]?.message?.content || 'No response from AI.';
}
