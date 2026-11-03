// Regras de progressão: pool de atributos, orçamento de ataques e fila de turnos.
import { parseDamage } from "@/lib/combat";
import type { EffectCondition } from "@/lib/custom-attacks";
import type { AttributeKey } from "@/lib/skills";

/** Os 4 atributos dividem 20 pontos; nenhum passa de 7. */
export const ATTRIBUTE_POOL = 20;
export const PLAYER_ATTRIBUTE_MAX = 7;

export type AttributeValues = Record<AttributeKey, number>;

export const attributePoolUsed = (a: AttributeValues) =>
  a.intelecto + a.psique + a.fisico + a.motor;

/** Maior valor permitido para `key` respeitando o teto de 7 e o pool de 20. */
export function attributeMaxFor(a: AttributeValues, key: AttributeKey) {
  const free = ATTRIBUTE_POOL - attributePoolUsed(a);
  return Math.min(PLAYER_ATTRIBUTE_MAX, a[key] + Math.max(0, free));
}

/** Orçamento de ataque: 10 pontos, +1 a cada 2 níveis (nível 2 = 11, nível 4 = 12). */
export function attackBudget(level: number) {
  return 10 + Math.floor(Math.max(1, level) / 2);
}

const STRONG_EFFECTS: EffectCondition[] = ["stunned", "blind", "knocked_down"];

export type AttackCostInput = {
  damageFormula: string;
  range: number;
  effectCondition: EffectCondition;
  defenseDebuff: number;
  accuracy: number;
  diceCount: number;
  energyCost: number;
  reach?: string;
};

/** Quanto cada parte do ataque custa no orçamento. */
export function attackCostBreakdown(a: AttackCostInput) {
  const d = parseDamage(a.damageFormula);
  const avg = d.count * ((d.sides + 1) / 2) + d.bonus;
  const damage = Math.max(1, Math.ceil(avg / 1.75));
  const range = a.range <= 1 ? 0 : a.range <= 3 ? 2 : 4 + Math.floor((a.range - 4) / 2);
  const effect =
    a.effectCondition === "none" ? 0 : STRONG_EFFECTS.includes(a.effectCondition) ? 4 : 2;
  const debuff = Math.max(0, a.defenseDebuff);
  const accuracy = Math.max(0, a.accuracy) + Math.max(0, a.diceCount - 2) * 2;
  const area = a.reach === "area" ? 2 : 0;
  const discount = -Math.min(4, Math.max(0, a.energyCost));
  return { damage, range, effect, debuff, accuracy, area, discount };
}

export function attackCost(a: AttackCostInput) {
  return Object.values(attackCostBreakdown(a)).reduce((s, v) => s + v, 0);
}

/** Fila rotativa: quem age fica no topo; quem já agiu vai para o fim. */
export function rotateQueue<T extends { id: string }>(order: T[], currentId: string | null) {
  const i = order.findIndex((x) => x.id === currentId);
  if (i <= 0) return order;
  return [...order.slice(i), ...order.slice(0, i)];
}
