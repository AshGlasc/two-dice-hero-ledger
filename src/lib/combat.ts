import {
  isCustomAttack,
  parseMonsterAttacks,
  parseWeaponToAttack,
  type EffectCondition,
} from "@/lib/custom-attacks";
import type { GroupData } from "@/lib/rpg-queries";
import { ALL_SKILLS, rollD6, roll2d6, skillTotal, type RollResult } from "@/lib/skills";
import { sanityMentalPenalty } from "@/lib/sanity";

export const CONDITIONS = [
  "Atordoado",
  "Sangrando",
  "Em chamas",
  "Amedrontado",
  "Envenenado",
  "Caído",
  "Cego",
  "Agarrado",
  "Infectado",
  "Invisível",
] as const;

/** Emoji que aparece no rosto do jogador/monstro para cada efeito. */
export const CONDITION_EMOJI: Record<string, string> = {
  Atordoado: "💫",
  Sangrando: "🩸",
  "Em chamas": "🔥",
  Amedrontado: "😱",
  Envenenado: "🤢",
  Caído: "🛌",
  Cego: "🙈",
  Agarrado: "🪢",
  Infectado: "🍄",
  Invisível: "👻",
};

export const conditionEmoji = (c: string) => CONDITION_EMOJI[c] ?? "❔";

export const MOVEMENT_RANGE = 6;

/** Distância em quadrados, contando diagonais como um quadrado. */
export function gridDistance(fromX: number, fromY: number, toX: number, toY: number) {
  return Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
}

/** Condições mentais e físicas prejudicam ataques e defesas durante o combate. */
export function conditionPenalty(conditions: string[]) {
  return (
    conditions.filter(
      (condition) =>
        condition === "Atordoado" || condition === "Caído" || condition === "Amedrontado",
    ).length * 2
  );
}

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
    if (a.initiative === null && b.initiative === null)
      return a.created_at.localeCompare(b.created_at);
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
    const first = order.find((s) => !s.out) ?? order[0]!;
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
    if (!alive || !order[idx]!.out) break;
  }
  return { currentId: order[idx]!.id, round: nextRound };
}

/** Volta a vez para o anterior (sem nunca ir abaixo da rodada 1). */
export function previousTurn(order: TurnSlot[], currentId: string | null, round: number) {
  if (order.length === 0) return { currentId: null, round };
  const alive = order.some((s) => !s.out);
  const start = order.findIndex((s) => s.id === currentId);
  if (start === -1) return { currentId: order[0]!.id, round };
  let idx = start;
  let prevRound = round;
  for (let i = 0; i < order.length; i++) {
    idx -= 1;
    if (idx < 0) {
      if (prevRound <= 1) return { currentId: order[start]!.id, round };
      idx = order.length - 1;
      prevRound -= 1;
    }
    if (!alive || !order[idx]!.out) break;
  }
  return { currentId: order[idx]!.id, round: prevRound };
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

/** Soma dos bônus que os itens da mochila dão para uma skill. */
export function itemBonusFor(
  items: { character_id: string; skill_bonuses: unknown }[],
  characterId: string,
  skillKey: string,
) {
  let sum = 0;
  for (const it of items) {
    if (it.character_id !== characterId) continue;
    const b = (it.skill_bonuses ?? {}) as Record<string, unknown>;
    const v = Number(b[skillKey]);
    if (Number.isFinite(v)) sum += v;
  }
  return sum;
}

/** Total da skill de um personagem (atributo + pontos extras + itens). */
export function skillValueFor(group: GroupData, characterId: string, skillKey: string) {
  const skill = ALL_SKILLS.find((s) => s.key === skillKey);
  const character = group.characters.find((c) => c.id === characterId);
  if (!skill || !character) return 0;
  const bonus =
    group.skills.find((s) => s.character_id === characterId && s.skill_key === skillKey)?.bonus ??
    0;
  return (
    skillTotal(character[skill.attribute], bonus) +
    itemBonusFor(group.backpack ?? [], characterId, skillKey) +
    sanityMentalPenalty(character, skillKey)
  );
}

// ---------- Ataques, esquiva, armas e movimento ----------

/** Casas que alguém anda por turno = nível de Motor (mínimo 1). */
export const moveRangeFor = (motor: number | null | undefined) => Math.max(1, motor ?? 1);

/** Casas por turno de um monstro sem Motor definido. */
export const MONSTER_DEFAULT_MOVE = 3;

/**
 * Casas por turno de um monstro: o próprio Motor. Monstro sem Motor definido anda
 * MONSTER_DEFAULT_MOVE; o banco cria todo monstro com Motor 1, então 1 conta como "não definido".
 */
export const monsterMoveRange = (motor: number | null | undefined) =>
  motor != null && motor > 1 ? motor : MONSTER_DEFAULT_MOVE;

/** Em combate, cada um anda só uma vez por rodada (`moved_round` guarda a rodada do último passo). */
export function canMoveThisTurn(movedRound: number | null, round: number, combatActive: boolean) {
  return !combatActive || movedRound !== round;
}

/** Defender dá +2 na defesa e na esquiva até o próximo turno. */
export const DEFEND_BONUS = 2;

/** Skill rolada na esquiva. */
export const DODGE_SKILL = "velocidade_reacao";

/** Ataque não crítico que acertou: o alvo desvia se a esquiva for MAIOR OU IGUAL ao ataque. */
export const dodges = (attackTotal: number, dodgeTotal: number) => dodgeTotal >= attackTotal;

/**
 * Rola os d6 do ataque. Com 2 dados vale a regra normal (duplo 6 acerta, duplo 1 erra);
 * outras quantidades não têm crítico. Os dados além dos dois primeiros entram no modificador,
 * assim "dado1 + dado2 + modificador = total" continua valendo no histórico de rolagens.
 */
export function rollHit(hitDice: number, modifier: number, difficulty: number | null): RollResult {
  const count = Math.max(1, Math.floor(hitDice));
  if (count === 2) return roll2d6(modifier, difficulty);
  const dice = Array.from({ length: count }, () => rollD6());
  const extra = dice.slice(2).reduce((sum, d) => sum + d, 0);
  const total = dice.reduce((sum, d) => sum + d, 0) + modifier;
  return {
    dice: [dice[0] ?? 0, dice[1] ?? 0],
    modifier: modifier + extra,
    total,
    difficulty,
    outcome: difficulty === null ? "none" : total >= difficulty ? "success" : "failure",
  };
}

/** "1d6+2" -> 1 dado de 6 lados + 2. Texto inválido vira 1d6. */
export function parseDamage(text: string | null | undefined) {
  const m = (text ?? "").replace(/\s/g, "").match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!m) {
    const flat = Number(text);
    if (text && Number.isFinite(flat) && flat > 0) return { count: 0, sides: 6, bonus: flat };
    return { count: 1, sides: 6, bonus: 0 };
  }
  return {
    count: m[1] ? Number(m[1]) : 1,
    sides: Math.max(2, Number(m[2])),
    bonus: m[3] ? Number(m[3]) : 0,
  };
}

