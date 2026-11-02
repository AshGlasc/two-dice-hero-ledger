ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS armor_part text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS armor_reduction integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hand_slot text NOT NULL DEFAULT 'none';

ALTER TABLE public.backpack_items
  ADD COLUMN IF NOT EXISTS armor_part text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS armor_reduction integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS equipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hand_slot text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '';

ALTER TABLE public.weapons
  ADD COLUMN IF NOT EXISTS hand_slot text NOT NULL DEFAULT 'right',
  ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '';

ALTER TABLE public.monsters
  ADD COLUMN IF NOT EXISTS armor_head integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS armor_torso integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS armor_arms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS armor_legs integer NOT NULL DEFAULT 0;

ALTER TABLE public.battle_map_items
  ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hand_slot text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS weapon_id uuid REFERENCES public.weapons(id) ON DELETE CASCADE;
