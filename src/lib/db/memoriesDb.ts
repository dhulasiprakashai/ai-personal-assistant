import { getSupabaseClient } from './supabase';

export interface Memory {
  id?: string;
  conversation_id: string;
  key: string;
  value: string;
  created_at?: string;
  updated_at?: string;
}

// In-memory mock DB for memories when MOCK_DB === 'true'
export const mockMemories = new Map<string, Memory>();

/**
 * Safely inserts or updates a memory in mock or real DB.
 */
export async function dbSaveMemory(conversationId: string, key: string, value: string): Promise<void> {
  const isMock = process.env.MOCK_DB === 'true';
  const cleanKey = key.trim();
  const cleanValue = value.trim();

  if (isMock) {
    const memKey = `${conversationId}:${cleanKey}`;
    mockMemories.set(memKey, { conversation_id: conversationId, key: cleanKey, value: cleanValue });
    console.log(`[MEMORY DB] (MOCK) Saved memory key: ${cleanKey}, value: ${cleanValue}`);
    return;
  }

  const supabase = getSupabaseClient();
  
  // Check if key already exists in this conversation
  const { data: existing, error: selectError } = await supabase
    .from('memories')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('key', cleanKey)
    .maybeSingle();

  if (selectError) {
    throw new Error(`DB Error: Failed to query existing memory: ${selectError.message}`);
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('memories')
      .update({
        value: cleanValue,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(`DB Error: Failed to update memory: ${updateError.message}`);
    }
  } else {
    const { error: insertError } = await supabase
      .from('memories')
      .insert({
        conversation_id: conversationId,
        key: cleanKey,
        value: cleanValue
      });

    if (insertError) {
      throw new Error(`DB Error: Failed to insert memory: ${insertError.message}`);
    }
  }
}

/**
 * Retrieves matching memories.
 * Can search by key OR by query.
 */
export async function dbGetMemories(conversationId: string, searchKeyOrQuery?: string): Promise<Memory[]> {
  const isMock = process.env.MOCK_DB === 'true';

  if (isMock) {
    const mems = Array.from(mockMemories.values());
    if (!searchKeyOrQuery) {
      return mems;
    }
    const cleanSearch = searchKeyOrQuery.toLowerCase();
    return mems.filter(m => 
      m.key.toLowerCase().includes(cleanSearch) || 
      m.value.toLowerCase().includes(cleanSearch)
    );
  }

  const supabase = getSupabaseClient();
  
  // Load memories. We order by updated_at ascending so that newer duplicates overwrite older ones during de-duplication.
  let queryBuilder = supabase.from('memories').select('*');

  if (searchKeyOrQuery) {
    queryBuilder = queryBuilder.or(`key.ilike.%${searchKeyOrQuery}%,value.ilike.%${searchKeyOrQuery}%`);
  }

  const { data, error } = await queryBuilder.order('updated_at', { ascending: true });
  if (error) {
    throw new Error(`DB Error: Failed to fetch memories: ${error.message}`);
  }
  return data || [];
}

/**
 * Deletes a memory by key.
 */
export async function dbDeleteMemory(conversationId: string, key: string): Promise<boolean> {
  const isMock = process.env.MOCK_DB === 'true';
  const cleanKey = key.trim();

  if (isMock) {
    const memKey = `${conversationId}:${cleanKey}`;
    if (mockMemories.has(memKey)) {
      mockMemories.delete(memKey);
      console.log(`[MEMORY DB] (MOCK) Deleted memory key: ${cleanKey}`);
      return true;
    }
    // Search matching keys in mock DB as fallback
    let deletedCount = 0;
    for (const [k, m] of mockMemories.entries()) {
      if (m.key.toLowerCase() === cleanKey.toLowerCase()) {
        mockMemories.delete(k);
        deletedCount++;
      }
    }
    return deletedCount > 0;
  }

  const supabase = getSupabaseClient();
  const { error, count } = await supabase
    .from('memories')
    .delete({ count: 'exact' })
    .eq('key', cleanKey);

  if (error) {
    throw new Error(`DB Error: Failed to delete memory: ${error.message}`);
  }

  return (count !== null && count > 0);
}
