import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Character = Tables["characters"]["Row"];
export type CharacterSkill = Tables["character_skills"]["Row"];
export type Weapon = Tables["weapons"]["Row"];
export type BackpackItem = Tables["backpack_items"]["Row"];
export type BodyPart = Tables["body_parts"]["Row"];
export type Roll = Tables["rolls"]["Row"];

export type CharacterSheet = {
  character: Character;
  skills: CharacterSkill[];
  weapons: Weapon[];
  backpack: BackpackItem[];
  body: BodyPart[];
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
      const [character, skills, weapons, backpack, body] = await Promise.all([
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
        supabase.from("body_parts").select("*").eq("character_id", id),
      ]);
      for (const r of [character, skills, weapons, backpack, body]) if (r.error) throw r.error;
      if (!character.data) return null;
      return {
        character: character.data,
        skills: skills.data ?? [],
        weapons: weapons.data ?? [],
        backpack: backpack.data ?? [],
        body: body.data ?? [],
      };
    },
  });

export type GroupData = {
  characters: Character[];
  skills: CharacterSkill[];
  body: BodyPart[];
};

/** Todos os personagens com skills e corpo — para o painel do mestre. */
export const groupQuery = queryOptions({
  queryKey: ["group"],
  queryFn: async (): Promise<GroupData> => {
    const [characters, skills, body] = await Promise.all([
      supabase.from("characters").select("*").order("created_at", { ascending: true }),
      supabase.from("character_skills").select("*"),
      supabase.from("body_parts").select("*"),
    ]);
    for (const r of [characters, skills, body]) if (r.error) throw r.error;
    return { characters: characters.data ?? [], skills: skills.data ?? [], body: body.data ?? [] };
  },
});

export const rollsQuery = queryOptions({
  queryKey: ["rolls"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("rolls")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;
    return data;
  },
});

export const gmNotesQuery = queryOptions({
  queryKey: ["gm_notes"],
  queryFn: async () => {
    const { data, error } = await supabase.from("gm_notes").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data?.content ?? "";
  },
});

export type Monster = Tables["monsters"]["Row"];
export type Combatant = Tables["combatants"]["Row"];
export type CombatState = Tables["combat_state"]["Row"];

export const monstersQuery = queryOptions({
  queryKey: ["monsters"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("monsters")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  },
});

export type CombatData = { state: CombatState; combatants: Combatant[] };

export const EMPTY_COMBAT_STATE: CombatState = {
  id: 1,
  active: false,
  round: 1,
  current_combatant_id: null,
  updated_at: "",
};

export const combatQuery = queryOptions({
  queryKey: ["combat"],
  queryFn: async (): Promise<CombatData> => {
    const [state, combatants] = await Promise.all([
      supabase.from("combat_state").select("*").eq("id", 1).maybeSingle(),
      supabase.from("combatants").select("*").order("created_at", { ascending: true }),
    ]);
    if (state.error) throw state.error;
    if (combatants.error) throw combatants.error;
    return { state: state.data ?? EMPTY_COMBAT_STATE, combatants: combatants.data ?? [] };
  },
});

export type BattleMap = Tables["battle_map"]["Row"];

export const EMPTY_MAP: BattleMap = {
  id: 1,
  cols: 16,
  rows: 12,
  background_url: "",
  terrain: {},
  updated_at: "",
};

export const battleMapQuery = queryOptions({
  queryKey: ["battle_map"],
  queryFn: async (): Promise<BattleMap> => {
    const { data, error } = await supabase.from("battle_map").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data ?? EMPTY_MAP;
  },
});
