CREATE TABLE public.characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  player_name text NOT NULL DEFAULT '',
  concept text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  intelecto integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.characters TO anon, authenticated;
GRANT ALL ON public.characters TO service_role;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler personagens" ON public.characters FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: criar personagens" ON public.characters FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa aberta: editar personagens" ON public.characters FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Mesa aberta: apagar personagens" ON public.characters FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.character_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  skill_key text NOT NULL,
  bonus integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (character_id, skill_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_skills TO anon, authenticated;
GRANT ALL ON public.character_skills TO service_role;
ALTER TABLE public.character_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler skills" ON public.character_skills FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: criar skills" ON public.character_skills FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa aberta: editar skills" ON public.character_skills FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Mesa aberta: apagar skills" ON public.character_skills FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.weapons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  name text NOT NULL,
  weapon_type text NOT NULL DEFAULT '',
  damage text NOT NULL DEFAULT '',
  ammo text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weapons TO anon, authenticated;
GRANT ALL ON public.weapons TO service_role;
ALTER TABLE public.weapons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler armas" ON public.weapons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: criar armas" ON public.weapons FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa aberta: editar armas" ON public.weapons FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Mesa aberta: apagar armas" ON public.weapons FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.backpack_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backpack_items TO anon, authenticated;
GRANT ALL ON public.backpack_items TO service_role;
ALTER TABLE public.backpack_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler mochila" ON public.backpack_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: criar mochila" ON public.backpack_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa aberta: editar mochila" ON public.backpack_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Mesa aberta: apagar mochila" ON public.backpack_items FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER characters_touch BEFORE UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER character_skills_touch BEFORE UPDATE ON public.character_skills FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();