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

/** PV e defesa iniciais de um jogador ao entrar no combate (editáveis depois). */
export function playerCombatStats(fisico: number, motor: number) {
  return { hp: 8 + 2 * fisico, defense: 7 + motor };
}

/** Skills que os jogadores usam para atacar. */
export const ATTACK_SKILLS = [
  { key: "ferramenta_fisica", name: "Ferramenta Física (corpo a corpo)" },
  { key: "coordenacao_motora", name: "Coordenação Motora (à distância)" },
] as const;

// ---------- Mapa de batalha ----------

export const TERRAINS = [
  { key: "wall", name: "Parede", blocks: true },
  { key: "cover", name: "Cobertura", blocks: false },
  { key: "water", name: "Água", blocks: false },
  { key: "grass", name: "Mato", blocks: false },
  { key: "danger", name: "Perigo", blocks: false },
] as const;
export type TerrainKey = (typeof TERRAINS)[number]["key"];
export type Terrain = Record<string, TerrainKey>;

export const MAP_LIMITS = { min: 4, max: 40 } as const;

export const cellKey = (x: number, y: number) => `${x},${y}`;

/** Pode pisar aqui? Dentro do mapa, sem parede e sem outra peça. */
export function canMoveTo(
  x: number,
  y: number,
  cols: number,
  rows: number,
  terrain: Terrain,
  occupied: Set<string>,
) {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
  const t = terrain[cellKey(x, y)];
  if (t && TERRAINS.find((d) => d.key === t)?.blocks) return false;
  return !occupied.has(cellKey(x, y));
}

/** Primeira casa livre: jogadores entram pela esquerda, monstros pela direita. */
export function findFreeCell(
  cols: number,
  rows: number,
  terrain: Terrain,
  occupied: Set<string>,
  side: "left" | "right",
) {
  for (let i = 0; i < cols; i++) {
    const x = side === "left" ? i : cols - 1 - i;
    for (let y = 0; y < rows; y++) if (canMoveTo(x, y, cols, rows, terrain, occupied)) return { x, y };
  }
  return null;
}
