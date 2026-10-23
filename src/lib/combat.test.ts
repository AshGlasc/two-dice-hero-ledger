import { describe, expect, it } from "vitest";

import {
  canMoveTo,
  changeHp,
  findFreeCell,
  nextTurn,
  playerCombatStats,
  previousTurn,
  sortByInitiative,
  uniqueName,
} from "@/lib/combat";

const c = (id: string, initiative: number | null, created_at = "2026-01-01T00:00:00Z") => ({
  id,
  initiative,
  created_at,
});

describe("ordem de iniciativa", () => {
  it("maior iniciativa age primeiro e quem não rolou vai para o fim", () => {
    const order = sortByInitiative([c("a", 7), c("b", null), c("c", 12), c("d", 9)]);
    expect(order.map((x) => x.id)).toEqual(["c", "d", "a", "b"]);
  });

  it("empate: quem entrou primeiro no combate age antes", () => {
    const order = sortByInitiative([
      c("depois", 10, "2026-01-01T00:00:02Z"),
      c("antes", 10, "2026-01-01T00:00:01Z"),
    ]);
    expect(order.map((x) => x.id)).toEqual(["antes", "depois"]);
  });
});

describe("turnos", () => {
  const order = [
    { id: "a", out: false },
    { id: "b", out: false },
    { id: "c", out: false },
  ];

  it("passa para o próximo na mesma rodada", () => {
    expect(nextTurn(order, "a", 1)).toEqual({ currentId: "b", round: 1 });
  });

  it("depois do último começa nova rodada", () => {
    expect(nextTurn(order, "c", 1)).toEqual({ currentId: "a", round: 2 });
  });

  it("pula monstro derrotado (0 PV)", () => {
    const withOut = [
      { id: "a", out: false },
      { id: "b", out: true },
      { id: "c", out: false },
    ];
    expect(nextTurn(withOut, "a", 1)).toEqual({ currentId: "c", round: 1 });
  });

  it("voltar não passa da rodada 1", () => {
    expect(previousTurn(order, "a", 1)).toEqual({ currentId: "a", round: 1 });
    expect(previousTurn(order, "a", 2)).toEqual({ currentId: "c", round: 1 });
  });
});

describe("pontos de vida", () => {
  it("dano não deixa abaixo de 0 e cura não passa do máximo", () => {
    expect(changeHp(5, -8, 20)).toBe(0);
    expect(changeHp(18, 5, 20)).toBe(20);
    expect(changeHp(10, -3, 20)).toBe(7);
  });
});

describe("nomes de monstros repetidos", () => {
  it("numera cópias do mesmo monstro", () => {
    expect(uniqueName("Cão", [])).toBe("Cão");
    expect(uniqueName("Cão", ["Cão"])).toBe("Cão 2");
    expect(uniqueName("Cão", ["Cão", "Cão 2"])).toBe("Cão 3");
  });
});

describe("mapa de batalha", () => {
  it("parede e peça bloqueiam a casa; fora do mapa também", () => {
    const occ = new Set(["2,2"]);
    const terrain = { "1,1": "wall" as const, "3,3": "water" as const };
    expect(canMoveTo(1, 1, 5, 5, terrain, occ)).toBe(false);
    expect(canMoveTo(2, 2, 5, 5, terrain, occ)).toBe(false);
    expect(canMoveTo(3, 3, 5, 5, terrain, occ)).toBe(true);
    expect(canMoveTo(5, 0, 5, 5, terrain, occ)).toBe(false);
  });

  it("jogadores entram pela esquerda e monstros pela direita", () => {
    const occ = new Set(["0,0"]);
    expect(findFreeCell(6, 4, {}, occ, "left")).toEqual({ x: 0, y: 1 });
    expect(findFreeCell(6, 4, {}, occ, "right")).toEqual({ x: 5, y: 0 });
  });
});

describe("jogador entrando no combate", () => {
  it("PV = 8 + 2×Físico e defesa = 7 + Motor", () => {
    expect(playerCombatStats(3, 4)).toEqual({ hp: 14, defense: 11 });
  });
});
