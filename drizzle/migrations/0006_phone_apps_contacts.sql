CREATE TABLE public.phone_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.phone_clues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline text NOT NULL,
  body text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.phone_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  caption text NOT NULL DEFAULT '',
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages
  ADD COLUMN contact_id uuid REFERENCES public.phone_contacts(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_contacts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_clues TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_gallery TO anon, authenticated;
GRANT ALL ON public.phone_contacts, public.phone_clues, public.phone_gallery TO service_role;

ALTER TABLE public.phone_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_clues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mesa aberta: ler contatos do celular" ON public.phone_contacts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: criar contatos do celular" ON public.phone_contacts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa aberta: editar contatos do celular" ON public.phone_contacts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Mesa aberta: apagar contatos do celular" ON public.phone_contacts FOR DELETE TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: ler pistas do celular" ON public.phone_clues FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: publicar pistas do celular" ON public.phone_clues FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa aberta: apagar pistas do celular" ON public.phone_clues FOR DELETE TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: ler galeria do celular" ON public.phone_gallery FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: enviar fotos do celular" ON public.phone_gallery FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa aberta: apagar fotos do celular" ON public.phone_gallery FOR DELETE TO anon, authenticated USING (true);

ALTER TABLE public.phone_contacts REPLICA IDENTITY FULL;
ALTER TABLE public.phone_clues REPLICA IDENTITY FULL;
ALTER TABLE public.phone_gallery REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.phone_contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.phone_clues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.phone_gallery;
