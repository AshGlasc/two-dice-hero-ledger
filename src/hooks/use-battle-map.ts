import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { BattleMap } from "@/lib/rpg-queries";

type MapPatch = Partial<Pick<BattleMap, "cols" | "rows" | "background_url" | "terrain" | "tile_images" | "fog">>;
const KEY = ["battle_map"];

export function useBattleMap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: MapPatch) => {
      const { error } = await supabase
        .from("battle_map")
        .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onMutate: (patch) => qc.setQueryData<BattleMap>(KEY, (old) => (old ? { ...old, ...patch } : old)),
    onError: (e) => {
      console.error(e);
      toast.error("Não foi possível salvar o mapa.");
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
