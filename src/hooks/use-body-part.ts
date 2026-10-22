import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { sheetQueryKey, type BodyPart, type CharacterSheet, type GroupData } from "@/lib/rpg-queries";

function upsertLocal(list: BodyPart[], characterId: string, partKey: string, state: number) {
  const exists = list.some((b) => b.character_id === characterId && b.part_key === partKey);
  if (exists) {
    return list.map((b) =>
      b.character_id === characterId && b.part_key === partKey ? { ...b, state } : b,
    );
  }
  return [
    ...list,
    {
      id: `temp-${characterId}-${partKey}`,
      character_id: characterId,
      part_key: partKey,
      state,
      updated_at: new Date().toISOString(),
    },
  ];
}

/** Salva o estado de um membro e atualiza a ficha e o painel do mestre na hora. */
export function useBodyPart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { characterId: string; partKey: string; state: number }[]) => {
      const { error } = await supabase.from("body_parts").upsert(
        v.map((p) => ({ character_id: p.characterId, part_key: p.partKey, state: p.state })),
        { onConflict: "character_id,part_key" },
      );
      if (error) throw error;
    },
    onMutate: (v) => {
      for (const { characterId, partKey, state } of v) {
        qc.setQueryData<CharacterSheet | null>(sheetQueryKey(characterId), (old) =>
          old ? { ...old, body: upsertLocal(old.body, characterId, partKey, state) } : old,
        );
        qc.setQueryData<GroupData>(["group"], (old) =>
          old ? { ...old, body: upsertLocal(old.body, characterId, partKey, state) } : old,
        );
      }
    },
    onError: (e) => {
      console.error(e);
      toast.error("Não foi possível salvar o estado do corpo.");
      qc.invalidateQueries({ queryKey: ["sheet"] });
      qc.invalidateQueries({ queryKey: ["group"] });
    },
  });
}