export function rollDamage(d: { count: number; sides: number; bonus: number }, rnd = Math.random) {
  let total = d.bonus;
  for (let i = 0; i < d.count; i++) total += Math.floor(rnd() * d.sides) + 1;
  return Math.max(1, total);
}

/** Arma gasta 1 uso (munição ou durabilidade). usesMax 0 = sem limite. */
export function consumeUse(usesCurrent: number, usesMax: number) {
  if (usesMax <= 0) return { ok: true, next: usesCurrent };
  if (usesCurrent <= 0) return { ok: false, next: 0 };
  return { ok: true, next: usesCurrent - 1 };
}

export type AttackOption = {
  id: string;
  name: string;
  kind: "basic" | "weapon" | "custom";
  /** Bônus para acertar (skill + modificador). */
  hitBonus: number;
  /** Quantos d6 rola para acertar (2 = normal). */
  hitDice: number;
  range: number;
  damage: { count: number; sides: number; bonus: number };
  weaponId?: string;
  usesCurrent?: number;
  usesMax?: number;
  note?: string;
  effectCondition?: EffectCondition;
  defenseDebuff?: number;
};

/** Soco e Chute: todo jogador já começa com eles, baseados no Físico. */
export function basicAttacks(
  fisico: number,
  socoSkill: number,
  chuteSkill: number,
): AttackOption[] {
  const strength = Math.floor(fisico / 3);
  return [
    {
      id: "soco",
      name: "👊 Soco",
      kind: "basic",
      hitBonus: socoSkill,
      hitDice: 2,
      range: 1,
      damage: { count: 1, sides: 6, bonus: strength },
      note: "Ferramenta Física",
    },
    {
      id: "chute",
      name: "🦵 Chute",
      kind: "basic",
      hitBonus: chuteSkill - 1,
      hitDice: 2,
      range: 1,
      damage: { count: 1, sides: 6, bonus: strength + 1 },
      note: "Vigor −1, mais forte",
    },
  ];
}

/**
 * Menu de ataques de um personagem: Soco e Chute (sempre), as armas do arsenal (acerto pela skill
 * ligada à arma, alcance e usos da própria arma) e os ataques especiais já aprovados pelo mestre.
 */
