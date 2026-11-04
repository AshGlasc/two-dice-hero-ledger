-- Adiciona configurações de áudio e trilhas pré-salvas em app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS audio_settings jsonb NOT NULL DEFAULT '{"ambience":"none","ambience_volume":0.5,"track_url":"","track_title":"","track_playing":false,"track_volume":0.5}'::jsonb,
  ADD COLUMN IF NOT EXISTS music_tracks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Adiciona tag de sobrevivência nos itens do catálogo e da mochila
ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS survival_tag text NOT NULL DEFAULT '';

ALTER TABLE public.backpack_items
  ADD COLUMN IF NOT EXISTS survival_tag text NOT NULL DEFAULT '';

