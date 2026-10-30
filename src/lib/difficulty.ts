import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ALL_SKILLS } from "@/lib/skills";

export type DifficultyModifiers = Record<string, number>;

export const appSettingsQuery = queryOptions({
  queryKey: ["app_settings"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
});

export function parseDifficultyModifiers(raw: unknown): DifficultyModifiers {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: DifficultyModifiers = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const num = Number(v);
    if (Number.isFinite(num) && num !== 0) {
      result[k] = num;
    }
  }
  return result;
}

export async function saveDifficultyModifiers(modifiers: DifficultyModifiers) {
  const { error } = await supabase
    .from("app_settings")
    .update({ difficulty_modifiers: modifiers })
    .eq("id", 1);
  if (error) throw error;
}

/**
 * Encontra o atributo principal de uma skill.
 */
export function getAttributeForSkill(skillKey: string): string | null {
  const skill = ALL_SKILLS.find((s) => s.key === skillKey);
  return skill?.attribute ?? null;
}

/**
 * Calcula o bônus de dificuldade adicional imposto pelo mestre.
 */
export function calculateDifficultyBonus(
  modifiers: DifficultyModifiers | null | undefined,
  characterId?: string | null,
  attributeOrSkillKey?: string | null,
): number {
  if (!modifiers) return 0;
  let bonus = 0;

  // 1. Modificador global da mesa
  if (modifiers["global"]) {
    bonus += Number(modifiers["global"]) || 0;
  }

  const attr = attributeOrSkillKey
    ? ["intelecto", "psique", "fisico", "motor"].includes(attributeOrSkillKey)
      ? attributeOrSkillKey
      : getAttributeForSkill(attributeOrSkillKey)
    : null;

  // 2. Modificador para todos os jogadores no atributo específico
  if (attr && modifiers[`all_${attr}`]) {
    bonus += Number(modifiers[`all_${attr}`]) || 0;
  }

  // 3. Modificador para todas as rolagens de um personagem específico
  if (characterId && modifiers[`${characterId}_all`]) {
    bonus += Number(modifiers[`${characterId}_all`]) || 0;
  }

  // 4. Modificador para o personagem no atributo específico
  if (characterId && attr && modifiers[`${characterId}_${attr}`]) {
    bonus += Number(modifiers[`${characterId}_${attr}`]) || 0;
  }

  return bonus;
}

/**
 * Formata o label de exibição do bônus de dificuldade do mestre.
 */
export function formatDifficultyWithMaster(
  baseDifficulty: number | null,
  masterBonus: number,
): string {
  if (baseDifficulty === null) return "Sem dificuldade";
  if (masterBonus > 0) {
    return `${baseDifficulty + masterBonus} (+${masterBonus} Mestre)`;
  }
  if (masterBonus < 0) {
    return `${baseDifficulty + masterBonus} (${masterBonus} Mestre)`;
  }
  return String(baseDifficulty);
}
