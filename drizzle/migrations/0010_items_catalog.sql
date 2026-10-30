CREATE TABLE IF NOT EXISTS public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'equipment',
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  damage text DEFAULT NULL,
  skill_key text DEFAULT 'ferramenta_fisica',
  range integer DEFAULT 1,
  ammo text DEFAULT NULL,
  uses_max integer DEFAULT 0,
  heal_hp integer DEFAULT 0,
  heal_sanity integer DEFAULT 0,
  temp_shield integer DEFAULT 0,
  skill_bonuses jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_movable boolean NOT NULL DEFAULT false,
  requires_roll_to_interact boolean NOT NULL DEFAULT false,
  interaction_skill_key text DEFAULT NULL,
  interaction_difficulty integer DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_items TO anon, authenticated;
GRANT ALL ON public.catalog_items TO service_role;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler itens catalogo" ON public.catalog_items FOR SELECT USING (true);
CREATE POLICY "Mesa aberta: criar itens catalogo" ON public.catalog_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Mesa aberta: editar itens catalogo" ON public.catalog_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Mesa aberta: deletar itens catalogo" ON public.catalog_items FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_items;
