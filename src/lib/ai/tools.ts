import { FunctionDeclaration, Type } from '@google/genai';
import { dbSaveMemory, dbGetMemories, dbDeleteMemory } from '../db/memoriesDb';

export interface ToolRegistry {
  [name: string]: {
    declaration: FunctionDeclaration;
    execute: (
      args: Record<string, unknown>,
      context?: { conversationId?: string }
    ) => Promise<Record<string, unknown>>;
  };
}

// ----------------------------------------------------
// Security & Validation Helpers
// ----------------------------------------------------

export function sanitizeAndValidateKey(key: unknown): string {
  if (typeof key !== 'string') {
    throw new Error('Key must be a string.');
  }
  const trimmed = key.trim();
  if (!trimmed) {
    throw new Error('Key cannot be empty.');
  }
  
  // Strict format check to prevent SQL injection or path traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    throw new Error('Security Exception: Key must only contain alphanumeric characters, underscores, or hyphens.');
  }
  return trimmed;
}

export function sanitizeAndValidateValue(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Value must be a string.');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Value cannot be empty.');
  }
  
  // Guard against arbitrary SQL keywords/commands
  const lower = trimmed.toLowerCase();
  const sqlKeywords = ['select ', 'insert ', 'update ', 'delete ', 'drop ', 'alter ', 'truncate ', '--', '/*', '*/', ';'];
  for (const keyword of sqlKeywords) {
    if (lower.includes(keyword)) {
      throw new Error(`Security Exception: Potential SQL Injection pattern detected in value.`);
    }
  }
  return trimmed;
}

export function sanitizeAndValidateQuery(query: unknown): string {
  if (query === undefined || query === null) {
    return '';
  }
  if (typeof query !== 'string') {
    throw new Error('Query must be a string.');
  }
  const trimmed = query.trim();
  
  // Guard against arbitrary SQL keywords/commands
  const lower = trimmed.toLowerCase();
  const sqlKeywords = ['select ', 'insert ', 'update ', 'delete ', 'drop ', 'alter ', 'truncate ', '--', '/*', '*/', ';'];
  for (const keyword of sqlKeywords) {
    if (lower.includes(keyword)) {
      throw new Error(`Security Exception: Potential SQL Injection pattern detected in query.`);
    }
  }
  return trimmed;
}

export function sanitizeAndValidateSearchQuery(query: unknown): string {
  if (typeof query !== 'string') {
    throw new Error('Search query must be a string.');
  }
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Search query cannot be empty.');
  }
  if (trimmed.length > 200) {
    throw new Error('Search query exceeds maximum allowed length of 200 characters.');
  }

  // Guard against arbitrary SQL keywords/commands
  const lower = trimmed.toLowerCase();
  const sqlKeywords = ['select ', 'insert ', 'update ', 'delete ', 'drop ', 'alter ', 'truncate ', '--', '/*', '*/', ';'];
  for (const keyword of sqlKeywords) {
    if (lower.includes(keyword)) {
      throw new Error(`Security Exception: Potential SQL Injection pattern detected in search query.`);
    }
  }
  return trimmed;
}

// ----------------------------------------------------
// Tool Declarations & Implementations
// ----------------------------------------------------

// 1. Datetime Tool
const datetimeTool = {
  declaration: {
    name: 'get_current_datetime',
    description: 'Returns the current date, time, and timezone of the server/user.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
    }
  },
  execute: async (): Promise<Record<string, unknown>> => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    
    return {
      date: dateStr,
      time: timeStr,
      timezone: timezone
    };
  }
};

// 2. Get Memory Tool
const getMemoryTool = {
  declaration: {
    name: 'get_memory',
    description: 'Safely searches and retrieves matching long-term memories.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'The search query or key to locate matching memories.'
        }
      },
      required: []
    }
  },
  execute: async (args: Record<string, unknown>, context?: { conversationId?: string }): Promise<Record<string, unknown>> => {
    const conversationId = context?.conversationId || 'default-session';
    const rawQuery = args.query;
    const cleanQuery = sanitizeAndValidateQuery(rawQuery);
    
    const results = await dbGetMemories(conversationId, cleanQuery);
    return {
      success: true,
      memories: results.map(r => ({ key: r.key, value: r.value }))
    };
  }
};

