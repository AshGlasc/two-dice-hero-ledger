ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS sanity_current integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS sanity_max integer NOT NULL DEFAULT 10;

CREATE TABLE IF NOT EXISTS public.sanity_whispers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sanity_whispers TO anon, authenticated;
GRANT ALL ON public.sanity_whispers TO service_role;
ALTER TABLE public.sanity_whispers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler sussurros de sanidade" ON public.sanity_whispers FOR SELECT USING (true);
CREATE POLICY "Mesa aberta: enviar sussurros de sanidade" ON public.sanity_whispers FOR INSERT WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.sanity_whispers;
