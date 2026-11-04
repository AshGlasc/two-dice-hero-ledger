import { describe, expect, it } from "vitest";
import {
  levelDamageBonus,
  mentalReduction,
  painReduction,
  parseChestItems,
  passesPassive,
  removeChestEntry,
} from "./passives";

describe("passivas", () => {
  it("passiva = 6 + skill contra a dificuldade", () => {
    expect(passesPassive(4, 10)).toBe(true);
    expect(passesPassive(3, 10)).toBe(false);
  });
  it("Limiar da Dor reduz dano físico", () => {
    expect(painReduction(3)).toBe(0);
    expect(painReduction(4)).toBe(1);
    expect(painReduction(8)).toBe(2);
  });
  it("defesa mental usa a melhor entre Vontade e Compostura", () => {
    expect(mentalReduction(2, 5)).toBe(1);
  });
});

describe("evolução por nível", () => {
  it("+1 de dano a cada 2 níveis", () => {
    expect(levelDamageBonus(1)).toBe(0);
    expect(levelDamageBonus(2)).toBe(1);
    expect(levelDamageBonus(3)).toBe(1);
    expect(levelDamageBonus(4)).toBe(2);
  });
});

describe("baús", () => {
  it("lê e remove itens do baú", () => {
    const list = parseChestItems([
      { uid: "a", catalog_item_id: "x", name: "Faca" },
      { bad: true },
    ]);
    expect(list).toHaveLength(1);
    expect(removeChestEntry(list, "a")).toHaveLength(0);
  });
});
