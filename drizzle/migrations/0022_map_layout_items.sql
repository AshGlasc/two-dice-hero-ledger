ALTER TABLE public.map_layouts
  ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;
