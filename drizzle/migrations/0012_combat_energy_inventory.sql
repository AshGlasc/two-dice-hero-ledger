ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS energia_atual integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS energia_maxima integer NOT NULL DEFAULT 10;

UPDATE public.characters c
SET energia_maxima = 10
  + 2 * (c.fisico + COALESCE((SELECT s.bonus FROM public.character_skills s WHERE s.character_id = c.id AND s.skill_key = 'vigor'), 0))
  + 2 * (c.psique + COALESCE((SELECT s.bonus FROM public.character_skills s WHERE s.character_id = c.id AND s.skill_key = 'vontade'), 0)),
    energia_atual = 10
  + 2 * (c.fisico + COALESCE((SELECT s.bonus FROM public.character_skills s WHERE s.character_id = c.id AND s.skill_key = 'vigor'), 0))
  + 2 * (c.psique + COALESCE((SELECT s.bonus FROM public.character_skills s WHERE s.character_id = c.id AND s.skill_key = 'vontade'), 0));

ALTER TABLE public.backpack_items
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'equipment',
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS heal_hp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS heal_sanity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS restore_energy integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS temp_shield integer NOT NULL DEFAULT 0;

ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS restore_energy integer NOT NULL DEFAULT 0;

ALTER TABLE public.combatants
  ADD COLUMN IF NOT EXISTS temporary_shield integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS condition_durations jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.battle_map_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '📦',
  x integer NOT NULL,
  y integer NOT NULL,
  movable boolean NOT NULL DEFAULT false,
  collectible boolean NOT NULL DEFAULT true,
  collection_difficulty integer,
  collection_skill_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.battle_map_items TO anon, authenticated;
GRANT ALL ON public.battle_map_items TO service_role;
ALTER TABLE public.battle_map_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler itens no mapa" ON public.battle_map_items FOR SELECT USING (true);
CREATE POLICY "Mesa aberta: criar itens no mapa" ON public.battle_map_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Mesa aberta: editar itens no mapa" ON public.battle_map_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Mesa aberta: remover itens no mapa" ON public.battle_map_items FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_map_items;

CREATE TABLE IF NOT EXISTS public.combat_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  character_name text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.combat_events TO anon, authenticated;
GRANT ALL ON public.combat_events TO service_role;
ALTER TABLE public.combat_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler eventos de combate" ON public.combat_events FOR SELECT USING (true);
CREATE POLICY "Mesa aberta: criar eventos de combate" ON public.combat_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Mesa aberta: apagar eventos de combate" ON public.combat_events FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.combat_events;
