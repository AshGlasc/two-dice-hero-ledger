DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['app_settings','characters','character_skills','body_parts','weapons','backpack_items','map_layouts','rolls','gm_notes','monsters','combatants','combat_state','battle_map','battle_map_items','combat_events','messages','phone_contacts','phone_clues','phone_gallery','catalog_items','sanity_whispers'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;