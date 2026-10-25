import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useMasterAuth } from "@/context/MasterAuthContext";

import { supabase } from "@/integrations/supabase/client";
import { isLocalRoll } from "@/lib/roll-log";
import type { Roll } from "@/lib/rpg-queries";
import { emitRoll } from "@/lib/roll-burst";
import { shouldAnnounce } from "@/lib/silent-roll";

type Row = { id?: string | number; character_id?: string | null } | null;

/** Aviso grande na tela de todo mundo quando alguém da mesa rola os dados. */
function announceRoll(r: Roll, viewerIsMaster: boolean) {
  if (!shouldAnnounce(r, viewerIsMaster) || isLocalRoll(r)) return;
  emitRoll({
    name: r.character_name,
    label: r.label,
    die1: r.die1,
    die2: r.die2,
    modifier: r.modifier,
    total: r.total,
    difficulty: r.difficulty,
    outcome: r.outcome,
    hidden: r.hidden,
  });
}

/**
 * Escuta mudanças no banco e atualiza a tela de todo mundo que está com o site aberto.
 * Espera as edições locais terminarem para não "pular" valores enquanto alguém clica.
 */
export function useRealtimeSync() {
  const qc = useQueryClient();
  const { isMaster } = useMasterAuth();
  const masterRef = useRef(isMaster);
  masterRef.current = isMaster;

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
        queue(sheetKey(row), ["all_weapons"]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "backpack_items" }, (p) => {
        const row = (p.new && "character_id" in p.new ? p.new : p.old) as Row;
        queue(sheetKey(row));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rolls" }, (p) => {
        if (p.eventType === "INSERT") announceRoll(p.new as Roll, masterRef.current);
        queue(["rolls"]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "gm_notes" }, () =>
        queue(["gm_notes"]),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "monsters" }, () =>
        queue(["monsters"]),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "combatants" }, () =>
        queue(["combat"]),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "combat_state" }, () =>
        queue(["combat"]),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "battle_map" }, () =>
        queue(["battle_map"]),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () =>
        queue(["messages"]),
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
