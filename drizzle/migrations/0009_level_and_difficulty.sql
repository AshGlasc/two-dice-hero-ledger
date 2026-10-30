ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS skill_points integer NOT NULL DEFAULT 0;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS difficulty_modifiers jsonb NOT NULL DEFAULT '{}'::jsonb;
