import { describe, expect, it } from "vitest";

import { maxEnergyFor, survivalMaxEnergyPenalty, survivalSkillPenalty } from "@/lib/survival";

describe("regras de fome e sede", () => {
  it("soma a penalidade de energia de cada estado", () => {
    expect(survivalMaxEnergyPenalty("satisfeito", "satisfeito")).toBe(0);
    expect(survivalMaxEnergyPenalty("amarelo", "satisfeito")).toBe(1);
    expect(survivalMaxEnergyPenalty("vermelho", "satisfeito")).toBe(2);
    expect(survivalMaxEnergyPenalty("amarelo", "vermelho")).toBe(3);
  });

  it("aplica penalidade somente a skills físicas e motoras", () => {
    expect(survivalSkillPenalty("amarelo", "satisfeito", "vigor")).toBe(-1);
    expect(survivalSkillPenalty("vermelho", "satisfeito", "coordenacao_motora")).toBe(-2);
    expect(survivalSkillPenalty("amarelo", "vermelho", "ferramenta_fisica")).toBe(-3);
    expect(survivalSkillPenalty("vermelho", "vermelho", "autoridade")).toBe(0);
  });

  it("reduz Energia Máxima por estado e limita o mínimo a um", () => {
    const character = {
      fisico: 1,
      psique: 1,
      hunger_state: "vermelho",
      thirst_state: "satisfeito",
    };
    expect(maxEnergyFor(character, 0, 0)).toBe(12);
    expect(
      maxEnergyFor({ ...character, hunger_state: "vermelho", thirst_state: "vermelho" }, 0, 0),
    ).toBe(10);
    expect(
      maxEnergyFor(
        { fisico: 1, psique: 1, hunger_state: "vermelho", thirst_state: "vermelho" },
        -10,
        -10,
      ),
    ).toBe(1);
  });
});
