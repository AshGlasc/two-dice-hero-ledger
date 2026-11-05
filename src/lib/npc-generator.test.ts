import { describe, expect, it } from "vitest";
import { emptyNpc, rollNpc } from "./npc-generator";

describe("gerador de NPC", () => {
  it("campos travados não mudam ao rolar tudo", () => {
    const first = rollNpc(emptyNpc(), new Set());
    const next = rollNpc(first, new Set(["name", "occupation"]));
    expect(next.name).toBe(first.name);
    expect(next.occupation).toBe(first.occupation);
  });
});
