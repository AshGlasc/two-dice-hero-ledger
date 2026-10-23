// Regras de combate do Fungo Disco (funções puras, testadas em combat.test.ts).
import type { GroupData } from "@/lib/rpg-queries";
import { ALL_SKILLS, skillTotal } from "@/lib/skills";

export const CONDITIONS = [
  "Atordoado",
  "Sangrando",
  "Em chamas",
  "Amedrontado",
  "Envenenado",
  "Caído",
  "Cego",
  "Agarrado",
] as const;

/** Skill usada para rolar iniciativa dos jogadores. */
export const INITIATIVE_SKILL = "velocidade_reacao";

export const MONSTER_LIMITS = {
  hp: { min: 1, max: 300 },
  defense: { min: 2, max: 20 },
  attack: { min: 0, max: 20 },
  initiative: { min: 0, max: 20 },
} as const;

type Orderable = { id: string; initiative: number | null; created_at: string };

/** Maior iniciativa primeiro; sem iniciativa vai para o fim; empate = quem entrou antes. */
export function sortByInitiative<T extends Orderable>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.initiative === null && b.initiative === null) return a.created_at.localeCompare(b.created_at);
    if (a.initiative === null) return 1;
    if (b.initiative === null) return -1;
    if (b.initiative !== a.initiative) return b.initiative - a.initiative;
    return a.created_at.localeCompare(b.created_at);
  });
}

type TurnSlot = { id: string; out: boolean };

/**
 * Passa a vez para o próximo na ordem, pulando quem está fora de combate (monstro com 0 PV).
 * Ao voltar para o topo da fila, começa uma nova rodada.
 */
export function nextTurn(order: TurnSlot[], currentId: string | null, round: number) {
  if (order.length === 0) return { currentId: null, round };
  const alive = order.some((s) => !s.out);
  const start = order.findIndex((s) => s.id === currentId);
  if (start === -1) {
    const first = order.find((s) => !s.out) ?? order[0];
    return { currentId: first.id, round };
  }
  let idx = start;
  let nextRound = round;
  for (let i = 0; i < order.length; i++) {
    idx += 1;
    if (idx >= order.length) {
      idx = 0;
      nextRound += 1;
    }
    if (!alive || !order[idx].out) break;
  }
  return { currentId: order[idx].id, round: nextRound };
}

/** Volta a vez para o anterior (sem nunca ir abaixo da rodada 1). */
export function previousTurn(order: TurnSlot[], currentId: string | null, round: number) {
  if (order.length === 0) return { currentId: null, round };
  const alive = order.some((s) => !s.out);
  const start = order.findIndex((s) => s.id === currentId);
  if (start === -1) return { currentId: order[0].id, round };
  let idx = start;
  let prevRound = round;
  for (let i = 0; i < order.length; i++) {
    idx -= 1;
    if (idx < 0) {
      if (prevRound <= 1) return { currentId: order[start].id, round };
      idx = order.length - 1;
      prevRound -= 1;
    }
    if (!alive || !order[idx].out) break;
  }
  return { currentId: order[idx].id, round: prevRound };
}

/** Dano tira PV, cura devolve. Nunca abaixo de 0 nem acima do máximo. */
export function changeHp(current: number, delta: number, max: number) {
  return Math.min(max, Math.max(0, current + delta));
}

/** "Cão", "Cão 2", "Cão 3"… para vários monstros iguais no mesmo combate. */
export function uniqueName(base: string, taken: string[]) {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** Total da skill de um personagem (atributo + pontos extras). */
export function skillValueFor(group: GroupData, characterId: string, skillKey: string) {
  const skill = ALL_SKILLS.find((s) => s.key === skillKey);
  const character = group.characters.find((c) => c.id === characterId);
  if (!skill || !character) return 0;
  const bonus =
    group.skills.find((s) => s.character_id === characterId && s.skill_key === skillKey)?.bonus ?? 0;
  return skillTotal(character[skill.attribute], bonus);
}
