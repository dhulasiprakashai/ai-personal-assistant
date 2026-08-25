import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db/supabase';

export async function GET() {
  try {
    if (process.env.MOCK_DB === 'true') {
      return NextResponse.json([
        {
          id: '11111111-1111-1111-1111-111111111111',
          title: 'Mock conversation',
          updated_at: new Date().toISOString()
        }
      ]);
    }

    const supabase = getSupabaseClient();
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve conversations from database.' },
        { status: 500 }
      );
    }

    return NextResponse.json(conversations || []);
  } catch (err: unknown) {
    console.error('Unexpected error in GET /api/conversations:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
