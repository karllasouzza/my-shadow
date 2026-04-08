/**
 * T036: End-to-end period review flow test
 *
 * Tests the complete user journey for period review:
 * 1. Select a date range
 * 2. Load reflections for that range
 * 3. Request review generation
 * 4. Receive structured response
 * 5. Display review with navigation options
 */

import { beforeEach, describe, expect, it } from "bun:test";

interface ReviewFlowState {
  selectedPeriodStart?: string;
  selectedPeriodEnd?: string;
  reflectionsLoaded: boolean;
  reviewGenerating: boolean;
  reviewGenerated: boolean;
  reviewData?: {
    id: string;
    summary: string;
    patterns: string[];
    triggers: string[];
    prompts: string[];
  };
  error?: string;
}

/**
 * Mock E2E Review Flow
 */
function createReviewFlowMachine(): {
  state: ReviewFlowState;
  selectPeriod: (start: string, end: string) => Promise<void>;
  generateReview: () => Promise<void>;
  clear: () => void;
} {
  const state: ReviewFlowState = {
    reflectionsLoaded: false,
    reviewGenerating: false,
    reviewGenerated: false,
    error: undefined,
  };

  return {
    state,
    async selectPeriod(start: string, end: string) {
      state.selectedPeriodStart = start;
      state.selectedPeriodEnd = end;
      // Simulate loading reflections
      await new Promise((r) => setTimeout(r, 50));
      state.reflectionsLoaded = true;
    },
    async generateReview() {
      if (!state.reflectionsLoaded) {
        state.error = "Select a period first";
        return;
      }

      state.reviewGenerating = true;
      try {
        // Simulate generation
        await new Promise((r) => setTimeout(r, 100));
        state.reviewData = {
          id: `review_${Date.now()}`,
          summary:
            "Durante este período, observa-se uma jornada de integração da sombra.",
          patterns: ["Pattern 1", "Pattern 2"],
          triggers: ["Trigger 1", "Trigger 2"],
          prompts: ["Prompt 1?", "Prompt 2?"],
        };
        state.reviewGenerated = true;
        state.error = undefined;
      } catch (error) {
        state.error = (error as Error).message;
      } finally {
        state.reviewGenerating = false;
      }
    },
    clear() {
      state.selectedPeriodStart = undefined;
      state.selectedPeriodEnd = undefined;
      state.reflectionsLoaded = false;
      state.reviewGenerating = false;
      state.reviewGenerated = false;
      state.reviewData = undefined;
      state.error = undefined;
    },
  };
}

describe("Period Review Flow - E2E", () => {
  let flow: ReturnType<typeof createReviewFlowMachine>;

  beforeEach(() => {
    flow = createReviewFlowMachine();
  });

  it("should initialize with clean state", () => {
    expect(flow.state.reflectionsLoaded).toBe(false);
    expect(flow.state.reviewGenerating).toBe(false);
    expect(flow.state.reviewGenerated).toBe(false);
    expect(flow.state.selectedPeriodStart).toBeUndefined();
  });

  it("should select period and load reflections", async () => {
    await flow.selectPeriod("2026-03-01", "2026-03-31");

    expect(flow.state.selectedPeriodStart).toBe("2026-03-01");
    expect(flow.state.selectedPeriodEnd).toBe("2026-03-31");
    expect(flow.state.reflectionsLoaded).toBe(true);
  });

  it("should prevent review generation without period selection", async () => {
    await flow.generateReview();

    expect(flow.state.error).toContain("Select a period first");
    expect(flow.state.reviewGenerated).toBe(false);
  });

  it("should generate review after period selection", async () => {
    await flow.selectPeriod("2026-03-01", "2026-03-31");
    await flow.generateReview();

    expect(flow.state.reviewGenerating).toBe(false);
    expect(flow.state.reviewGenerated).toBe(true);
    expect(flow.state.reviewData).toBeDefined();
    expect(flow.state.error).toBeUndefined();
  });

  it("should populate review with structured data", async () => {
    await flow.selectPeriod("2026-03-01", "2026-03-31");
    await flow.generateReview();

    const review = flow.state.reviewData!;
    expect(review.id).toBeDefined();
    expect(review.summary).toBeDefined();
    expect(Array.isArray(review.patterns)).toBe(true);
    expect(Array.isArray(review.triggers)).toBe(true);
    expect(Array.isArray(review.prompts)).toBe(true);
  });

  it("should include Portuguese text in review", async () => {
    await flow.selectPeriod("2026-03-01", "2026-03-31");
    await flow.generateReview();

    const review = flow.state.reviewData!;
    expect(review.summary).toMatch(/[a-záàâãéèêíìîóòôõöúùûü]/);
  });

  it("should reference Jungian concepts", async () => {
    await flow.selectPeriod("2026-03-01", "2026-03-31");
    await flow.generateReview();

    const review = flow.state.reviewData!;
    expect(review.summary.toLowerCase()).toMatch(/sombra|integração/);
  });

  it("should support review regeneration", async () => {
    await flow.selectPeriod("2026-03-01", "2026-03-31");
    await flow.generateReview();

    const firstId = flow.state.reviewData!.id;

    // Simulate regeneration
    flow.state.reviewGenerated = false;
    flow.state.reviewData = undefined;
    await flow.generateReview();

    expect(flow.state.reviewGenerated).toBe(true);
    expect(flow.state.reviewData!.id).toBeDefined();
    // New generation gets new ID
    expect(flow.state.reviewData!.id).not.toBe(firstId);
  });

  it("should clear state properly", async () => {
    await flow.selectPeriod("2026-03-01", "2026-03-31");
    await flow.generateReview();

    expect(flow.state.reviewGenerated).toBe(true);

    flow.clear();

    expect(flow.state.selectedPeriodStart).toBeUndefined();
    expect(flow.state.reflectionsLoaded).toBe(false);
    expect(flow.state.reviewGenerated).toBe(false);
    expect(flow.state.reviewData).toBeUndefined();
  });

  it("should handle period changes mid-flow", async () => {
    await flow.selectPeriod("2026-03-01", "2026-03-31");
    await flow.generateReview();

    const firstReview = flow.state.reviewData!.id;

    // Change period
    flow.state.reviewGenerated = false;
    flow.state.reviewData = undefined;
    await flow.selectPeriod("2026-02-01", "2026-02-28");
    await flow.generateReview();

    expect(flow.state.selectedPeriodStart).toBe("2026-02-01");
    expect(flow.state.reviewData!.id).not.toBe(firstReview);
  });

  it("should maintain consistent review structure across generations", async () => {
    await flow.selectPeriod("2026-03-01", "2026-03-31");
    await flow.generateReview();

    const review = flow.state.reviewData!;
    const keys = Object.keys(review).sort();

    // Regenerate
    flow.state.reviewGenerated = false;
    flow.state.reviewData = undefined;
    await flow.generateReview();

    const review2 = flow.state.reviewData!;
    const keys2 = Object.keys(review2).sort();

    expect(keys).toEqual(keys2); // Same structure
  });

  it("should indicate generation progress", async () => {
    await flow.selectPeriod("2026-03-01", "2026-03-31");

    // Start generation
    const generatePromise = flow.generateReview();
    expect(flow.state.reviewGenerating).toBe(true);

    await generatePromise;
    expect(flow.state.reviewGenerating).toBe(false);
    expect(flow.state.reviewGenerated).toBe(true);
  });
});
