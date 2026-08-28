-- ==========================================
-- SUPABASE PRODUCTION MIGRATION
-- Project: Aura Personal Assistant
-- Target Database: https://mmzajaadqhlvhseifcuc.supabase.co
-- ==========================================

-- Enable the UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------
-- 1. Table: conversations
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT conversations_pkey PRIMARY KEY (id)
);

-- ------------------------------------------
-- 2. Table: messages
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT messages_pkey PRIMARY KEY (id),
    CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id)
        REFERENCES public.conversations(id) ON DELETE CASCADE
);

-- ------------------------------------------
-- 3. Table: memories
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.memories (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    conversation_id UUID NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT memories_pkey PRIMARY KEY (id),
    CONSTRAINT memories_conversation_id_fkey FOREIGN KEY (conversation_id)
        REFERENCES public.conversations(id) ON DELETE CASCADE
);

-- ------------------------------------------
-- 4. Indexes for Query Performance
-- ------------------------------------------
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_memories_conversation_id ON public.memories(conversation_id);
CREATE INDEX IF NOT EXISTS idx_memories_key ON public.memories(key);

-- ------------------------------------------
-- 5. Row-Level Security (RLS) Configuration
-- ------------------------------------------
-- Enable RLS on all tables
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- Note on RLS Policies:
-- The Aura backend connects using the `service_role` key (via getSupabaseClient()),
-- which bypasses RLS policies entirely. Keeping RLS enabled with NO policies defined
-- blocks all direct unauthorized client-side access (anonymous or authenticated) 
-- while allowing the Next.js API server full read/write permissions.

-- ------------------------------------------
-- 6. Trigger: rls_auto_enable
-- ------------------------------------------
-- Automatic DDL trigger to ensure RLS is enabled on any newly created tables
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    obj record;
BEGIN
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
    LOOP
        IF obj.object_type = 'table' AND obj.schema_name = 'public' THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', obj.object_identity);
        END IF;
    END LOOP;
END;
$$;

-- Create event trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_event_trigger WHERE evtname = 'rls_auto_enable_trigger'
    ) THEN
        CREATE EVENT TRIGGER rls_auto_enable_trigger
        ON ddl_command_end
        WHEN TAG IN ('CREATE TABLE')
        EXECUTE FUNCTION public.rls_auto_enable();
    END IF;
END $$;
