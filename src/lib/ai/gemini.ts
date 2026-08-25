import { GoogleGenAI, Content, Part } from '@google/genai';
import { SYSTEM_INSTRUCTION } from './openai';
import { getToolDeclarations, isRegisteredTool, executeTool } from './tools';

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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isTransientNetworkError(err: any): boolean {
  if (!err) return false;
  
  const message = (err.message || '').toLowerCase();
  
  if (err.status && typeof err.status === 'number') {
    if (err.status === 429 || (err.status >= 500 && err.status < 600)) {
      return true;
    }
  }
  
  if (err.status_code && typeof err.status_code === 'number') {
    if (err.status_code === 429 || (err.status_code >= 500 && err.status_code < 600)) {
      return true;
    }
  }

  // Check inside Google GenAI ApiError fields if present
  if (err.error && typeof err.error === 'object') {
    const code = err.error.code;
    if (code === 429 || code === 503 || (typeof code === 'number' && code >= 500 && code < 600)) {
      return true;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checkErrorObj = (e: any): boolean => {
    if (!e) return false;
    const code = e.code;
    const msg = (e.message || '').toLowerCase();
    
    if (code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'EADDRNOTAVAIL') {
      return true;
    }
    
    if (msg.includes('socket hang up') || msg.includes('connection reset') || msg.includes('connreset') || msg.includes('connect econnrefused') || msg.includes('econnrefused')) {
      return true;
    }
    
    return false;
  };

  if (checkErrorObj(err)) return true;
  if (err.cause && checkErrorObj(err.cause)) return true;
  
  if (
    message.includes('fetch failed') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('429') ||
    message.includes('unavailable') ||
    message.includes('rate limit') ||
    message.includes('resource_exhausted') ||
    message.includes('high demand')
  ) {
    return true;
  }

  return false;
}

export async function getGeminiCompletionWithHistory(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  memoriesText?: string,
  conversationId?: string
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

  const systemInstruction = memoriesText 
    ? `${SYSTEM_INSTRUCTION}\n\n${memoriesText}`
    : SYSTEM_INSTRUCTION;

  const maxRetries = 2;
  let attempt = 0;

  const contents: Content[] = [...historyContents];
  let toolLoopCount = 0;
  const maxToolLoops = 5;

  while (true) {
    try {
      const response = await client.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          tools: [{ functionDeclarations: getToolDeclarations() }],
        },
      });
      console.log('[GEMINI] Request completed');

      // Check if the model predicted any function calls
      if (response.functionCalls && response.functionCalls.length > 0) {
        toolLoopCount++;
        if (toolLoopCount > maxToolLoops) {
          console.warn(`[GEMINI TOOL] Maximum tool execution limit of ${maxToolLoops} loops reached. Terminating loop.`);
          return 'I reached the limit of actions I can perform in a single response. Please try breaking your request into smaller queries.';
        }
        const candidateContent = response.candidates?.[0]?.content;
        if (candidateContent) {
          contents.push(candidateContent);
        } else {
          const toolCallsParts = response.functionCalls.map(call => ({ functionCall: call }));
          contents.push({
            role: 'model',
            parts: toolCallsParts
          });
        }

        const toolResponsesParts: Part[] = [];
        for (const call of response.functionCalls) {
          const { name, args, id } = call;
          console.log(`[GEMINI TOOL] Model requested tool: ${name} with args:`, JSON.stringify(args));

          if (!name || !isRegisteredTool(name)) {
            throw new Error(`Security Exception: Unregistered tool execution blocked: ${name}`);
          }

          let toolResult: Record<string, unknown>;
          try {
            toolResult = await executeTool(name, args as Record<string, unknown>, { conversationId });
            console.log(`[GEMINI TOOL] Executed ${name} successfully. Result:`, JSON.stringify(toolResult));
          } catch (toolErr) {
            const errMsg = toolErr instanceof Error ? toolErr.message : String(toolErr);
            console.error(`[GEMINI TOOL ERROR] Tool ${name} execution failed:`, errMsg);
            toolResult = { error: `Tool execution failed: ${errMsg || 'Unknown error'}` };
          }

          toolResponsesParts.push({ functionResponse: { name, response: toolResult, id } });
        }

        contents.push({
          role: 'user',
          parts: toolResponsesParts
        });

        console.log('[GEMINI] Re-submitting with tool response(s)...');
        continue;
      }

      return response.text || 'No response from AI.';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      attempt++;
      const isRetryable = isTransientNetworkError(err) && attempt <= maxRetries;
      
      let errMsg = err instanceof Error ? err.message : String(err);
      let errStack = err instanceof Error && err.stack ? err.stack : '';
      let errCause = err && err.cause ? (err.cause instanceof Error ? err.cause.message : String(err.cause)) : '';
      let errCauseStack = err && err.cause && err.cause.stack ? err.cause.stack : '';
      
      // Redact keys
      const keysToRedact = [];
      if (process.env.GEMINI_API_KEY) keysToRedact.push(process.env.GEMINI_API_KEY);
      if (process.env.OPENAI_API_KEY) keysToRedact.push(process.env.OPENAI_API_KEY);
      if (process.env.TAVILY_API_KEY) keysToRedact.push(process.env.TAVILY_API_KEY);
      
      for (const key of keysToRedact) {
        const regex = new RegExp(key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
        errMsg = errMsg.replace(regex, 'REDACTED');
        errStack = errStack.replace(regex, 'REDACTED');
        errCause = errCause.replace(regex, 'REDACTED');
        errCauseStack = errCauseStack.replace(regex, 'REDACTED');
      }
      
      console.error(`[GEMINI ERROR] Attempt ${attempt} failed. Message: ${errMsg}`);
      if (errCause) {
        console.error(`[GEMINI ERROR] Cause: ${errCause}`);
      }
      if (errCauseStack) {
        console.error(`[GEMINI ERROR] Cause Stack: ${errCauseStack}`);
      }
      if (errStack) {
        console.error(`[GEMINI ERROR] Stack: ${errStack}`);
      }

      if (isRetryable) {
        const backoffMs = 500 * Math.pow(2, attempt - 1);
        console.log(`[GEMINI RETRY] Transient network error detected. Retrying in ${backoffMs}ms... (Attempt ${attempt}/${maxRetries})`);
        await wait(backoffMs);
        console.log('[GEMINI] Request started (Retry)');
        continue;
      }
      
      throw err;
    }
  }
}

