import { describe, expect, it } from "vitest";

import { attackBudget, attackCost, attributeMaxFor, rotateQueue } from "@/lib/progression";

describe("pool de atributos", () => {
  it("nenhum atributo passa de 7", () => {
    expect(attributeMaxFor({ intelecto: 1, psique: 1, fisico: 1, motor: 1 }, "fisico")).toBe(7);
  });
  it("a soma dos 4 não passa de 20", () => {
    expect(attributeMaxFor({ intelecto: 7, psique: 7, fisico: 3, motor: 3 }, "motor")).toBe(3);
    expect(attributeMaxFor({ intelecto: 7, psique: 6, fisico: 3, motor: 3 }, "motor")).toBe(4);
  });
});

describe("orçamento de ataques", () => {
  it("10 pontos, +1 a cada 2 níveis", () => {
    expect(attackBudget(1)).toBe(10);
    expect(attackBudget(2)).toBe(11);
    expect(attackBudget(3)).toBe(11);
    expect(attackBudget(4)).toBe(12);
  });
  it("2d6 corpo a corpo sem extras custa 4", () => {
    const base = {
      damageFormula: "2d6",
      range: 1,
      effectCondition: "none" as const,
      defenseDebuff: 0,
      accuracy: 0,
      diceCount: 2,
      energyCost: 0,
    };
    expect(attackCost(base)).toBe(4);
    expect(attackCost({ ...base, accuracy: 2, effectCondition: "bleeding" })).toBe(8);
  });
});

describe("fila rotativa", () => {
  it("quem age fica no topo e quem agiu vai para o fim", () => {
    const q = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(rotateQueue(q, "b").map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
});
