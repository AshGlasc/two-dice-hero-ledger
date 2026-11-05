import { ALL_SKILLS, skillTotal } from "@/lib/skills";

export type SurvivalState = "satisfeito" | "amarelo" | "vermelho";

export const HUNGER_LABELS: Record<SurvivalState, { label: string; badge: string; color: string }> = {
  satisfeito: {
    label: "Satisfeito",
    badge: "Sem fome",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  amarelo: {
    label: "Faminto",
    badge: "Faminto (-1 En, -1 Fís/Mot)",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  vermelho: {
    label: "Desnutrido",
    badge: "Desnutrido (-2 En, -2 Fís/Mot)",
    color: "bg-red-500/15 text-red-400 border-red-500/30",
  },
};

export const THIRST_LABELS: Record<SurvivalState, { label: string; badge: string; color: string }> = {
  satisfeito: {
    label: "Satisfeito",
    badge: "Hidratado",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  amarelo: {
    label: "Com Sede",
    badge: "Com Sede (-1 En, -1 Fís/Mot)",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  vermelho: {
    label: "Desidratado",
    badge: "Desidratado (-2 En, -2 Fís/Mot)",
    color: "bg-red-500/15 text-red-400 border-red-500/30",
  },
};

export function survivalSkillPenalty(
  hungerState: string | undefined | null,
  thirstState: string | undefined | null,
  attributeOrSkillKey: string,
): number {
  const skill = ALL_SKILLS.find((item) => item.key === attributeOrSkillKey);
  const attribute = skill?.attribute ?? attributeOrSkillKey;
  if (attribute !== "fisico" && attribute !== "motor") return 0;

  let penalty = 0;
  if (hungerState === "amarelo") penalty -= 1;
  else if (hungerState === "vermelho") penalty -= 2;

  if (thirstState === "amarelo") penalty -= 1;
  else if (thirstState === "vermelho") penalty -= 2;

  return penalty;
}

export function survivalMaxEnergyPenalty(
  hungerState: string | undefined | null,
  thirstState: string | undefined | null,
): number {
  let penalty = 0;
  if (hungerState === "amarelo") penalty += 1;
  else if (hungerState === "vermelho") penalty += 2;
  if (thirstState === "amarelo") penalty += 1;
  else if (thirstState === "vermelho") penalty += 2;
  return penalty;
}

export function maxEnergyFor(
  character: {
    fisico: number;
    psique: number;
    hunger_state?: string | null;
    thirst_state?: string | null;
  },
  vigorBonus: number,
  willBonus: number,
): number {
  return Math.max(
    1,
    10 +
      2 * skillTotal(character.fisico, vigorBonus) +
      2 * skillTotal(character.psique, willBonus) -
      survivalMaxEnergyPenalty(character.hunger_state, character.thirst_state),
  );
}