export async function extractMemoryCandidates(
  message: string
): Promise<Array<{ key: string; value: string }>> {
  const client = getGeminiClient();

  const prompt = `You are a memory extraction assistant. Your job is to extract persistent, useful long-term facts about the user from the user's message.
Examples of useful facts to extract:
- User's name (e.g. "My name is Prakash" -> key: "user_name", value: "Prakash")
- User's favorite things (e.g. "My favorite color is blue" -> key: "favorite_color", value: "blue")
- User's job/profession (e.g. "I work as a software developer" -> key: "job", value: "software developer")
- User's location (e.g. "I live in Chennai" -> key: "location", value: "Chennai")

Do NOT extract temporary conversational statements, questions, general commands, or requests, such as:
- "hello"
- "what are you doing?"
- "tell me a joke"
- "thanks"
- "how are you"

Also, do NOT extract any sensitive information, credentials, secrets, API keys, or passwords.

Respond ONLY with a JSON array of objects, where each object has "key" and "value" fields. If no useful persistent facts are found, return an empty array [].

User message: "${message}"`;

  const maxRetries = 2;
  let attempt = 0;

  while (true) {
    try {
      const response = await client.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '[]';
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item: any) =>
            item &&
            typeof item.key === 'string' &&
            typeof item.value === 'string'
        );
      }
      return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      attempt++;
      const isRetryable = isTransientNetworkError(err) && attempt <= maxRetries;

      let errMsg = err instanceof Error ? err.message : String(err);
      let errStack = err instanceof Error && err.stack ? err.stack : '';
      let errCause = err && err.cause ? (err.cause instanceof Error ? err.cause.message : String(err.cause)) : '';
      let errCauseStack = err && err.cause && err.cause.stack ? err.cause.stack : '';

      // Redact keys
      const keysToRedact = [];
      if (process.env.GEMINI_API_KEY) keysToRedact.push(process.env.GEMINI_API_KEY);
      if (process.env.OPENAI_API_KEY) keysToRedact.push(process.env.OPENAI_API_KEY);

      for (const key of keysToRedact) {
        const regex = new RegExp(key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
        errMsg = errMsg.replace(regex, 'REDACTED');
        errStack = errStack.replace(regex, 'REDACTED');
        errCause = errCause.replace(regex, 'REDACTED');
        errCauseStack = errCauseStack.replace(regex, 'REDACTED');
      }

      console.error(`[GEMINI ERROR] Memory extraction attempt ${attempt} failed. Message: ${errMsg}`);

      if (isRetryable) {
        const backoffMs = 500 * Math.pow(2, attempt - 1);
        console.log(`[GEMINI RETRY] Memory extraction retrying in ${backoffMs}ms... (Attempt ${attempt}/${maxRetries})`);
        await wait(backoffMs);
        continue;
      }

      throw err;
    }
  }
}

