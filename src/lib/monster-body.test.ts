import { describe, expect, it } from "vitest";

import {
  defaultMonsterBodyParts,
  monsterBodyLabel,
  monsterBodyTargetOptions,
  monsterBodyType,
  MONSTER_BODY_PRESETS,
} from "./monster-body";

describe("monster body presets", () => {
  it("provides complete humanoid and insect presets", () => {
    expect(defaultMonsterBodyParts("human")).toEqual(MONSTER_BODY_PRESETS.human.parts);
    expect(defaultMonsterBodyParts("insect")).toContain("Patas traseiras");
    expect(defaultMonsterBodyParts("insect")).toContain("Abdômen");
  });

  it("keeps custom anatomy empty until its parts are selected", () => {
    expect(defaultMonsterBodyParts("custom")).toEqual([]);
  });

  it("normalizes unknown stored types and labels custom anatomy", () => {
    expect(monsterBodyType("unknown")).toBe("human");
    expect(monsterBodyLabel("custom")).toBe("Personalizado");
  });

  it("maps monster anatomy to valid aimed-attack and armor regions", () => {
    expect(
      monsterBodyTargetOptions(["Cabeça", "Tórax", "Patas dianteiras", "Patas traseiras"]),
    ).toEqual([
      { target: "general", label: "Geral" },
      { target: "head", label: "Cabeça" },
      { target: "torso", label: "Tórax" },
      { target: "left_arm", label: "Patas dianteiras" },
      { target: "left_leg", label: "Patas traseiras" },
    ]);
  });

  it("keeps unfamiliar custom parts selectable without assigning invented modifiers", () => {
    expect(monsterBodyTargetOptions(["Ferrão"])).toEqual([
      { target: "general", label: "Geral · Ferrão" },
    ]);
  });
});
