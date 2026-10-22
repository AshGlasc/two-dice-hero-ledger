import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Character = Database["public"]["Tables"]["characters"]["Row"];
export type CharacterSkill = Database["public"]["Tables"]["character_skills"]["Row"];
export type Weapon = Database["public"]["Tables"]["weapons"]["Row"];
export type BackpackItem = Database["public"]["Tables"]["backpack_items"]["Row"];

export type CharacterSheet = {
  character: Character;
  skills: CharacterSkill[];
  weapons: Weapon[];
  backpack: BackpackItem[];
};

export const charactersQuery = queryOptions({
  queryKey: ["characters"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("characters")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  },
});

export const sheetQueryKey = (id: string) => ["sheet", id] as const;

export const sheetQuery = (id: string) =>
  queryOptions({
    queryKey: sheetQueryKey(id),
    queryFn: async (): Promise<CharacterSheet | null> => {
      const [character, skills, weapons, backpack] = await Promise.all([
        supabase.from("characters").select("*").eq("id", id).maybeSingle(),
        supabase.from("character_skills").select("*").eq("character_id", id),
        supabase
          .from("weapons")
          .select("*")
          .eq("character_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("backpack_items")
          .select("*")
          .eq("character_id", id)
          .order("created_at", { ascending: true }),
      ]);
      for (const r of [character, skills, weapons, backpack]) if (r.error) throw r.error;
      if (!character.data) return null;
      return {
        character: character.data,
        skills: skills.data ?? [],
        weapons: weapons.data ?? [],
        backpack: backpack.data ?? [],
      };
    },
  });
