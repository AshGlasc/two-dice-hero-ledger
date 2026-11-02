import type { BodyTarget } from "@/lib/combat";

export type MonsterBodyType = "human" | "insect" | "custom";

export const MONSTER_BODY_PRESETS: Record<
  Exclude<MonsterBodyType, "custom">,
  { label: string; description: string; parts: string[] }
> = {
  human: {
    label: "Humanoide",
    description: "Cabeça, tronco e quatro membros.",
    parts: [
      "Cabeça",
      "Tronco",
      "Braço esquerdo",
      "Braço direito",
      "Perna esquerda",
      "Perna direita",
    ],
  },
  insect: {
    label: "Inseto",
    description: "Exoesqueleto, antenas, asas e múltiplas patas.",
    parts: [
      "Cabeça",
      "Tórax",
      "Abdômen",
      "Mandíbulas",
      "Antenas",
      "Asas",
      "Patas dianteiras",
      "Patas traseiras",
    ],
  },
};

export const MONSTER_BODY_PART_OPTIONS = [
  "Cabeça",
  "Tronco",
  "Tórax",
  "Abdômen",
  "Braço esquerdo",
  "Braço direito",
  "Perna esquerda",
  "Perna direita",
  "Mandíbulas",
  "Antenas",
  "Asas",
  "Patas dianteiras",
  "Patas traseiras",
  "Cauda",
  "Tentáculos",
] as const;

export function monsterBodyType(value: string): MonsterBodyType {
  return value === "insect" || value === "custom" ? value : "human";
}

export function monsterBodyLabel(value: string) {
  const type = monsterBodyType(value);
  return type === "custom" ? "Personalizado" : MONSTER_BODY_PRESETS[type].label;
}

export function defaultMonsterBodyParts(type: MonsterBodyType) {
  return type === "custom" ? [] : [...MONSTER_BODY_PRESETS[type].parts];
}

export function monsterBodyTargetOptions(parts: string[]) {
  const mapped = new Map<BodyTarget, string[]>();

  for (const part of parts) {
    const normalized = part
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    let target: BodyTarget = "general";

    if (/\b(cabeca|cranio|antenas?|mandibulas?|olhos?|focinho)\b/.test(normalized)) {
      target = "head";
    } else if (/\b(braco esquerdo|membro esquerdo)\b/.test(normalized)) {
      target = "left_arm";
    } else if (/\b(braco direito|membro direito)\b/.test(normalized)) {
      target = "right_arm";
    } else if (/\b(perna esquerda)\b/.test(normalized)) {
      target = "left_leg";
    } else if (/\b(perna direita)\b/.test(normalized)) {
      target = "right_leg";
    } else if (/\b(asa|asas|braco|bracos|pata dianteira|patas dianteiras)\b/.test(normalized)) {
      target = "left_arm";
    } else if (/\b(perna|pernas|pata|patas|cauda)\b/.test(normalized)) {
      target = "left_leg";
    } else if (/\b(tronco|torso|peito|torax|abdomen|carapaca)\b/.test(normalized)) {
      target = "torso";
    }

    const labels = mapped.get(target) ?? [];
    if (!labels.includes(part)) labels.push(part);
    mapped.set(target, labels);
  }

  const generalParts = mapped.get("general") ?? [];
  return [
    {
      target: "general" as const,
      label: generalParts.length ? `Geral · ${generalParts.join(" / ")}` : "Geral",
    },
    ...Array.from(mapped)
      .filter(([target]) => target !== "general")
      .map(([target, labels]) => ({ target, label: labels.join(" / ") })),
  ];
}
