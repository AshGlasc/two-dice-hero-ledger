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

export function sanityMentalPenalty(_character: SanityValues, _attributeOrSkillKey: string) {
  // Mecânica de sanidade removida do jogo
  return 0;
}