export function attackOptionsForCharacter(group: GroupData, characterId: string): AttackOption[] {
  const character = group.characters.find((c) => c.id === characterId);
  if (!character) return [];
  const options = basicAttacks(
    character.fisico,
    skillValueFor(group, characterId, "ferramenta_fisica"),
    skillValueFor(group, characterId, "vigor"),
  );
  for (const w of group.weapons ?? []) {
    if (w.character_id !== characterId) continue;
    if (isCustomAttack(w)) {
      const attack = parseWeaponToAttack(w);
      if (attack.status !== "approved") continue;
      options.push({
        id: w.id,
        name: `✨ ${attack.name}`,
        kind: "custom",
        hitBonus: skillValueFor(group, characterId, attack.skillKey),
        hitDice: attack.diceCount,
        range: Math.max(1, w.range),
        damage: parseDamage(w.damage),
        note: "Ataque especial",
        ...(attack.effectCondition !== undefined
          ? { effectCondition: attack.effectCondition }
          : {}),
        ...(attack.defenseDebuff !== undefined ? { defenseDebuff: attack.defenseDebuff } : {}),
      });
      continue;
    }
    options.push({
      id: w.id,
      name: w.name,
      kind: "weapon",
      hitBonus: skillValueFor(group, characterId, w.skill_key),
      hitDice: 2,
      range: Math.max(1, w.range),
      damage: parseDamage(w.damage),
      weaponId: w.id,
      usesCurrent: w.uses_current,
      usesMax: w.uses_max,
      ...(w.weapon_type ? { note: w.weapon_type } : {}),
    });
  }
  return options;
}

/** Dano escrito no texto do ataque do monstro ("Mordida (2d6+3)"). */
const DAMAGE_IN_TEXT = /\d*d\d+(?:\s*[+-]\s*\d+)?/i;

/**
 * Menu de ataques de um monstro: os do bestiário (acerto = bônus de ataque do monstro no combate)
 * ou, sem nenhum cadastrado, um ataque simples de 1d6.
 */
export function attackOptionsForMonster(
  monsterId: string | null,
  rawAttacks: string | null | undefined,
  attackBonus: number,
): AttackOption[] {
  const attacks = monsterId ? parseMonsterAttacks(monsterId, rawAttacks) : [];
  if (attacks.length === 0) {
    return [
      {
        id: "ataque",
        name: "⚔️ Ataque",
        kind: "basic",
        hitBonus: attackBonus,
        hitDice: 2,
        range: 1,
        damage: parseDamage(null),
      },
    ];
  }
  return attacks.map((a) => ({
    id: a.id,
    name: a.name,
    kind: "custom" as const,
    hitBonus: attackBonus,
    hitDice: 2,
    range: 1,
    damage: parseDamage(a.description.match(DAMAGE_IN_TEXT)?.[0]),
    ...(a.effectCondition !== undefined ? { effectCondition: a.effectCondition } : {}),
    ...(a.defenseDebuff !== undefined ? { defenseDebuff: a.defenseDebuff } : {}),
  }));
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

export function intimidationRetreatCell(
  attacker: { x: number; y: number },
  target: { x: number; y: number },
  cols: number,
  rows: number,
  terrain: Terrain,
  occupied: Set<string>,
) {
  const dx = Math.sign(target.x - attacker.x);
  const dy = Math.sign(target.y - attacker.y);
  if (dx === 0 && dy === 0) return null;
  const next = { x: target.x + dx, y: target.y + dy };
  return canMoveTo(next.x, next.y, cols, rows, terrain, occupied) ? next : null;
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
    for (let y = 0; y < rows; y++)
      if (canMoveTo(x, y, cols, rows, terrain, occupied)) return { x, y };
  }
  return null;
}

/** Casas cobertas pela névoa (só o mestre enxerga o que tem embaixo). */
export type Fog = Record<string, boolean>;
export type TileImages = Record<string, string>;

export const isFogged = (fog: Fog, x: number, y: number) => Boolean(fog[cellKey(x, y)]);

/** Jogador vê um rosto no mapa? O mestre vê tudo; o jogador sempre vê o próprio. */
export function tokenVisible(
  fog: Fog,
  x: number,
  y: number,
  viewerIsMaster: boolean,
  isMine: boolean,
) {
  return viewerIsMaster || isMine || !isFogged(fog, x, y);
}

/** Cobre (ou revela) o mapa inteiro de névoa. */
export function fillFog(cols: number, rows: number): Fog {
  const out: Fog = {};
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) out[cellKey(x, y)] = true;
  return out;
}
