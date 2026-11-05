-- Sobrevivência (vício, conforto, fome, sede)
ALTER TABLE public.characters 
  ADD COLUMN IF NOT EXISTS vicio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS conforto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS hunger_state text DEFAULT 'satisfeito',
  ADD COLUMN IF NOT EXISTS thirst_state text DEFAULT 'satisfeito';

-- Mapas Regionais
CREATE TABLE IF NOT EXISTS public.regional_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.regional_maps TO anon, authenticated;
GRANT ALL ON public.regional_maps TO service_role;
ALTER TABLE public.regional_maps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mesa aberta: ler mapas regionais" ON public.regional_maps;
CREATE POLICY "Mesa aberta: ler mapas regionais" ON public.regional_maps FOR SELECT USING (true);

DROP POLICY IF EXISTS "Mesa aberta: inserir mapas regionais" ON public.regional_maps;
CREATE POLICY "Mesa aberta: inserir mapas regionais" ON public.regional_maps FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Mesa aberta: atualizar mapas regionais" ON public.regional_maps;
CREATE POLICY "Mesa aberta: atualizar mapas regionais" ON public.regional_maps FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Mesa aberta: excluir mapas regionais" ON public.regional_maps;
CREATE POLICY "Mesa aberta: excluir mapas regionais" ON public.regional_maps FOR DELETE USING (true);

ALTER TABLE public.regional_maps REPLICA IDENTITY FULL;

-- Marcadores / Pins no Mapa Regional
CREATE TABLE IF NOT EXISTS public.regional_map_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid REFERENCES public.regional_maps(id) ON DELETE CASCADE,
  name text NOT NULL,
  photo_url text DEFAULT '',
  description text DEFAULT '',
  secret_gm_notes text DEFAULT '',
  x_percent numeric NOT NULL,
  y_percent numeric NOT NULL,
  is_revealed boolean DEFAULT false,
  linked_battle_layout_id integer DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.regional_map_pins TO anon, authenticated;
GRANT ALL ON public.regional_map_pins TO service_role;
ALTER TABLE public.regional_map_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mesa aberta: ler pins de mapa regional" ON public.regional_map_pins;
CREATE POLICY "Mesa aberta: ler pins de mapa regional" ON public.regional_map_pins FOR SELECT USING (true);

DROP POLICY IF EXISTS "Mesa aberta: inserir pins de mapa regional" ON public.regional_map_pins;
CREATE POLICY "Mesa aberta: inserir pins de mapa regional" ON public.regional_map_pins FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Mesa aberta: atualizar pins de mapa regional" ON public.regional_map_pins;
CREATE POLICY "Mesa aberta: atualizar pins de mapa regional" ON public.regional_map_pins FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Mesa aberta: excluir pins de mapa regional" ON public.regional_map_pins;
CREATE POLICY "Mesa aberta: excluir pins de mapa regional" ON public.regional_map_pins FOR DELETE USING (true);

ALTER TABLE public.regional_map_pins REPLICA IDENTITY FULL;

-- Notas do mestre nos ladrilhos do grid de batalha
ALTER TABLE public.battle_map ADD COLUMN IF NOT EXISTS gm_tile_notes jsonb DEFAULT '{}'::jsonb;

-- Condições customizadas e ações por turno
ALTER TABLE public.combatants ADD COLUMN IF NOT EXISTS custom_conditions jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.combat_state ADD COLUMN IF NOT EXISTS active_turn_actions jsonb DEFAULT '{}'::jsonb;

-- Realtime publication
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'regional_maps') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.regional_maps;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'regional_map_pins') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.regional_map_pins;
  END IF;
END $$;

