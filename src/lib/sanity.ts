import { ALL_SKILLS } from "@/lib/skills";

type SanityValues = {
  sanity_current?: number | null;
  sanity_max?: number | null;
};

export type SanityLevel = "stable" | "shaken" | "disturbed" | "insane";

export function sanityLevel(current: number, max: number): SanityLevel {
  const ratio = Math.max(0, current) / Math.max(1, max);
  if (ratio >= 0.75) return "stable";
  if (ratio >= 0.5) return "shaken";
  if (ratio >= 0.25) return "disturbed";
  return "insane";
}

export const SANITY_LEVEL_LABELS: Record<SanityLevel, string> = {
  stable: "Estável",
  shaken: "Abalado",
  disturbed: "Perturbado",
  insane: "Enlouquecido",
};

export function isSanityCritical(current: number, max: number) {
  return current <= 2 || current / Math.max(1, max) <= 0.25;
}

export function sanityMentalPenalty(character: SanityValues, attributeOrSkillKey: string) {
  const skill = ALL_SKILLS.find((item) => item.key === attributeOrSkillKey);
  const attribute = skill?.attribute ?? attributeOrSkillKey;
  const current = character.sanity_current ?? 10;
  const max = character.sanity_max ?? 10;
  if (
    sanityLevel(current, max) === "disturbed" &&
    ["calculo_visual", "coordenacao_motora", "interacao"].includes(attributeOrSkillKey)
  ) {
    return -2;
  }
  if (attribute !== "intelecto" && attribute !== "psique") return 0;
  return isSanityCritical(current, max) ? -2 : 0;
}
