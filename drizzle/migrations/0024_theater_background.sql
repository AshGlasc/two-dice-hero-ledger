ALTER TABLE public.battle_map
  ADD COLUMN IF NOT EXISTS theater_background_url text NOT NULL DEFAULT '';
