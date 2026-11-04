-- Adiciona skill_key e skill_name aos sussurros de sanidade
ALTER TABLE public.sanity_whispers
  ADD COLUMN IF NOT EXISTS skill_key text,
  ADD COLUMN IF NOT EXISTS skill_name text;

-- Cria tabela de modelos pré-definidos de sussurro do mestre
CREATE TABLE IF NOT EXISTS public.whisper_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_key text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whisper_presets TO anon, authenticated;
GRANT ALL ON public.whisper_presets TO service_role;
ALTER TABLE public.whisper_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mesa aberta: ler modelos de sussurro" ON public.whisper_presets;
CREATE POLICY "Mesa aberta: ler modelos de sussurro" ON public.whisper_presets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Mesa aberta: inserir modelos de sussurro" ON public.whisper_presets;
CREATE POLICY "Mesa aberta: inserir modelos de sussurro" ON public.whisper_presets FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Mesa aberta: atualizar modelos de sussurro" ON public.whisper_presets;
CREATE POLICY "Mesa aberta: atualizar modelos de sussurro" ON public.whisper_presets FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Mesa aberta: excluir modelos de sussurro" ON public.whisper_presets;
CREATE POLICY "Mesa aberta: excluir modelos de sussurro" ON public.whisper_presets FOR DELETE USING (true);

ALTER TABLE public.whisper_presets REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'whisper_presets') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whisper_presets;
  END IF;
END $$;

-- Coluna de categoria nas notícias/pistas do celular
ALTER TABLE public.phone_clues
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '📰 Manchete';

