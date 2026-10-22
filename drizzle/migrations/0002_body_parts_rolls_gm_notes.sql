CREATE TABLE public.body_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  part_key text NOT NULL,
  state integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (character_id, part_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_parts TO anon, authenticated;
GRANT ALL ON public.body_parts TO service_role;
ALTER TABLE public.body_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler corpo" ON public.body_parts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: criar corpo" ON public.body_parts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa aberta: editar corpo" ON public.body_parts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Mesa aberta: apagar corpo" ON public.body_parts FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER body_parts_touch BEFORE UPDATE ON public.body_parts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.rolls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  character_name text NOT NULL DEFAULT '',
  label text NOT NULL,
  die1 integer NOT NULL,
  die2 integer NOT NULL,
  modifier integer NOT NULL DEFAULT 0,
  total integer NOT NULL,
  difficulty integer,
  outcome text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rolls TO anon, authenticated;
GRANT ALL ON public.rolls TO service_role;
ALTER TABLE public.rolls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler rolagens" ON public.rolls FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: criar rolagens" ON public.rolls FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa aberta: apagar rolagens" ON public.rolls FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX rolls_created_at_idx ON public.rolls (created_at DESC);

CREATE TABLE public.gm_notes (
  id integer PRIMARY KEY DEFAULT 1,
  content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.gm_notes TO anon, authenticated;
GRANT ALL ON public.gm_notes TO service_role;
ALTER TABLE public.gm_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler notas" ON public.gm_notes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: criar notas" ON public.gm_notes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa aberta: editar notas" ON public.gm_notes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER gm_notes_touch BEFORE UPDATE ON public.gm_notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.gm_notes (id, content) VALUES (1, '');

ALTER TABLE public.body_parts REPLICA IDENTITY FULL;
ALTER TABLE public.rolls REPLICA IDENTITY FULL;
ALTER TABLE public.gm_notes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.body_parts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rolls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gm_notes;