import { describe, expect, it } from "vitest";

import {
  isSanityCritical,
  sanityLevel,
  sanityMentalPenalty,
  SANITY_LEVEL_LABELS,
} from "@/lib/sanity";

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

  it("classifies each threshold and penalizes precision skills while disturbed", () => {
    expect(sanityLevel(75, 100)).toBe("stable");
    expect(sanityLevel(74, 100)).toBe("shaken");
    expect(sanityLevel(50, 100)).toBe("shaken");
    expect(sanityLevel(49, 100)).toBe("disturbed");
    expect(sanityLevel(25, 100)).toBe("disturbed");
    expect(sanityLevel(24, 100)).toBe("insane");
    expect(SANITY_LEVEL_LABELS.insane).toBe("Enlouquecido");
    expect(sanityMentalPenalty({ sanity_current: 40, sanity_max: 100 }, "calculo_visual")).toBe(-2);
    expect(sanityMentalPenalty({ sanity_current: 40, sanity_max: 100 }, "ferramenta_fisica")).toBe(
      0,
    );
  });
});
