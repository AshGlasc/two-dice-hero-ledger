import type { Weapon } from "@/lib/rpg-queries";
import { ALL_SKILLS, roll2d6, type RollOutcome, type RollResult } from "@/lib/skills";

export type AttackApprovalStatus = "pending" | "approved" | "rejected";

export type EffectCondition =
  | "bleeding"
  | "stunned"
  | "burning"
  | "poisoned"
  | "blind"
  | "fear"
  | "hesitant"
  | "knocked_down"
  | "none";

export const EFFECT_CONDITIONS: { value: EffectCondition; label: string }[] = [
  { value: "none", label: "Nenhum" },
  { value: "bleeding", label: "Sangrando" },
  { value: "stunned", label: "Atordoado" },
  { value: "burning", label: "Em Chamas" },
  { value: "poisoned", label: "Envenenado" },
  { value: "blind", label: "Cego" },
  { value: "fear", label: "Amedrontado" },
  { value: "hesitant", label: "Hesitante" },
  { value: "knocked_down", label: "Derrubado" },
];

export const EFFECT_TO_CONDITION_NAME: Record<Exclude<EffectCondition, "none">, string> = {
  bleeding: "Sangrando",
  stunned: "Atordoado",
  burning: "Em chamas",
  poisoned: "Envenenado",
  blind: "Cego",
  fear: "Amedrontado",
  hesitant: "Hesitante",
  knocked_down: "Caído",
};

export type CustomAttack = {
  id: string;
  ownerId: string;
  ownerType: "character" | "monster";
  name: string;
  skillKey: string;
  turnsCost: number;
  diceCount: number;
  description: string;
  status: AttackApprovalStatus;
  createdAt: string;
  energyCost: number;
  range: number;
  reach: "corpo-a-corpo" | "distancia" | "adjacente" | "area";
  resistanceType: "Defesa" | "Vontade" | "Esquiva";
  damageType: "Físico" | "Mágico" | "Mental" | "Social/Moral";
  durationRounds: number;
  damageFormula: string;
  effectCondition?: EffectCondition;
  defenseDebuff?: number;
};

/** Skills recomendadas ou padrão para combate, embora qualquer skill seja permitida. */
export const COMBAT_SKILLS = [
  {
    key: "ferramenta_fisica",
    name: "Ferramenta Física",
    attribute: "fisico",
    desc: "Força bruta, porrada, armas pesadas",
  },
  {
    key: "coordenacao_motora",
    name: "Coordenação Motora",
    attribute: "motor",
    desc: "Precisão, armas de fogo, arremesso",
  },
  {
    key: "instinto",
    name: "Instinto",
    attribute: "fisico",
    desc: "Reflexos animais, combate selvagem",
  },
  {
    key: "velocidade_reacao",
    name: "Velocidade de Reação",
    attribute: "motor",
    desc: "Golpes rápidos e contra-ataques",
  },
  {
    key: "interacao",
    name: "Interação",
    attribute: "motor",
    desc: "Furtividade, ataques acrobáticos",
  },
  {
    key: "autoridade",
    name: "Autoridade",
    attribute: "psique",
    desc: "Comando intimidador, ataques morais",
  },
  {
    key: "calculo_visual",
    name: "Cálculo Visual",
    attribute: "intelecto",
    desc: "Tiros calculados, trajetórias",
  },
  {
    key: "retorica",
    name: "Retórica",
    attribute: "intelecto",
    desc: "Ataques verbais provocativos",
  },
] as const;

/** Identifica se uma linha da tabela de weapons é na verdade um ataque customizado. */
export function isCustomAttack(w: Weapon): boolean {
  if (w.weapon_type === "custom_attack") return true;
  try {
    const meta = JSON.parse(w.notes);
    return Boolean(meta && meta.is_custom_attack);
  } catch {
    return false;
  }
}

