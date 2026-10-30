import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attackOptionsForCharacter,
  attackOptionsForMonster,
  canMoveThisTurn,
  canMoveTo,
  changeHp,
  conditionPenalty,
  dodges,
  findFreeCell,
  gridDistance,
  intimidationRetreatCell,
  monsterMoveRange,
  moveRangeFor,
  nextTurn,
  playerCombatStats,
  previousTurn,
  rollHit,
  skillValueFor,
  sortByInitiative,
  uniqueName,
} from "@/lib/combat";
import type { GroupData } from "@/lib/rpg-queries";

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

  describe("condições e distância", () => {
    it("acumula a penalidade de Atordoado e Caído", () => {
      expect(conditionPenalty(["Atordoado"])).toBe(2);
      expect(conditionPenalty(["Atordoado", "Caído"])).toBe(4);
      expect(conditionPenalty(["Amedrontado"])).toBe(2);
      expect(conditionPenalty(["Sangrando"])).toBe(0);
    });

    it("mede quadrados contando a diagonal como um quadrado", () => {
      expect(gridDistance(1, 2, 5, 4)).toBe(4);
      expect(gridDistance(2, 2, 4, 4)).toBe(2);
    });
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

  it("intimidação recua uma casa e respeita limites, paredes e ocupação", () => {
    expect(intimidationRetreatCell({ x: 1, y: 1 }, { x: 3, y: 2 }, 6, 6, {}, new Set())).toEqual({
      x: 4,
      y: 3,
    });
    expect(
      intimidationRetreatCell({ x: 1, y: 1 }, { x: 3, y: 2 }, 6, 6, {}, new Set(["4,3"])),
    ).toBeNull();
    expect(intimidationRetreatCell({ x: 1, y: 1 }, { x: 5, y: 5 }, 6, 6, {}, new Set())).toBeNull();
  });
});

describe("jogador entrando no combate", () => {
  it("PV = 8 + 2×Físico e defesa = 7 + Motor", () => {
    expect(playerCombatStats(3, 4)).toEqual({ hp: 14, defense: 11 });
  });
});

describe("esquiva", () => {
  it("anula o ataque quando a esquiva é maior ou igual ao total do ataque", () => {
    expect(dodges(9, 10)).toBe(true);
    expect(dodges(9, 9)).toBe(true);
    expect(dodges(9, 8)).toBe(false);
  });
});

describe("movimento por rodada", () => {
  it("anda 1 vez por rodada em combate; fora de combate não há limite", () => {
    expect(canMoveThisTurn(null, 1, true)).toBe(true);
    expect(canMoveThisTurn(1, 1, true)).toBe(false);
    expect(canMoveThisTurn(1, 2, true)).toBe(true);
    expect(canMoveThisTurn(2, 2, false)).toBe(true);
  });

  it("personagem anda o valor do Motor (mínimo 1)", () => {
    expect(moveRangeFor(4)).toBe(4);
    expect(moveRangeFor(0)).toBe(1);
    expect(moveRangeFor(null)).toBe(1);
  });

  it("monstro sem Motor definido anda 3; com Motor maior que o padrão do banco usa o dele", () => {
    expect(monsterMoveRange(undefined)).toBe(3);
    expect(monsterMoveRange(null)).toBe(3);
    expect(monsterMoveRange(1)).toBe(3);
    expect(monsterMoveRange(5)).toBe(5);
  });
});

describe("rolagem de acerto", () => {
  afterEach(() => vi.restoreAllMocks());

  it("2 dados seguem a regra normal: duplo 6 é crítico", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const r = rollHit(2, 1, 99);
    expect(r.outcome).toBe("critical-success");
    expect(r.total).toBe(13);
  });

  it("3 dados somam tudo e mantêm dado1 + dado2 + modificador = total", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // d6 = 4
    const r = rollHit(3, 2, 14);
    expect(r.total).toBe(14);
    expect(r.dice[0] + r.dice[1] + r.modifier).toBe(r.total);
    expect(r.outcome).toBe("success");
  });
});

