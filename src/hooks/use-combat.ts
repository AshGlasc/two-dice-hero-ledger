import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { CombatData, Combatant, CombatState, GroupData } from "@/lib/rpg-queries";

type CombatantInsert = Database["public"]["Tables"]["combatants"]["Insert"];
type CombatantPatch = Partial<Omit<Combatant, "id">>;
type StatePatch = Partial<Omit<CombatState, "id" | "updated_at">>;

const KEY = ["combat"];

/** Escritas do combate, com a tela atualizando na hora (e para todos via ao vivo). */
export function useCombat() {
  const qc = useQueryClient();

  const patchCache = (fn: (old: CombatData) => CombatData) =>
    qc.setQueryData<CombatData>(KEY, (old) => (old ? fn(old) : old));

  const fail = (msg: string) => (e: unknown) => {
    console.error(e);
    toast.error(msg);
    qc.invalidateQueries({ queryKey: KEY });
  };

  const add = useMutation({
    mutationFn: async (rows: CombatantInsert[]) => {
      const { error } = await supabase.from("combatants").insert(rows);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: fail("Não foi possível adicionar ao combate."),
  });

  const update = useMutation({
    mutationFn: async (v: { id: string; patch: CombatantPatch }[]) => {
      const results = await Promise.all(
        v.map(({ id, patch }) => supabase.from("combatants").update(patch).eq("id", id)),
      );
      for (const r of results) if (r.error) throw r.error;
    },
    onMutate: (v) =>
      patchCache((old) => ({
        ...old,
        combatants: old.combatants.map((c) => {
          const hit = v.find((x) => x.id === c.id);
          return hit ? { ...c, ...hit.patch } : c;
        }),
      })),
    onError: fail("Não foi possível salvar."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("combatants").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: (id) =>
      patchCache((old) => ({
        ...old,
        combatants: old.combatants.filter((c) => c.id !== id),
        state:
          old.state.current_combatant_id === id
            ? { ...old.state, current_combatant_id: null }
            : old.state,
      })),
    onError: fail("Não foi possível remover."),
  });

  /** Gasta munição/durabilidade de uma arma (a ficha do personagem acompanha pelo ao vivo). */
  const spendWeaponUse = useMutation({
    mutationFn: async (v: { id: string; usesCurrent: number }) => {
      const { error } = await supabase
        .from("weapons")
        .update({ uses_current: v.usesCurrent })
        .eq("id", v.id);
      if (error) throw error;
    },
    onMutate: (v) =>
      qc.setQueryData<GroupData>(["group"], (old) =>
        old
          ? {
              ...old,
              weapons: old.weapons.map((w) =>
                w.id === v.id ? { ...w, uses_current: v.usesCurrent } : w,
              ),
            }
          : old,
      ),
    onError: (e) => {
      console.error(e);
      toast.error("Não foi possível gastar a munição da arma.");
      qc.invalidateQueries({ queryKey: ["group"] });
    },
  });

  const setState = useMutation({
    mutationFn: async (patch: StatePatch) => {
      const { error } = await supabase
        .from("combat_state")
        .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onMutate: (patch) => patchCache((old) => ({ ...old, state: { ...old.state, ...patch } })),
    onError: fail("Não foi possível atualizar o combate."),
  });

  const end = useMutation({
    mutationFn: async () => {
      const s = await supabase
        .from("combat_state")
        .upsert({ id: 1, active: false, round: 1, current_combatant_id: null });
      if (s.error) throw s.error;
      const d = await supabase.from("combatants").delete().not("id", "is", null);
      if (d.error) throw d.error;
    },
    onMutate: () =>
      patchCache(() => ({
        combatants: [],
        state: { id: 1, active: false, round: 1, current_combatant_id: null, updated_at: "" },
      })),
    onError: fail("Não foi possível encerrar o combate."),
  });

  return { add, update, remove, spendWeaponUse, setState, end };
}
