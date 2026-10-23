CREATE TABLE public.monsters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  hp_max integer NOT NULL DEFAULT 10,
  defense integer NOT NULL DEFAULT 10,
  attack_bonus integer NOT NULL DEFAULT 0,
  initiative_bonus integer NOT NULL DEFAULT 0,
  attacks text NOT NULL DEFAULT '',
  abilities text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monsters TO anon, authenticated;
GRANT ALL ON public.monsters TO service_role;
ALTER TABLE public.monsters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler monstros" ON public.monsters FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: criar monstros" ON public.monsters FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa aberta: editar monstros" ON public.monsters FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Mesa aberta: apagar monstros" ON public.monsters FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.combatants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('character', 'monster')),
  character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE,
  monster_id uuid REFERENCES public.monsters(id) ON DELETE CASCADE,
  name text NOT NULL,
  hp_current integer,
  hp_max integer,
  defense integer,
  attack_bonus integer NOT NULL DEFAULT 0,
  initiative_bonus integer NOT NULL DEFAULT 0,
  initiative integer,
  conditions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.combatants TO anon, authenticated;
GRANT ALL ON public.combatants TO service_role;
ALTER TABLE public.combatants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler combatentes" ON public.combatants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: criar combatentes" ON public.combatants FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa aberta: editar combatentes" ON public.combatants FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Mesa aberta: apagar combatentes" ON public.combatants FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.combat_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active boolean NOT NULL DEFAULT false,
  round integer NOT NULL DEFAULT 1,
  current_combatant_id uuid REFERENCES public.combatants(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.combat_state TO anon, authenticated;
GRANT ALL ON public.combat_state TO service_role;
ALTER TABLE public.combat_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler combate" ON public.combat_state FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: criar combate" ON public.combat_state FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa aberta: editar combate" ON public.combat_state FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
INSERT INTO public.combat_state (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.monsters REPLICA IDENTITY FULL;
ALTER TABLE public.combatants REPLICA IDENTITY FULL;
ALTER TABLE public.combat_state REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.monsters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.combatants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.combat_state;