import { describe, expect, it } from "vitest";

import { isSanityCritical, sanityMentalPenalty } from "@/lib/sanity";

describe("sanidade crítica", () => {
  it("uses the absolute and proportional critical thresholds", () => {
    expect(isSanityCritical(2, 10)).toBe(true);
    expect(isSanityCritical(3, 10)).toBe(false);
    expect(isSanityCritical(3, 12)).toBe(true);
    expect(isSanityCritical(8, 10)).toBe(false);
  });

  it("penalizes only mental skills while sanity is critical", () => {
    const character = { sanity_current: 2, sanity_max: 10 };
    expect(sanityMentalPenalty(character, "intelecto")).toBe(-2);
    expect(sanityMentalPenalty(character, "psique")).toBe(-2);
    expect(sanityMentalPenalty(character, "autoridade")).toBe(-2);
    expect(sanityMentalPenalty(character, "fisico")).toBe(0);
    expect(sanityMentalPenalty({ sanity_current: 8, sanity_max: 10 }, "logica")).toBe(0);
  });
});
