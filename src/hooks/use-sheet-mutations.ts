import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  sheetQueryKey,
  type BackpackItem,
  type Character,
  type CharacterSheet,
  type Weapon,
} from "@/lib/rpg-queries";

type CharacterPatch = Partial<
  Pick<
    Character,
    "name" | "player_name" | "concept" | "notes" | "intelecto" | "psique" | "fisico" | "motor" | "avatar_url" | "money"
  >
>;
type WeaponInput = Pick<Weapon, "name" | "weapon_type" | "damage" | "ammo" | "notes">;
type BackpackInput = Pick<BackpackItem, "name" | "quantity" | "notes">;

function onSaveError(error: unknown) {
  console.error(error);
  toast.error("Não foi possível salvar. Tente de novo.");
}

export function useSheetMutations(characterId: string) {
  const qc = useQueryClient();
  const key = sheetQueryKey(characterId);

  const patchCache = (fn: (sheet: CharacterSheet) => CharacterSheet) => {
    qc.setQueryData<CharacterSheet | null>(key, (old) => (old ? fn(old) : old));
  };
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const updateCharacter = useMutation({
    mutationFn: async (patch: CharacterPatch) => {
      const { error } = await supabase.from("characters").update(patch).eq("id", characterId);
      if (error) throw error;
    },
    onMutate: (patch) =>
      patchCache((s) => ({ ...s, character: { ...s.character, ...patch } })),
    onError: (e) => {
      onSaveError(e);
      refresh();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["characters"] });
      qc.invalidateQueries({ queryKey: ["group"] });
    },
  });

  const setSkillBonus = useMutation({
    mutationFn: async ({ skillKey, bonus }: { skillKey: string; bonus: number }) => {
      const { error } = await supabase
        .from("character_skills")
        .upsert(
          { character_id: characterId, skill_key: skillKey, bonus },
          { onConflict: "character_id,skill_key" },
        );
      if (error) throw error;
    },
    onMutate: ({ skillKey, bonus }) =>
      patchCache((s) => {
        const exists = s.skills.some((sk) => sk.skill_key === skillKey);
        const skills = exists
          ? s.skills.map((sk) => (sk.skill_key === skillKey ? { ...sk, bonus } : sk))
          : [
              ...s.skills,
              {
                id: `temp-${skillKey}`,
                character_id: characterId,
                skill_key: skillKey,
                bonus,
                updated_at: new Date().toISOString(),
              },
            ];
        return { ...s, skills };
      }),
    onError: (e) => {
      onSaveError(e);
      refresh();
    },
  });

  const addWeapon = useMutation({
    mutationFn: async (input: WeaponInput) => {
      const { error } = await supabase
        .from("weapons")
        .insert({ ...input, character_id: characterId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Arma guardada no arsenal.");
      refresh();
    },
    onError: onSaveError,
  });

  const updateWeapon = useMutation({
    mutationFn: async ({ id, ...input }: WeaponInput & { id: string }) => {
      const { error } = await supabase.from("weapons").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: onSaveError,
  });

  const deleteWeapon = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("weapons").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: (id) => patchCache((s) => ({ ...s, weapons: s.weapons.filter((w) => w.id !== id) })),
    onError: (e) => {
      onSaveError(e);
      refresh();
    },
  });

  const addItem = useMutation({
    mutationFn: async (input: BackpackInput) => {
      const { error } = await supabase
        .from("backpack_items")
        .insert({ ...input, character_id: characterId });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: onSaveError,
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<BackpackInput> & { id: string }) => {
      const { error } = await supabase.from("backpack_items").update(patch).eq("id", id);
      if (error) throw error;
    },
    onMutate: ({ id, ...patch }) =>
      patchCache((s) => ({
        ...s,
        backpack: s.backpack.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      })),
    onError: (e) => {
      onSaveError(e);
      refresh();
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("backpack_items").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: (id) =>
      patchCache((s) => ({ ...s, backpack: s.backpack.filter((it) => it.id !== id) })),
    onError: (e) => {
      onSaveError(e);
      refresh();
    },
  });

  return {
    updateCharacter,
    setSkillBonus,
    addWeapon,
    updateWeapon,
    deleteWeapon,
    addItem,
    updateItem,
    deleteItem,
  };
}