describe("menu de ataques", () => {
  const group = {
    characters: [{ id: "ch", fisico: 6, intelecto: 1, psique: 1, motor: 3 }],
    skills: [{ character_id: "ch", skill_key: "ferramenta_fisica", bonus: 1 }],
    backpack: [
      { character_id: "ch", skill_bonuses: { ferramenta_fisica: 2, coordenacao_motora: 1 } },
    ],
    body: [],
    weapons: [
      {
        id: "w1",
        character_id: "ch",
        name: "Revólver",
        weapon_type: "Fogo",
        damage: "1d6+2",
        notes: "",
        skill_key: "coordenacao_motora",
        range: 6,
        uses_current: 4,
        uses_max: 6,
      },
      {
        id: "w2",
        character_id: "ch",
        name: "Golpe Brutal",
        weapon_type: "custom_attack",
        damage: "2d6",
        notes: JSON.stringify({
          is_custom_attack: true,
          skill_key: "ferramenta_fisica",
          dice_count: 3,
          status: "approved",
        }),
        skill_key: "ferramenta_fisica",
        range: 1,
        uses_current: 0,
        uses_max: 0,
      },
      {
        id: "w3",
        character_id: "ch",
        name: "Ainda Pendente",
        weapon_type: "custom_attack",
        damage: "1d6",
        notes: JSON.stringify({ is_custom_attack: true, status: "pending" }),
        skill_key: "ferramenta_fisica",
        range: 1,
        uses_current: 0,
        uses_max: 0,
      },
    ],
  } as unknown as GroupData;

  it("soma pontos extras e bônus de itens da mochila no total da skill", () => {
    // Ferramenta Física: Físico 6 + extra 1 + itens 2
    expect(skillValueFor(group, "ch", "ferramenta_fisica")).toBe(9);
    expect(skillValueFor(group, "ch", "coordenacao_motora")).toBe(4);
  });

  it("aplica −2 nas skills mentais quando a sanidade está crítica", () => {
    const unstable = {
      ...group,
      characters: group.characters.map((character) => ({
        ...character,
        sanity_current: 2,
        sanity_max: 10,
      })),
    } as GroupData;
    expect(skillValueFor(unstable, "ch", "autoridade")).toBe(
      skillValueFor(group, "ch", "autoridade") - 2,
    );
    expect(skillValueFor(unstable, "ch", "ferramenta_fisica")).toBe(
      skillValueFor(group, "ch", "ferramenta_fisica"),
    );
  });

  it("personagem: Soco, Chute, arma ligada e ataque especial aprovado (pendente fica de fora)", () => {
    const options = attackOptionsForCharacter(group, "ch");
    expect(options.map((o) => o.id)).toEqual(["soco", "chute", "w1", "w2"]);
    const soco = options[0]!;
    expect(soco.hitBonus).toBe(9);
    expect(soco.damage).toEqual({ count: 1, sides: 6, bonus: 2 });
    const gun = options.find((o) => o.id === "w1")!;
    expect(gun).toMatchObject({
      kind: "weapon",
      hitBonus: 4,
      range: 6,
      usesCurrent: 4,
      usesMax: 6,
    });
    expect(gun.damage).toEqual({ count: 1, sides: 6, bonus: 2 });
    expect(options.find((o) => o.id === "w2")).toMatchObject({ kind: "custom", hitDice: 3 });
  });

  it("monstro sem ataques cadastrados usa um ataque simples de 1d6", () => {
    const [a] = attackOptionsForMonster("m1", "", 4);
    expect(a).toMatchObject({ hitBonus: 4, hitDice: 2, range: 1 });
    expect(a!.damage).toEqual({ count: 1, sides: 6, bonus: 0 });
  });

  it("monstro com ataques cadastrados lê o dano escrito no texto", () => {
    const options = attackOptionsForMonster("m1", "Mordida (2d6+3), Garras (1d6)", 5);
    expect(options.map((o) => o.name)).toEqual(["Mordida", "Garras"]);
    expect(options[0]!.damage).toEqual({ count: 2, sides: 6, bonus: 3 });
    expect(options[1]!.damage).toEqual({ count: 1, sides: 6, bonus: 0 });
    expect(options.every((o) => o.hitBonus === 5)).toBe(true);
  });
});
