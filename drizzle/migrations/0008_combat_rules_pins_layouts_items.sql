ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS pin_hash text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS pin_salt text NOT NULL DEFAULT '';
ALTER TABLE public.weapons ADD COLUMN IF NOT EXISTS skill_key text NOT NULL DEFAULT 'ferramenta_fisica', ADD COLUMN IF NOT EXISTS range integer NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS uses_max integer NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS uses_current integer NOT NULL DEFAULT 0;
ALTER TABLE public.backpack_items ADD COLUMN IF NOT EXISTS skill_bonuses jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.combatants ADD COLUMN IF NOT EXISTS moved_round integer, ADD COLUMN IF NOT EXISTS defending boolean NOT NULL DEFAULT false;

CREATE TABLE public.map_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cols integer NOT NULL DEFAULT 16,
  rows integer NOT NULL DEFAULT 12,
  background_url text NOT NULL DEFAULT '',
  terrain jsonb NOT NULL DEFAULT '{}'::jsonb,
  tile_images jsonb NOT NULL DEFAULT '{}'::jsonb,
  fog jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_layouts TO anon, authenticated;
GRANT ALL ON public.map_layouts TO service_role;
ALTER TABLE public.map_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler layouts" ON public.map_layouts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: criar layouts" ON public.map_layouts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa aberta: editar layouts" ON public.map_layouts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Mesa aberta: apagar layouts" ON public.map_layouts FOR DELETE TO anon, authenticated USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_layouts;