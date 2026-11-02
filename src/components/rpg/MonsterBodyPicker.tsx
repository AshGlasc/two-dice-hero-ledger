import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  defaultMonsterBodyParts,
  MONSTER_BODY_PART_OPTIONS,
  MONSTER_BODY_PRESETS,
  monsterBodyType,
  type MonsterBodyType,
} from "@/lib/monster-body";

type Props = {
  bodyType: string;
  bodyParts: string[];
  onChange: (bodyType: MonsterBodyType, bodyParts: string[]) => void;
};

const BODY_TYPES: MonsterBodyType[] = ["human", "insect", "custom"];
const KNOWN_PARTS = new Set<string>(MONSTER_BODY_PART_OPTIONS);

export function MonsterBodyPicker({ bodyType, bodyParts, onChange }: Props) {
  const [customPart, setCustomPart] = useState("");
  const selectedType = monsterBodyType(bodyType);

  const chooseType = (type: MonsterBodyType) => {
    if (type === selectedType) return;
    onChange(type, type === "custom" ? bodyParts : defaultMonsterBodyParts(type));
  };

  const togglePart = (part: string) => {
    const updated = bodyParts.includes(part)
      ? bodyParts.filter((current) => current !== part)
      : [...bodyParts, part];
    onChange(selectedType, updated);
  };

  const addCustomPart = () => {
    const part = customPart.trim();
    if (!part || bodyParts.some((current) => current.toLowerCase() === part.toLowerCase())) {
      return;
    }
    onChange(selectedType, [...bodyParts, part]);
    setCustomPart("");
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {BODY_TYPES.map((type) => {
          const label = type === "custom" ? "Personalizado" : MONSTER_BODY_PRESETS[type].label;
          const description =
            type === "custom"
              ? "Monte as partes como quiser."
              : MONSTER_BODY_PRESETS[type].description;
          return (
            <button
              key={type}
              type="button"
              aria-pressed={selectedType === type}
              onClick={() => chooseType(type)}
              className={`rounded-md border p-3 text-left transition-colors ${
                selectedType === type
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <span className="block font-semibold">{label}</span>
              <span className="text-xs text-muted-foreground">{description}</span>
            </button>
          );
        })}
      </div>
      <div>
        <p className="label-caps mb-2 text-muted-foreground">Partes do corpo</p>
        <div className="flex flex-wrap gap-2">
          {MONSTER_BODY_PART_OPTIONS.map((part) => {
            const selected = bodyParts.includes(part);
            return (
              <button
                key={part}
                type="button"
                aria-pressed={selected}
                onClick={() => togglePart(part)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {part}
              </button>
            );
          })}
          {bodyParts
            .filter((part) => !KNOWN_PARTS.has(part))
            .map((part) => (
              <button
                key={part}
                type="button"
                aria-pressed="true"
                onClick={() => togglePart(part)}
                className="rounded-full border border-primary bg-primary/10 px-3 py-1 text-sm"
              >
                {part} ×
              </button>
            ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          value={customPart}
          onChange={(event) => setCustomPart(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addCustomPart();
            }
          }}
          placeholder="Adicionar parte, ex.: ferrão"
          aria-label="Nova parte do corpo"
        />
        <Button
          type="button"
          variant="outline"
          disabled={!customPart.trim()}
          onClick={addCustomPart}
        >
          Adicionar
        </Button>
      </div>
    </div>
  );
}
