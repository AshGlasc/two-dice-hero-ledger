import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

type Row = { id?: string | number; character_id?: string | null } | null;

/**
 * Escuta mudanças no banco e atualiza a tela de todo mundo que está com o site aberto.
 * Espera as edições locais terminarem para não "pular" valores enquanto alguém clica.
 */
export function useRealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      if (qc.isMutating() > 0) {
        timer = setTimeout(flush, 400);
        return;
      }
      timer = undefined;
      for (const k of pending) {
        const key = JSON.parse(k) as unknown[];
        qc.invalidateQueries({ queryKey: key });
      }
      pending.clear();
    };

    const queue = (...keys: unknown[][]) => {
      for (const k of keys) pending.add(JSON.stringify(k));
      if (!timer) timer = setTimeout(flush, 250);
    };

    const sheetKey = (row: Row) => (row?.character_id ? ["sheet", row.character_id] : ["sheet"]);

    const channel = supabase
      .channel("fungo-disco-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "characters" }, (p) => {
        const row = (p.new && "id" in p.new ? p.new : p.old) as Row;
        queue(["characters"], ["group"], row?.id ? ["sheet", row.id] : ["sheet"]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "character_skills" }, (p) => {
        const row = (p.new && "character_id" in p.new ? p.new : p.old) as Row;
        queue(["group"], sheetKey(row));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "body_parts" }, (p) => {
        const row = (p.new && "character_id" in p.new ? p.new : p.old) as Row;
        queue(["group"], sheetKey(row));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "weapons" }, (p) => {
        const row = (p.new && "character_id" in p.new ? p.new : p.old) as Row;
        queue(sheetKey(row));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "backpack_items" }, (p) => {
        const row = (p.new && "character_id" in p.new ? p.new : p.old) as Row;
        queue(sheetKey(row));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rolls" }, () =>
        queue(["rolls"]),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "gm_notes" }, () =>
        queue(["gm_notes"]),
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
