/**
 * T034: Integration test for RAG seeded content
 *
 * Tests that Jungian seed content is properly structured
 */

import { describe, expect, it } from "bun:test";
import {
  JUNGIAN_SEED_CONTENT,
  generateSeedId,
} from "@/shared/ai/rag-content-seed";

const VALID_CATEGORIES = [
  "shadow",
  "projection",
  "individuation",
  "collective_unconscious",
  "archetype",
] as const;

describe("Jungian Seed Content", () => {
  describe("Structure", () => {
    it("should have at least 10 entries", () => {
      expect(JUNGIAN_SEED_CONTENT.length).toBeGreaterThanOrEqual(10);
    });

    it("should have unique IDs", () => {
      const ids = JUNGIAN_SEED_CONTENT.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have valid categories for all entries", () => {
      for (const entry of JUNGIAN_SEED_CONTENT) {
        expect(VALID_CATEGORIES).toContain(entry.category);
      }
    });

    it("should have non-empty text for all entries", () => {
      for (const entry of JUNGIAN_SEED_CONTENT) {
        expect(entry.text.length).toBeGreaterThan(10);
      }
    });
  });

  describe("Portuguese Content", () => {
    it("should contain Brazilian Portuguese text", () => {
      const ptBrCharRegex = /[áàâãéèêíìîóòôõöúùûüç]/;
      const hasPtBr = JUNGIAN_SEED_CONTENT.some((e) =>
        ptBrCharRegex.test(e.text),
      );
      expect(hasPtBr).toBe(true);
    });

    it("should have meaningful text length (avg > 50 chars)", () => {
      const avgLength =
        JUNGIAN_SEED_CONTENT.reduce((sum, e) => sum + e.text.length, 0) /
        JUNGIAN_SEED_CONTENT.length;
      expect(avgLength).toBeGreaterThan(50);
    });
  });

  describe("Category Distribution", () => {
    it("should have at least 2 entries per category", () => {
      const categoryCount: Record<string, number> = {};
      for (const entry of JUNGIAN_SEED_CONTENT) {
        categoryCount[entry.category] = (categoryCount[entry.category] || 0) + 1;
      }
      for (const category of VALID_CATEGORIES) {
        expect(categoryCount[category]).toBeGreaterThanOrEqual(2);
      }
    });

    it("should have shadow as the most represented category", () => {
      const categoryCount: Record<string, number> = {};
      for (const entry of JUNGIAN_SEED_CONTENT) {
        categoryCount[entry.category] = (categoryCount[entry.category] || 0) + 1;
      }
      const shadowCount = categoryCount["shadow"] || 0;
      const maxOther = Math.max(
        ...Object.entries(categoryCount)
          .filter(([k]) => k !== "shadow")
          .map(([, v]) => v),
      );
      expect(shadowCount).toBeGreaterThanOrEqual(maxOther);
    });
  });

  describe("Content Quality", () => {
    it("should contain Jungian terminology", () => {
      const jungianTerms = ["sombra", "inconsciente", "arquétipo", "projeção", "individuação"];
      const hasTerminology = JUNGIAN_SEED_CONTENT.some((entry) =>
        jungianTerms.some((term) =>
          entry.text.toLowerCase().includes(term.toLowerCase()),
        ),
      );
      expect(hasTerminology).toBe(true);
    });
  });
});

describe("Seed ID Generation", () => {
  it("should generate unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateSeedId());
    }
    expect(ids.size).toBe(100);
  });

  it("should generate IDs with correct format", () => {
    const id = generateSeedId();
    expect(id).toMatch(/^seed_[a-z0-9]{8}$/);
  });
});
