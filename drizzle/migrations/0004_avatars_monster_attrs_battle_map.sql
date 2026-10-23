ALTER TABLE public.characters ADD COLUMN avatar_url text NOT NULL DEFAULT '';
ALTER TABLE public.monsters ADD COLUMN avatar_url text NOT NULL DEFAULT '';
ALTER TABLE public.monsters ADD COLUMN former_life text NOT NULL DEFAULT '';
ALTER TABLE public.monsters ADD COLUMN intelecto integer NOT NULL DEFAULT 1;
ALTER TABLE public.monsters ADD COLUMN psique integer NOT NULL DEFAULT 1;
ALTER TABLE public.monsters ADD COLUMN fisico integer NOT NULL DEFAULT 1;
ALTER TABLE public.monsters ADD COLUMN motor integer NOT NULL DEFAULT 1;
ALTER TABLE public.combatants ADD COLUMN pos_x integer;
ALTER TABLE public.combatants ADD COLUMN pos_y integer;

CREATE TABLE public.battle_map (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cols integer NOT NULL DEFAULT 16,
  rows integer NOT NULL DEFAULT 12,
  background_url text NOT NULL DEFAULT '',
  terrain jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.battle_map TO anon, authenticated;
GRANT ALL ON public.battle_map TO service_role;
ALTER TABLE public.battle_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler mapa" ON public.battle_map FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: criar mapa" ON public.battle_map FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa aberta: editar mapa" ON public.battle_map FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
INSERT INTO public.battle_map (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.battle_map REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_map;