// Atributos e skills do sistema (estilo Disco Elysium).
// Para adicionar um novo atributo: crie a coluna em `characters` e adicione
// uma entrada em ATTRIBUTES com suas skills.

export type SkillDef = {
  key: string;
  name: string;
  description: string;
};

export type AttributeKey = "intelecto";

export type AttributeDef = {
  key: AttributeKey;
  name: string;
  skills: SkillDef[];
};

export const ATTRIBUTES: AttributeDef[] = [
  {
    key: "intelecto",
    name: "Intelecto",
    skills: [
      {
        key: "logica",
        name: "Lógica",
        description:
          "Desmontar mentiras, achar furos em argumentos e montar o mundo de forma lógica.",
      },
      {
        key: "enciclopedia",
        name: "Enciclopédia",
        description:
          "Tudo que você decorou na vida. Datas, capitais, músicas, fatos inúteis que de repente se tornam úteis em certas situações.",
      },
      {
        key: "retorica",
        name: "Retórica",
        description:
          "A arte de discutir. Debater, persuadir e fazer as pessoas acreditarem no que você está dizendo, mesmo às vezes sem ter razão.",
      },
      {
        key: "drama",
        name: "Drama",
        description: "Mentir, atuar e detectar mentiras.",
      },
      {
        key: "conceptualizacao",
        name: "Conceptualização",
        description:
          "Ver a arte nas coisas. Criatividade, entender conceitos abstratos e resolver enigmas.",
      },
      {
        key: "calculo_visual",
        name: "Cálculo Visual",
        description:
          "Reconstruir cenas na sua cabeça. Geometria, trajetórias, o que aconteceu aqui baseado nos vestígios.",
      },
    ],
  },
];

export const ATTRIBUTE_MIN = 1;
export const ATTRIBUTE_MAX = 10;
export const BONUS_MIN = 0;
export const BONUS_MAX = 20;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Pontos base da skill = valor do atributo principal. Total = base + pontos extras. */
export function skillTotal(attributeValue: number, bonus: number) {
  return attributeValue + bonus;
}

export const DIFFICULTIES = [
  { name: "Trivial", value: 6 },
  { name: "Fácil", value: 8 },
  { name: "Médio", value: 10 },
  { name: "Desafiador", value: 12 },
  { name: "Formidável", value: 13 },
  { name: "Lendário", value: 14 },
  { name: "Heroico", value: 15 },
  { name: "Divino", value: 16 },
  { name: "Impossível", value: 18 },
] as const;

export type RollOutcome = "critical-success" | "critical-failure" | "success" | "failure" | "none";

export type RollResult = {
  dice: [number, number];
  modifier: number;
  total: number;
  difficulty: number | null;
  outcome: RollOutcome;
};

/** 2d6 + pontos da skill. Duplo 6 sempre passa, duplo 1 sempre falha. */
export function resolveRoll(
  dice: [number, number],
  modifier: number,
  difficulty: number | null,
): RollResult {
  const total = dice[0] + dice[1] + modifier;
  let outcome: RollOutcome = "none";
  if (dice[0] === 6 && dice[1] === 6) outcome = "critical-success";
  else if (dice[0] === 1 && dice[1] === 1) outcome = "critical-failure";
  else if (difficulty !== null) outcome = total >= difficulty ? "success" : "failure";
  return { dice, modifier, total, difficulty, outcome };
}

export function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

export function roll2d6(modifier: number, difficulty: number | null) {
  return resolveRoll([rollD6(), rollD6()], modifier, difficulty);
}
