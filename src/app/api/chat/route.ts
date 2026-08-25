import { NextRequest, NextResponse } from 'next/server';
import { getChatCompletionWithHistory, SYSTEM_INSTRUCTION } from '@/lib/ai/openai';
import { getGeminiCompletionWithHistory, extractMemoryCandidates } from '@/lib/ai/gemini';
import { getSupabaseClient } from '@/lib/db/supabase';
import { dbSaveMemory, dbGetMemories } from '@/lib/db/memoriesDb';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const mockConversations = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();

async function extractAndSaveMemory(message: string, conversationId: string) {
  console.log('[MEMORY] Checking message for memory candidates...');
  const candidates = await extractMemoryCandidates(message);
  if (candidates.length === 0) {
    console.log('[MEMORY] No memory candidates found in message.');
    return;
  }
  
  console.log(`[MEMORY] Found ${candidates.length} candidate(s):`, JSON.stringify(candidates));
  
  for (const candidate of candidates) {
    const { key, value } = candidate;
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('key') || 
      lowerKey.includes('password') || 
      lowerKey.includes('token') || 
      lowerKey.includes('secret') || 
      lowerKey.includes('auth') || 
      lowerKey.includes('credential')
    ) {
      console.warn(`[MEMORY WARNING] Blocked saving of potentially sensitive memory key: ${key}`);
      continue;
    }

    const lowerVal = value.toLowerCase();
    const isSensitiveVal = 
      lowerVal.includes('key=') || 
      lowerVal.includes('api_key') || 
      lowerVal.includes('bearer ') || 
      /^[a-zA-Z0-9_-]{32,}$/.test(value) || 
      lowerVal.includes('password') ||
      lowerVal.includes('secret');
      
    if (isSensitiveVal) {
      console.warn(`[MEMORY WARNING] Blocked saving of potentially sensitive memory value.`);
      continue;
    }

    try {
      await dbSaveMemory(conversationId, key, value);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[MEMORY ERROR] Failed to save memory for key ${key}:`, errMsg);
    }
  }
}


export async function GET(req: NextRequest) {
  try {
    console.log('[CHAT] GET request received');
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      console.warn('[CHAT ERROR] Missing required parameter: conversationId');
      return NextResponse.json(
        { error: 'Missing required parameter: conversationId' },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(conversationId)) {
      console.warn(`[CHAT ERROR] Invalid conversation ID format: ${conversationId}`);
      return NextResponse.json(
        { error: 'Invalid conversation ID format' },
        { status: 400 }
      );
    }

    if (process.env.MOCK_DB === 'true') {
      console.log(`[CHAT] (MOCK) Fetching message history for conversation: ${conversationId}`);
      const history = mockConversations.get(conversationId) || [];
      const formattedMessages = history.map((msg, index) => ({
        id: String(index),
        role: msg.role,
        content: msg.content,
        createdAt: new Date().toISOString(),
      }));
      console.log(`[CHAT] (MOCK) History loaded successfully: ${formattedMessages.length} messages`);
      return NextResponse.json(formattedMessages);
    }


    console.log(`[CHAT] Fetching message history for conversation: ${conversationId}`);
    const { data: messages, error: dbError } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (dbError) {
      console.error(`[CHAT ERROR] Database messages lookup failed: ${dbError.message}`);
      return NextResponse.json(
        { error: 'Failed to retrieve message history from database.' },
        { status: 500 }
      );
    }

    const formattedMessages = (messages || []).map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.created_at,
    }));

    console.log(`[CHAT] History loaded successfully: ${formattedMessages.length} messages`);
    return NextResponse.json(formattedMessages);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[CHAT ERROR] Unexpected error in GET /api/chat:', error.message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('[CHAT] POST request received');
    const supabase = getSupabaseClient();
    let body;
    try {
      body = await req.json();
    } catch (parseErr: unknown) {
      const err = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
      console.error('[CHAT ERROR] Malformed JSON request body:', err.message);
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      console.warn('[CHAT ERROR] Request body is not an object');
      return NextResponse.json(
        { error: 'Malformed JSON request' },
        { status: 400 }
      );
    }

    const { message, conversationId } = body;

    // Validate message
    if (message === undefined || message === null) {
      console.warn('[CHAT ERROR] Missing required field: message');
      return NextResponse.json(
        { error: 'Missing required field: message' },
        { status: 400 }
      );
    }

    if (typeof message !== 'string') {
      console.warn('[CHAT ERROR] Message must be a string');
      return NextResponse.json(
        { error: 'Message must be a string' },
        { status: 400 }
      );
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      console.warn('[CHAT ERROR] Message cannot be empty or whitespace only');
      return NextResponse.json(
        { error: 'Message cannot be empty or whitespace only' },
        { status: 400 }
      );
    }

    if (trimmedMessage.length > 5000) {
      console.warn('[CHAT ERROR] Message exceeds maximum allowed length of 5000 characters');
      return NextResponse.json(
        { error: 'Message exceeds maximum allowed length of 5000 characters' },
        { status: 400 }
      );
    }

    console.log(`[CHAT] message details validated. Length: ${trimmedMessage.length}`);

    let activeConversationId = conversationId;

    // Validate or create conversationId
    if (activeConversationId) {
      if (typeof activeConversationId !== 'string' || !UUID_REGEX.test(activeConversationId)) {
        console.warn(`[CHAT ERROR] Invalid active conversation ID format: ${activeConversationId}`);
        return NextResponse.json(
          { error: 'Invalid conversation ID format' },
          { status: 400 }
        );
      }

      console.log(`[CHAT] Verifying active conversation: ${activeConversationId}`);
      if (process.env.MOCK_DB === 'true') {
        if (!mockConversations.has(activeConversationId)) {
          console.warn(`[CHAT ERROR] (MOCK) Conversation not found: ${activeConversationId}`);
          return NextResponse.json(
            { error: 'Conversation not found or invalid conversation ID' },
            { status: 400 }
          );
        }
        console.log('[CHAT] (MOCK) Conversation verified successfully');
      } else {
        // Check if conversation exists
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', activeConversationId)
          .maybeSingle();

        if (convError) {
          console.error(`[CHAT ERROR] Database error checking conversation: ${convError.message}`);
          return NextResponse.json(
            { error: 'Database service error. Please try again.' },
            { status: 500 }
          );
        }

        if (!conversation) {
          console.warn(`[CHAT ERROR] Conversation not found in database: ${activeConversationId}`);
          return NextResponse.json(
            { error: 'Conversation not found or invalid conversation ID' },
            { status: 400 }
          );
        }
        console.log('[CHAT] Conversation verified successfully');
      }
    } else {
      if (process.env.MOCK_DB === 'true') {
        activeConversationId = '11111111-1111-1111-1111-111111111111';
        mockConversations.set(activeConversationId, []);
        console.log(`[CHAT] (MOCK) Conversation created successfully. ID: ${activeConversationId}`);
      } else {
        console.log('[CHAT] Creating conversation');
        console.log('[CHAT] Supabase client initialized');
        console.log('[CHAT] Conversation insert started');
        // Create new conversation
        const title = trimmedMessage.substring(0, 40) + (trimmedMessage.length > 40 ? '...' : '');
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({ title })
          .select('id')
          .single();

        if (createError || !newConv) {
          const safeError = createError?.message || 'Unknown error';
          console.error(`[CHAT ERROR] Conversation insert failed: ${safeError}`);
          return NextResponse.json(
            { error: 'Failed to create a new conversation session.' },
            { status: 500 }
          );
        }

        console.log('[CHAT] Conversation insert succeeded');
        activeConversationId = newConv.id;
        console.log(`[CHAT] Conversation created successfully. ID: ${activeConversationId}`);
      }
    }


    let dbMessages: Array<{ role: string; content: string }> = [];

    if (process.env.MOCK_DB === 'true') {
      console.log(`[CHAT] (MOCK) Saving user message under conversation ID: ${activeConversationId}`);
      const history = mockConversations.get(activeConversationId) || [];
      history.push({ role: 'user', content: trimmedMessage });
      mockConversations.set(activeConversationId, history);
      console.log('[CHAT] (MOCK) User message saved successfully');

      console.log('[CHAT] (MOCK) Loading previous messages for context');
      dbMessages = mockConversations.get(activeConversationId) || [];
      console.log(`[CHAT] (MOCK) Previous messages loaded: ${dbMessages.length} messages`);
    } else {
      // Save user message to database
      console.log(`[CHAT] Saving user message under conversation ID: ${activeConversationId}`);
      const { error: userMsgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversationId,
          role: 'user',
          content: trimmedMessage,
        });

      if (userMsgError) {
        console.error(`[CHAT ERROR] Failed to save user message: ${userMsgError.message}`);
        return NextResponse.json(
          { error: 'Failed to archive user message.' },
          { status: 500 }
        );
      }
      console.log('[CHAT] User message saved successfully');

      // Load full message history for context
      console.log('[CHAT] Loading previous messages for context');
      const { data, error: historyError } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true });

      if (historyError) {
        console.error(`[CHAT ERROR] Failed to load history: ${historyError.message}`);
        return NextResponse.json(
          { error: 'Failed to load conversation history for context.' },
          { status: 500 }
        );
      }
      dbMessages = (data || []).map(msg => ({ role: msg.role, content: msg.content }));
      console.log(`[CHAT] Previous messages loaded: ${dbMessages.length} messages`);
    }

    // Extract and store memories in the background
    try {
      await extractAndSaveMemory(trimmedMessage, activeConversationId);
    } catch (memError) {
      console.error('[MEMORY ERROR] Failed to extract/save memory:', memError);
    }


    // Build messages array for OpenAI
    const openAIMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      ...(dbMessages || []).map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content as string,
      })),
    ];

    // Fetch memories to inject as context
    let memoriesText = '';
    try {
      const mems = await dbGetMemories(conversationId);
      if (mems.length > 0) {
        // De-duplicate using Map to keep the latest one
        const uniqueMemsMap = new Map<string, string>();
        for (const m of mems) {
          uniqueMemsMap.set(m.key, m.value);
        }
        const uniqueMems = Array.from(uniqueMemsMap.entries());
        memoriesText = 'Known user memories:\n' + uniqueMems.map(([k, v]) => `- ${k}: ${v}`).join('\n');
        console.log(`[MEMORY] Loaded ${uniqueMems.length} unique memory/memories for context injection.`);
      }
    } catch (err) {
      console.error('[MEMORY ERROR] Failed to retrieve memories:', err);
    }

    // Call AI service (Gemini or OpenAI)
    const isGeminiKey = (key?: string) => !!key && (key.startsWith('AQ.') || key.startsWith('AIza') || !key.startsWith('sk-'));
    const hasGeminiKey = isGeminiKey(process.env.GEMINI_API_KEY) || isGeminiKey(process.env.OPENAI_API_KEY);
    const aiProvider = process.env.AI_PROVIDER || (hasGeminiKey ? 'gemini' : 'openai');
    console.log(`[CHAT] Using AI provider: ${aiProvider}`);
    let responseText;

    if (aiProvider === 'gemini') {
      console.log('[CHAT] Calling Gemini API...');
      try {
        responseText = await getGeminiCompletionWithHistory(openAIMessages, memoriesText, conversationId);
        console.log('[CHAT] Gemini response received successfully');
      } catch (geminiError: unknown) {
        const error = geminiError instanceof Error ? geminiError : new Error(String(geminiError));
        console.error(`[CHAT ERROR] Gemini request failed: ${error.message}`);
        return NextResponse.json(
          { error: `Gemini API error: ${error.message}` },
          { status: 500 }
        );
      }
    } else {
      console.log('[CHAT] Calling OpenAI API...');
      try {
        responseText = await getChatCompletionWithHistory(openAIMessages);
        console.log('[CHAT] OpenAI response received successfully');
      } catch (aiError: unknown) {
        const error = aiError instanceof Error ? aiError : new Error(String(aiError));
        console.error(`[CHAT ERROR] OpenAI request failed: ${error.message}`);
        
        if (error.message?.includes('OPENAI_API_KEY') || error.message?.includes('api_key')) {
          return NextResponse.json(
            { error: 'OpenAI API is not configured. Please contact the administrator.' },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { error: error.message || 'Failed to generate AI response' },
          { status: 500 }
        );
      }
    }

    // Save assistant response to database
    console.log('[CHAT] Saving assistant message...');
    if (process.env.MOCK_DB === 'true') {
      const history = mockConversations.get(activeConversationId) || [];
      history.push({ role: 'assistant', content: responseText });
      mockConversations.set(activeConversationId, history);
      console.log('[CHAT] (MOCK) Assistant message saved successfully');
    } else {
      const { error: assistantMsgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversationId,
          role: 'assistant',
          content: responseText,
        });

      if (assistantMsgError) {
        console.error(`[CHAT ERROR] Failed to save assistant response: ${assistantMsgError.message}`);
      } else {
        console.log('[CHAT] Assistant message saved successfully');
      }
    }

    // Update conversation updated_at
    console.log('[CHAT] Updating conversation timestamp...');
    if (process.env.MOCK_DB === 'true') {
      console.log('[CHAT] (MOCK) Conversation timestamp updated successfully');
    } else {
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeConversationId);

      if (updateError) {
        console.error(`[CHAT ERROR] Failed to update conversation timestamp: ${updateError.message}`);
      } else {
        console.log('[CHAT] Conversation timestamp updated successfully');
      }
    }


    return NextResponse.json({
      conversationId: activeConversationId,
      message: responseText,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[CHAT ERROR] Unexpected error in POST /api/chat:', error.message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
