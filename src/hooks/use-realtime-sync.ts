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
    typeof value["theater_background_url"] === "string" &&
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

    let waits = 0;
    const flush = () => {
      // Espera edições locais terminarem, mas nunca mais que ~2s (evita mapa "congelado").
      if (qc.isMutating() > 0 && waits < 5) {
        waits += 1;
        timer = setTimeout(flush, 400);
        return;
      }
      waits = 0;
      timer = undefined;
      for (const k of pending) {
        const key = JSON.parse(k) as unknown[];
        qc.invalidateQueries({ queryKey: key });
      }
      pending.clear();
    };

    const queue = (...keys: unknown[][]) => {
      for (const k of keys) pending.add(JSON.stringify(k));
      if (!timer) timer = setTimeout(flush, 120);
    };

    const sheetKey = (row: Row) => (row?.character_id ? ["sheet", row.character_id] : ["sheet"]);

    type Payload = {
      eventType: string;
      new: Record<string, unknown>;
      old: Record<string, unknown>;
    };
    const pick = (p: Payload, field: string) =>
      (p.new && field in p.new ? p.new : p.old) as Row;

    // Um canal por tabela: se uma tabela falhar, as outras continuam ao vivo.
    const handlers: Record<string, (p: Payload) => void> = {
      characters: (p) => {
        const row = pick(p, "id");
        queue(["characters"], ["group"], row?.id ? ["sheet", row.id] : ["sheet"]);
      },
      character_skills: (p) => queue(["group"], sheetKey(pick(p, "character_id"))),
      body_parts: (p) => queue(["group"], sheetKey(pick(p, "character_id"))),
      weapons: (p) => queue(sheetKey(pick(p, "character_id")), ["all_weapons"], ["group"]),
      backpack_items: (p) => queue(sheetKey(pick(p, "character_id")), ["group"]),
      map_layouts: () => queue(["map_layouts"]),
      rolls: (p) => {
        if (p.eventType === "INSERT") {
          const roll = p.new as unknown as Roll;
          announceRoll(roll, masterRef.current, isLocalRoll(roll));
        }
        queue(["rolls"], ["public_rolls"]);
      },
      app_settings: () => queue(["app_settings"]),
      gm_notes: () => queue(["gm_notes"]),
      monsters: () => queue(["monsters"]),
      combatants: () => queue(["combat"]),
      combat_state: () => queue(["combat"]),
      battle_map: (p) => {
        if (p.eventType !== "DELETE" && isBattleMap(p.new)) {
          if (qc.isMutating() > 0) queue(["battle_map"]);
          else qc.setQueryData<BattleMap>(["battle_map"], p.new);
          return;
        }
        queue(["battle_map"]);
      },
      battle_map_items: () => queue(["battle_map_items"]),
      combat_events: () => queue(["combat_events"]),
      messages: (p) => {
        if (p.eventType === "INSERT") notifyMessage(p.new as unknown as Message);
        queue(["messages"]);
      },
      phone_contacts: () => queue(["phone_contacts"]),
      phone_clues: () => queue(["phone_clues"]),
      phone_gallery: () => queue(["phone_gallery"]),
      catalog_items: () => queue(["catalog_items"]),
      whisper_presets: () => queue(["whisper_presets"]),
      sanity_whispers: () => queue(["sanity_whispers"]),
      regional_maps: () => queue(["regional_maps"]),
      regional_map_pins: () => queue(["regional_map_pins"]),
    };

    const suffix = Math.random().toString(36).slice(2);
    let firstConnect = true;
    const channels = Object.entries(handlers).map(([table, handler]) =>
      supabase
        .channel(`mesa-${table}-${suffix}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, (p) =>
          handler(p as unknown as Payload),
        )
        .subscribe((status, error) => {
          if (status === "SUBSCRIBED") {
            // Reconectou (ex.: celular dormiu): puxa os dados dessa parte de novo.
            if (!firstConnect) void qc.invalidateQueries();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error(`A sincronização ao vivo de "${table}" falhou.`, error);
          }
        }),
    );
    // Depois do primeiro conectar, só reconexões disparam recarga geral.
    const firstTimer = setTimeout(() => {
      firstConnect = false;
      void qc.invalidateQueries();
    }, 1500);

    // Celular voltou da tela bloqueada: atualiza na hora.
    const onVisible = () => {
      if (document.visibilityState === "visible") void qc.invalidateQueries();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) clearTimeout(timer);
      clearTimeout(firstTimer);
      document.removeEventListener("visibilitychange", onVisible);
      for (const c of channels) void supabase.removeChannel(c);
    };
  }, [qc]);
}
