import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Monster } from "@/lib/rpg-queries";

type MonsterPatch = Partial<Omit<Monster, "id" | "created_at">>;
const KEY = ["monsters"];

export function useMonsters() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async (monster: Pick<Monster, "name" | "body_type" | "body_parts">) => {
      const { data, error } = await supabase.from("monsters").insert(monster).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (m) => {
      qc.setQueryData<Monster[]>(KEY, (old) => (old ? [...old, m] : [m]));
    },
    onError: (e) => {
      console.error(e);
      toast.error("Não foi possível criar o monstro.");
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: MonsterPatch }) => {
      const { data, error } = await supabase
        .from("monsters")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<Monster[]>(KEY);
      qc.setQueryData<Monster[]>(KEY, (old) =>
        old?.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      );
      return { previous };
    },
    onSuccess: (monster) => {
      qc.setQueryData<Monster[]>(KEY, (old) =>
        old?.map((current) => (current.id === monster.id ? monster : current)),
      );
    },
    onError: (e, _variables, context) => {
      console.error(e);
      toast.error("Não foi possível salvar o monstro.");
      if (context?.previous) qc.setQueryData(KEY, context.previous);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("monsters").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<Monster[]>(KEY);
      qc.setQueryData<Monster[]>(KEY, (old) => old?.filter((m) => m.id !== id));
      return { previous };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["combat"] });
    },
    onError: (e, _id, context) => {
      console.error(e);
      toast.error("Não foi possível apagar o monstro.");
      if (context?.previous) qc.setQueryData(KEY, context.previous);
    },
  });

  return { create, update, remove };
}