/** Converte uma arma do banco para o modelo de ataque customizado. */
export function parseWeaponToAttack(w: Weapon): CustomAttack {
  let skillKey = "ferramenta_fisica";
  let turnsCost = 1;
  let diceCount = 2;
  let status: AttackApprovalStatus = "pending";
  let description = w.notes || "";
  let effectCondition: EffectCondition | undefined = undefined;
  let defenseDebuff: number | undefined = undefined;
  let energyCost = 0;
  let range = Math.max(1, w.range ?? 1);
  let reach: CustomAttack["reach"] = "corpo-a-corpo";
  let resistanceType: CustomAttack["resistanceType"] = "Defesa";
  let damageType: CustomAttack["damageType"] = "Físico";
  let durationRounds = 1;

  try {
    const meta = JSON.parse(w.notes);
    if (meta) {
      if (meta.skill_key) skillKey = meta.skill_key;
      if (meta.turns_cost != null) turnsCost = Number(meta.turns_cost) || 1;
      if (meta.dice_count != null) diceCount = Number(meta.dice_count) || 2;
      if (meta.status) status = meta.status;
      if (meta.energy_cost != null) energyCost = Math.max(0, Number(meta.energy_cost) || 0);
      if (meta.range != null) range = Math.max(1, Number(meta.range) || 1);
      if (meta.reach) reach = meta.reach;
      if (meta.resistance_type) resistanceType = meta.resistance_type;
      if (meta.damage_type) damageType = meta.damage_type;
      if (meta.duration_rounds != null)
        durationRounds = Math.max(0, Number(meta.duration_rounds) || 0);
      if (meta.description != null) description = meta.description;
      if (meta.effect_condition != null) effectCondition = meta.effect_condition;
      else if (meta.effectCondition != null) effectCondition = meta.effectCondition;
      if (meta.defense_debuff != null) defenseDebuff = Number(meta.defense_debuff) || 0;
      else if (meta.defenseDebuff != null) defenseDebuff = Number(meta.defenseDebuff) || 0;
    }
  } catch {
    // notas não são JSON
  }

  return {
    id: w.id,
    ownerId: w.character_id,
    ownerType: "character",
    name: w.name,
    skillKey,
    turnsCost,
    diceCount,
    description,
    status,
    createdAt: w.created_at,
    energyCost,
    range,
    reach,
    resistanceType,
    damageType,
    durationRounds,
    damageFormula: w.damage ?? `${diceCount}d6`,
    ...(effectCondition !== undefined ? { effectCondition } : {}),
    ...(defenseDebuff !== undefined ? { defenseDebuff } : {}),
  };
}

/** Prepara os campos de weapon para salvar um ataque no banco. */
export function attackToWeaponPayload(attack: {
  name: string;
  skillKey: string;
  turnsCost: number;
  diceCount: number;
  description?: string;
  status?: AttackApprovalStatus;
  effectCondition?: EffectCondition;
  defenseDebuff?: number;
  energyCost?: number;
  range?: number;
  reach?: CustomAttack["reach"];
  resistanceType?: CustomAttack["resistanceType"];
  damageType?: CustomAttack["damageType"];
  durationRounds?: number;
  damageFormula?: string;
}) {
  const status = attack.status ?? "pending";
  const turnsCost = Math.max(1, attack.turnsCost || 1);
  const diceCount = Math.max(1, attack.diceCount || 2);
  const description = (attack.description ?? "").trim();
  const effectCondition =
    attack.effectCondition && attack.effectCondition !== "none" ? attack.effectCondition : "none";
  const defenseDebuff = attack.defenseDebuff && attack.defenseDebuff > 0 ? attack.defenseDebuff : 0;

  const notesPayload = JSON.stringify({
    is_custom_attack: true,
    skill_key: attack.skillKey,
    turns_cost: turnsCost,
    dice_count: diceCount,
    status,
    description,
    effect_condition: effectCondition,
    defense_debuff: defenseDebuff,
    energy_cost: Math.max(0, attack.energyCost ?? 0),
    range: Math.max(1, attack.range ?? 1),
    reach: attack.reach ?? "corpo-a-corpo",
    resistance_type: attack.resistanceType ?? "Defesa",
    damage_type: attack.damageType ?? "Físico",
    duration_rounds: Math.max(0, attack.durationRounds ?? 1),
  });

  return {
    name: attack.name.trim(),
    weapon_type: "custom_attack",
    damage: attack.damageFormula?.trim() || `${diceCount}d6`,
    range: Math.max(1, attack.range ?? 1),
    ammo: `${turnsCost} turno${turnsCost > 1 ? "s" : ""}`,
    notes: notesPayload,
  };
}

