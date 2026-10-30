import { supabase } from "@/integrations/supabase/client";
import { emitRoll } from "@/lib/roll-burst";
import { isSilentRoll } from "@/lib/silent-roll";
import type { RollResult } from "@/lib/skills";

// Rolagens feitas nesta aba: não mostramos aviso de novo para quem acabou de rolar.
const localRolls = new Map<string, number>();

function signature(name: string, label: string, d1: number, d2: number, total: number) {
  return `${name}|${label}|${d1}|${d2}|${total}`;
}

export function isLocalRoll(r: {
  character_name: string;
  label: string;
  die1: number;
  die2: number;
  total: number;
}) {
  const now = Date.now();
  for (const [k, exp] of localRolls) if (exp < now) localRolls.delete(k);
  const key = signature(r.character_name, r.label, r.die1, r.die2, r.total);
  if (!localRolls.has(key)) return false;
  localRolls.delete(key);
  return true;
}

/** Salva a rolagem para aparecer ao vivo para todos na mesa (ou só para o mestre, se silenciosa). */
export async function logRolls(
  entries: {
    characterId: string | null;
    characterName: string;
    label: string;
    result: RollResult;
    masterBonus?: number;
  }[],
) {
  if (entries.length === 0) return;
  const hidden = isSilentRoll();
  for (const e of entries) {
    const displayLabel =
      e.masterBonus && e.result.difficulty !== null && !e.label.includes("Mestre")
        ? `${e.label} (Dificuldade ${e.result.difficulty} [${e.masterBonus > 0 ? `+${e.masterBonus}` : e.masterBonus} Mestre])`
        : e.label;

    localRolls.set(
      signature(e.characterName, displayLabel, e.result.dice[0], e.result.dice[1], e.result.total),
      Date.now() + 15000,
    );
    emitRoll({
      name: e.characterName,
      label: displayLabel,
      die1: e.result.dice[0],
      die2: e.result.dice[1],
      modifier: e.result.modifier,
      total: e.result.total,
      difficulty: e.result.difficulty,
      outcome: e.result.outcome,
      hidden,
      ...(e.masterBonus !== undefined ? { masterBonus: e.masterBonus } : {}),
    });
  }
  const { data, error } = await supabase
    .from("rolls")
    .insert(
      entries.map((e) => {
        const displayLabel =
          e.masterBonus && e.result.difficulty !== null && !e.label.includes("Mestre")
            ? `${e.label} (Dificuldade ${e.result.difficulty} [${e.masterBonus > 0 ? `+${e.masterBonus}` : e.masterBonus} Mestre])`
            : e.label;

        return {
          character_id: e.characterId,
          character_name: e.characterName,
          label: displayLabel,
          die1: e.result.dice[0],
          die2: e.result.dice[1],
          modifier: e.result.modifier,
          total: e.result.total,
          difficulty: e.result.difficulty,
          outcome: e.result.outcome,
          hidden,
        };
      }),
    )
    .select("*");
  if (error) {
    console.error(error);
    return;
  }
  if (hidden) return;
  const { postRollToDiscord } = await import("@/lib/discord-webhook");
  for (const r of data ?? []) {
    void postRollToDiscord(r).catch((err: unknown) => console.error("Discord:", err));
  }
}
