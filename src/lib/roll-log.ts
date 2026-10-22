import { supabase } from "@/integrations/supabase/client";
import type { RollResult } from "@/lib/skills";

/** Salva a rolagem para aparecer ao vivo no painel do mestre. */
export async function logRolls(
  entries: { characterId: string | null; characterName: string; label: string; result: RollResult }[],
) {
  if (entries.length === 0) return;
  const { error } = await supabase.from("rolls").insert(
    entries.map((e) => ({
      character_id: e.characterId,
      character_name: e.characterName,
      label: e.label,
      die1: e.result.dice[0],
      die2: e.result.dice[1],
      modifier: e.result.modifier,
      total: e.result.total,
      difficulty: e.result.difficulty,
      outcome: e.result.outcome,
    })),
  );
  if (error) console.error(error);
}
