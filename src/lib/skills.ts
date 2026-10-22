// Atributos e skills do sistema (estilo Disco Elysium).
// Para adicionar um novo atributo: crie a coluna em `characters` e adicione
// uma entrada em ATTRIBUTES com suas skills.

export type SkillDef = {
  key: string;
  name: string;
  description: string;
};

export type AttributeKey = "intelecto" | "psique" | "fisico" | "motor";

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
      { key: "drama", name: "Drama", description: "Mentir, atuar e detectar mentiras." },
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
  {
    key: "psique",
    name: "Psique",
    skills: [
      { key: "vontade", name: "Vontade", description: "O que mantém sua moral e sanidade de pé." },
      {
        key: "imperio_interior",
        name: "Império Interior",
        description:
          "Palpites e intuição quase sobrenatural, a realidade se revela em forma de sonho e visão.",
      },
      {
        key: "empatia",
        name: "Empatia",
        description: "Sinta pelos outros, faça os outros sentirem o que você sente.",
      },
      {
        key: "autoridade",
        name: "Autoridade",
        description: "Se mostre capaz, seja respeitado e temido.",
      },
      {
        key: "tecnica",
        name: "Técnica",
        description: "O quão bem você conhece e executa suas ideias.",
      },
      {
        key: "sugestao",
        name: "Sugestão",
        description:
          "O quão bem você manipula as pessoas e o quão difícil é você ser manipulado.",
      },
    ],
  },
  {
    key: "fisico",
    name: "Físico",
    skills: [
      {
        key: "vigor",
        name: "Vigor",
        description:
          "O quanto você aguenta fisicamente. Resistência a venenos, porradas e desgastes.",
      },
      {
        key: "limiar_dor",
        name: "Limiar da Dor",
        description:
          "O quanto você resiste a dores, desconfortos e continua de pé mesmo quando deveria cair.",
      },
      {
        key: "eletroquimica",
        name: "Eletroquímica",
        description:
          "O quanto você consegue lidar com vícios, desejos e impulsos químicos do seu próprio corpo.",
      },
      {
        key: "instinto",
        name: "Instinto",
        description: "Sua agressividade primitiva. Luta, paranoia, fuga e sobrevivência.",
      },
      {
        key: "calafrios",
        name: "Calafrios",
        description:
          "Perceber o mundo através do corpo. O mundo conversa com você através do físico.",
      },
      {
        key: "ferramenta_fisica",
        name: "Ferramenta Física",
        description: "O quão forte, intimidador e musculoso você é. Força bruta pura.",
      },
    ],
  },
  {
    key: "motor",
    name: "Motor",
    skills: [
      {
        key: "coordenacao_motora",
        name: "Coordenação Motora",
        description:
          "Sua habilidade motora. Precisão com armas, pegar objetos no ar, etc.",
      },
      {
        key: "velocidade_reacao",
        name: "Velocidade de Reação",
        description:
          "O quão rápido você percebe o mundo à sua volta. Desviar de socos, entender situações num piscar de olhos.",
      },
      {
        key: "percepcao",
        name: "Percepção",
        description:
          "O quão bem seus sentidos são treinados. Ver, ouvir e cheirar o que os outros deixam passar.",
      },
      {
        key: "interacao",
        name: "Interação",
        description:
          "Sua habilidade com acrobacias, furtividade e movimentos difíceis. Seu corpo sabe onde se esconder.",
      },
      {
        key: "compostura",
        name: "Compostura",
        description:
          "Conseguir agir normalmente sob situações difíceis. Não se deixar abalar, manter a pose.",
      },
      {
        key: "mao_leve",
        name: "Mão Leve",
        description:
          "Habilidade em abrir cadeados, hackear computadores, fazer movimentos delicados, revirar lixo e etc.",
      },
    ],
  },
];

export const ALL_SKILLS = ATTRIBUTES.flatMap((a) =>
  a.skills.map((s) => ({ ...s, attribute: a.key, attributeName: a.name })),
);

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

export const OUTCOME_TEXT: Record<RollOutcome, string> = {
  "critical-success": "Sucesso crítico",
  "critical-failure": "Falha crítica",
  success: "Sucesso",
  failure: "Falha",
  none: "Resultado",
};

export const OUTCOME_CLASS: Record<RollOutcome, string> = {
  "critical-success": "text-success",
  success: "text-success",
  "critical-failure": "text-destructive",
  failure: "text-destructive",
  none: "text-muted-foreground",
};

// ---- Corpo ----

export const BODY_PARTS = [
  { key: "cabeca", name: "Cabeça" },
  { key: "tronco", name: "Tronco" },
  { key: "braco_dir", name: "Braço direito" },
  { key: "braco_esq", name: "Braço esquerdo" },
  { key: "perna_dir", name: "Perna direita" },
  { key: "perna_esq", name: "Perna esquerda" },
] as const;

export type BodyPartKey = (typeof BODY_PARTS)[number]["key"];

/** 0 = normal, 1 = ferido (amarelo), 2 = grave (vermelho). */
export const BODY_STATES = ["Normal", "Ferido", "Grave"] as const;

/** Clique: normal → amarelo → vermelho → normal. */
export function nextBodyState(state: number) {
  return (state + 1) % 3;
}
