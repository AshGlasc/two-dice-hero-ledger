import { describe, expect, it } from "vitest";

import { resolveRoll, skillTotal } from "./skills";

describe("skills", () => {
  it("base da subskill é igual ao atributo, somando pontos extras", () => {
    expect(skillTotal(3, 0)).toBe(3);
    expect(skillTotal(3, 2)).toBe(5);
  });

  it("rolagem soma 2d6 com os pontos da skill", () => {
    expect(resolveRoll([2, 3], 4, null).total).toBe(9);
  });

  it("passa quando o total alcança a dificuldade", () => {
    expect(resolveRoll([4, 4], 2, 10).outcome).toBe("success");
    expect(resolveRoll([4, 3], 2, 10).outcome).toBe("failure");
  });

  it("duplo 6 sempre passa e duplo 1 sempre falha", () => {
    expect(resolveRoll([6, 6], 0, 18).outcome).toBe("critical-success");
    expect(resolveRoll([1, 1], 20, 6).outcome).toBe("critical-failure");
  });
});
