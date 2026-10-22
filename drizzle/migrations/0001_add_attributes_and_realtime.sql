ALTER TABLE public.characters ADD COLUMN psique integer NOT NULL DEFAULT 1;
ALTER TABLE public.characters ADD COLUMN fisico integer NOT NULL DEFAULT 1;
ALTER TABLE public.characters ADD COLUMN motor integer NOT NULL DEFAULT 1;

ALTER PUBLICATION supabase_realtime ADD TABLE public.characters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.character_skills;
ALTER PUBLICATION supabase_realtime ADD TABLE public.weapons;
ALTER PUBLICATION supabase_realtime ADD TABLE public.backpack_items;

ALTER TABLE public.characters REPLICA IDENTITY FULL;
ALTER TABLE public.character_skills REPLICA IDENTITY FULL;
ALTER TABLE public.weapons REPLICA IDENTITY FULL;
ALTER TABLE public.backpack_items REPLICA IDENTITY FULL;