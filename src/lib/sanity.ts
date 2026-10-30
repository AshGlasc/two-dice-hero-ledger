import { ALL_SKILLS } from "@/lib/skills";

type SanityValues = {
  sanity_current?: number | null;
  sanity_max?: number | null;
};

export function isSanityCritical(current: number, max: number) {
  return current <= 2 || current / Math.max(1, max) <= 0.25;
}

export function sanityMentalPenalty(character: SanityValues, attributeOrSkillKey: string) {
  const skill = ALL_SKILLS.find((item) => item.key === attributeOrSkillKey);
  const attribute = skill?.attribute ?? attributeOrSkillKey;
  if (attribute !== "intelecto" && attribute !== "psique") return 0;
  return isSanityCritical(character.sanity_current ?? 10, character.sanity_max ?? 10) ? -2 : 0;
}