// 3. Save Memory Tool
const saveMemoryTool = {
  declaration: {
    name: 'save_memory',
    description: 'Saves a new long-term memory key-value pair.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        key: {
          type: Type.STRING,
          description: 'The key of the memory (e.g. user_name, user_preference).'
        },
        value: {
          type: Type.STRING,
          description: 'The value corresponding to the memory key.'
        }
      },
      required: ['key', 'value']
    }
  },
  execute: async (args: Record<string, unknown>, context?: { conversationId?: string }): Promise<Record<string, unknown>> => {
    const conversationId = context?.conversationId || 'default-session';
    const cleanKey = sanitizeAndValidateKey(args.key);
    const cleanValue = sanitizeAndValidateValue(args.value);
    
    await dbSaveMemory(conversationId, cleanKey, cleanValue);
    return {
      success: true,
      message: `Memory saved: ${cleanKey} = ${cleanValue}`
    };
  }
};

// 4. Update Memory Tool
const updateMemoryTool = {
  declaration: {
    name: 'update_memory',
    description: 'Updates an existing memory key to avoid duplicate records.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        key: {
          type: Type.STRING,
          description: 'The key of the existing memory to update.'
        },
        value: {
          type: Type.STRING,
          description: 'The new value to assign.'
        }
      },
      required: ['key', 'value']
    }
  },
  execute: async (args: Record<string, unknown>, context?: { conversationId?: string }): Promise<Record<string, unknown>> => {
    const conversationId = context?.conversationId || 'default-session';
    const cleanKey = sanitizeAndValidateKey(args.key);
    const cleanValue = sanitizeAndValidateValue(args.value);
    
    await dbSaveMemory(conversationId, cleanKey, cleanValue);
    return {
      success: true,
      message: `Memory updated: ${cleanKey} = ${cleanValue}`
    };
  }
};

// 5. Delete Memory Tool
const deleteMemoryTool = {
  declaration: {
    name: 'delete_memory',
    description: 'Deletes a specific stored memory key when the user explicitly requests forgetting it.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        key: {
          type: Type.STRING,
          description: 'The key of the memory to delete.'
        }
      },
      required: ['key']
    }
  },
  execute: async (args: Record<string, unknown>, context?: { conversationId?: string }): Promise<Record<string, unknown>> => {
    const conversationId = context?.conversationId || 'default-session';
    const cleanKey = sanitizeAndValidateKey(args.key);
    
    const deleted = await dbDeleteMemory(conversationId, cleanKey);
    return {
      success: true,
      message: deleted ? `Memory key '${cleanKey}' deleted.` : `Memory key '${cleanKey}' not found.`
    };
  }
};

// 6. Web Search Tool
interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

const webSearchTool = {
  declaration: {
    name: 'web_search',
    description: 'Searches the web for real-time information, weather, news, or current events.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'The search query to run (max 200 characters).'
        }
      },
      required: ['query']
    }
  },
  execute: async (args: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const rawQuery = args.query;
    const cleanQuery = sanitizeAndValidateSearchQuery(rawQuery);

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error('Tavily API key is missing from environment.');
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: cleanQuery,
          search_depth: 'basic'
        }),
        signal: AbortSignal.timeout(10000) // 10 seconds timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tavily search API responded with status ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as { results?: TavilyResult[] };
      const rawResults = data.results || [];

      const formattedResults = rawResults.map((item: TavilyResult) => ({
        title: item.title || '',
        url: item.url || '',
        snippet: item.content || ''
      }));

      return {
        success: true,
        results: formattedResults
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[WEB SEARCH TOOL ERROR] Search failed:', errMsg);
      return {
        success: false,
        error: `Web search execution failed: ${errMsg || 'Unknown network error'}`
      };
    }
  }
};

// ----------------------------------------------------
// Registry Mapping
// ----------------------------------------------------
const registry: ToolRegistry = {
  get_current_datetime: datetimeTool,
  get_memory: getMemoryTool,
  save_memory: saveMemoryTool,
  update_memory: updateMemoryTool,
  delete_memory: deleteMemoryTool,
  web_search: webSearchTool
};

/**
 * Returns whether a given tool name is registered.
 */
export function isRegisteredTool(name: string): boolean {
  const cleanName = name.replace(/^default_api:/, '');
  return Object.prototype.hasOwnProperty.call(registry, cleanName);
}

/**
 * Executes a registered tool by name with strict validation.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context?: { conversationId?: string }
): Promise<Record<string, unknown>> {
  const cleanName = name.replace(/^default_api:/, '');
  if (!isRegisteredTool(cleanName)) {
    throw new Error(`Security Exception: Tool '${name}' (resolved as '${cleanName}') is not registered and cannot be executed.`);
  }
  
  const tool = registry[cleanName];
  
  if (args && typeof args !== 'object') {
    throw new Error(`Validation Error: Invalid arguments passed to tool '${name}'`);
  }

  return await tool.execute(args || {}, context);
}

/**
 * Returns all registered tool declarations for Gemini.
 */
export function getToolDeclarations(): FunctionDeclaration[] {
  return Object.values(registry).map(t => t.declaration);
}
