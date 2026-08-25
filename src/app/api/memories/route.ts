import { NextRequest, NextResponse } from 'next/server';
import { dbGetMemories, dbSaveMemory, dbDeleteMemory } from '../../../lib/db/memoriesDb';
import { sanitizeAndValidateKey, sanitizeAndValidateValue } from '../../../lib/ai/tools';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateConversationId(conversationId: string | null): string {
  if (!conversationId) {
    return 'default-session';
  }
  const trimmed = conversationId.trim();
  if (trimmed === 'default' || trimmed === 'default-session' || trimmed === 'conv-123') {
    return trimmed;
  }
  if (!UUID_REGEX.test(trimmed)) {
    throw new Error('Security Exception: Invalid conversation ID format');
  }
  return trimmed;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get('search') || undefined;
    const conversationIdParam = url.searchParams.get('conversationId');
    
    let conversationId = 'default-session';
    try {
      conversationId = validateConversationId(conversationIdParam);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    const memories = await dbGetMemories(conversationId, search);
    return NextResponse.json({ success: true, memories });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[MEMORIES API GET ERROR] Failed to fetch memories:', errMsg);
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON request' }, { status: 400 });
    }

    const { key, value, conversationId: conversationIdParam } = body;

    let cleanKey: string;
    let cleanValue: string;
    let conversationId = 'default-session';

    try {
      cleanKey = sanitizeAndValidateKey(key);
      cleanValue = sanitizeAndValidateValue(value);
      conversationId = validateConversationId(conversationIdParam);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    await dbSaveMemory(conversationId, cleanKey, cleanValue);
    return NextResponse.json({ success: true, message: `Memory '${cleanKey}' saved successfully.` });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[MEMORIES API POST ERROR] Failed to save memory:', errMsg);
    return NextResponse.json({ error: 'Failed to save memory' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    let key = url.searchParams.get('key');
    let conversationIdParam = url.searchParams.get('conversationId');

    if (!key) {
      try {
        const body = await req.json();
        key = body.key;
        if (body.conversationId) {
          conversationIdParam = body.conversationId;
        }
      } catch {
        // Body reading failed or empty, proceed with query params
      }
    }

    if (!key) {
      return NextResponse.json({ error: 'Missing required query parameter or body field: key' }, { status: 400 });
    }

    let cleanKey: string;
    let conversationId = 'default-session';

    try {
      cleanKey = sanitizeAndValidateKey(key);
      conversationId = validateConversationId(conversationIdParam);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    const deleted = await dbDeleteMemory(conversationId, cleanKey);
    return NextResponse.json({
      success: true,
      deleted,
      message: deleted ? `Memory key '${cleanKey}' deleted.` : `Memory key '${cleanKey}' not found.`
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[MEMORIES API DELETE ERROR] Failed to delete memory:', errMsg);
    return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 });
  }
}
