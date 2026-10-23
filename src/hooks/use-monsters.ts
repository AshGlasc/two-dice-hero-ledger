import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Monster } from "@/lib/rpg-queries";

type MonsterPatch = Partial<Omit<Monster, "id" | "created_at">>;
const KEY = ["monsters"];

export function useMonsters() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from("monsters").insert({ name }).select().single();
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
      const { error } = await supabase.from("monsters").update(patch).eq("id", id);
      if (error) throw error;
    },
    onMutate: ({ id, patch }) => {
      qc.setQueryData<Monster[]>(KEY, (old) =>
        old?.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      );
    },
    onError: (e) => {
      console.error(e);
      toast.error("Não foi possível salvar o monstro.");
      qc.invalidateQueries({ queryKey: KEY });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("monsters").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: (id) => {
      qc.setQueryData<Monster[]>(KEY, (old) => old?.filter((m) => m.id !== id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["combat"] }),
    onError: (e) => {
      console.error(e);
      toast.error("Não foi possível apagar o monstro.");
      qc.invalidateQueries({ queryKey: KEY });
    },
  });

  return { create, update, remove };
}
