CREATE TABLE IF NOT EXISTS public.app_settings (id integer PRIMARY KEY DEFAULT 1, discord_webhook text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta config" ON public.app_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);