/** Converte o campo de texto/JSON de ataques de um monstro em lista de CustomAttack. */
export function parseMonsterAttacks(
  monsterId: string,
  raw: string | null | undefined,
): CustomAttack[] {
  if (!raw || !raw.trim()) return [];

  const trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const list = JSON.parse(trimmed) as Array<Partial<CustomAttack>>;
      if (Array.isArray(list)) {
        return list.map((a, i) => ({
          id: a.id || `monster-${monsterId}-atk-${i}`,
          ownerId: monsterId,
          ownerType: "monster",
          name: a.name || "Ataque",
          skillKey: a.skillKey || "attack_bonus",
          turnsCost: a.turnsCost || 1,
          diceCount: a.diceCount || 2,
          description: a.description || "",
          status: "approved",
          createdAt: a.createdAt || new Date().toISOString(),
          energyCost: a.energyCost ?? 0,
          range: a.range ?? 1,
          reach: a.reach ?? "corpo-a-corpo",
          resistanceType: a.resistanceType ?? "Defesa",
          damageType: a.damageType ?? "Físico",
          durationRounds: a.durationRounds ?? 1,
          damageFormula: a.damageFormula ?? `${a.diceCount ?? 2}d6`,
          ...(a.effectCondition !== undefined ? { effectCondition: a.effectCondition } : {}),
          ...(a.defenseDebuff !== undefined ? { defenseDebuff: a.defenseDebuff } : {}),
        }));
      }
    } catch {
      // continua para fallback
    }
  }

  // Fallback para ataques em formato de texto livre (ex.: "Mordida (2d6+3), Garras (1d6)")
  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, i) => {
      // tenta extrair dados da string
      const matchDice = item.match(/(\d+)d6/i);
      const dice = matchDice ? parseInt(matchDice[1] ?? "2", 10) : 2;
      return {
        id: `legacy-${monsterId}-${i}`,
        ownerId: monsterId,
        ownerType: "monster",
        name: item.replace(/\(.*\)/, "").trim() || item,
        skillKey: "attack_bonus",
        turnsCost: 1,
        diceCount: dice,
        description: item,
        status: "approved",
        createdAt: new Date().toISOString(),
        energyCost: 0,
        range: 1,
        reach: "corpo-a-corpo",
        resistanceType: "Defesa",
        damageType: "Físico",
        durationRounds: 1,
        damageFormula: matchDice?.[0] ?? `${dice}d6`,
      };
    });
}

/** Serializa os ataques do monstro para salvar no campo attacks do banco. */
export function serializeMonsterAttacks(attacks: CustomAttack[]): string {
  return JSON.stringify(attacks);
}

/** Rola um ataque customizado com a quantidade de dados d6 escolhida + bônus da skill. */
export function rollCustomAttack(
  attack: CustomAttack,
  skillBonus: number,
  targetDefense: number | null,
): RollResult {
  const count = Math.max(1, attack.diceCount);
  const dice: number[] = [];
  for (let i = 0; i < count; i++) {
    dice.push(Math.floor(Math.random() * 6) + 1);
  }

  const diceSum = dice.reduce((acc, d) => acc + d, 0);
  const total = diceSum + skillBonus;

  // Crítico nos dois primeiros dados se forem 2d6
  const is2d6 = count === 2;
  const isCritSuccess = is2d6 && dice[0] === 6 && dice[1] === 6;
  const isCritFailure = is2d6 && dice[0] === 1 && dice[1] === 1;

  let outcome: RollOutcome;
  if (isCritSuccess) {
    outcome = "critical-success";
  } else if (isCritFailure) {
    outcome = "critical-failure";
  } else if (targetDefense === null) {
    outcome = "none";
  } else if (total >= targetDefense) {
    outcome = "success";
  } else {
    outcome = "failure";
  }

  return {
    dice: [dice[0] ?? 0, dice[1] ?? 0],
    modifier: skillBonus,
    total,
    difficulty: targetDefense,
    outcome,
  };
}

/** Retorna o nome amigável da skill. */
export function getSkillLabel(key: string): string {
  if (key === "attack_bonus") return "Bônus de Ataque Geral";
  const s = ALL_SKILLS.find((sk) => sk.key === key);
  return s ? `${s.name} (${s.attributeName})` : key;
}
