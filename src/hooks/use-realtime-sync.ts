import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useMasterAuth } from "@/context/MasterAuthContext";
import type { BattleMap } from "@/lib/rpg-queries";

import { supabase } from "@/integrations/supabase/client";
import { isLocalRoll } from "@/lib/roll-log";
import { getPlayerCharacterId } from "@/lib/player-character";
import type { Message, Roll } from "@/lib/rpg-queries";
import { toast } from "sonner";
import { emitRoll } from "@/lib/roll-burst";
import { shouldAnnounce } from "@/lib/silent-roll";
import { formatMoney } from "@/lib/phone";

type Row = { id?: string | number; character_id?: string | null } | null;

function isBattleMap(row: unknown): row is BattleMap {
  if (!row || typeof row !== "object") return false;
  const value = row as Record<string, unknown>;
  return (
    value["id"] === 1 &&
    typeof value["cols"] === "number" &&
    typeof value["rows"] === "number" &&
    typeof value["background_url"] === "string" &&
    typeof value["updated_at"] === "string" &&
    typeof value["terrain"] === "object" &&
    value["terrain"] !== null &&
    typeof value["tile_images"] === "object" &&
    value["tile_images"] !== null &&
    typeof value["fog"] === "object" &&
    value["fog"] !== null
  );
}

/** Aviso grande na tela de todo mundo quando alguém da mesa rola os dados. */
function announceRoll(r: Roll, viewerIsMaster: boolean, local: boolean) {
  if (!shouldAnnounce(r, viewerIsMaster) || local) return;
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

/** Aviso no topo quando chega mensagem ou transferência para o personagem deste aparelho. */
function notifyMessage(m: Message) {
  const me = getPlayerCharacterId();
  if (!me || m.from_character_id === me) return;
  if (m.kind === "pix" && m.to_character_id === me) {
    toast.success(`💴 ${m.from_name} te enviou ${formatMoney(m.amount ?? 0)}`);
  } else if (m.to_character_id === me || m.to_character_id === null) {
    toast(`📱 ${m.from_name || "Desconhecido"}: ${m.body.slice(0, 80)}`);
  }
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
      .channel(`mesa-sync-${Math.random().toString(36).slice(2)}`)
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
        if (p.eventType === "INSERT") {
          const roll = p.new as Roll;
          const local = isLocalRoll(roll);
          announceRoll(roll, masterRef.current, local);
        }
        queue(["rolls"], ["public_rolls"]);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "battle_map" }, (p) => {
        if (p.eventType !== "DELETE" && isBattleMap(p.new)) {
          if (qc.isMutating() > 0) queue(["battle_map"]);
          else qc.setQueryData<BattleMap>(["battle_map"], p.new);
          return;
        }
        queue(["battle_map"]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (p) => {
        if (p.eventType === "INSERT") notifyMessage(p.new as Message);
        queue(["messages"], ["characters"], ["group"]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "phone_contacts" }, () =>
        queue(["phone_contacts"]),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "phone_clues" }, () =>
        queue(["phone_clues"]),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "phone_gallery" }, () =>
        queue(["phone_gallery"]),
      )
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          queue(["battle_map"]);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("A sincronização em tempo real do mapa falhou.", error);
          toast.error("O mapa pode não estar sincronizando. Verifique sua conexão.");
        }
      });

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
