import { calculateMetrics } from "@/shared/ai/metrics";
import { describe, expect, test } from "bun:test";

describe("calculateMetrics", () => {
  test("computes tokensPerSecond using decode duration when firstTokenTime is present", () => {
    const start = 0;
    const first = 100; // ms
    const end = 600; // ms
    const tokenCount = 10;

    const metrics = calculateMetrics(start, first, end, tokenCount);

    // decodeDuration = 500 ms -> 10 / 0.5s = 20 tok/s
    expect(metrics.tokensPerSecond).toBeCloseTo(20, 2);
  });

  test("falls back to total duration when firstTokenTime is null", () => {
    const start = 0;
    const first = null;
    const end = 1000; // ms
    const tokenCount = 10;

    const metrics = calculateMetrics(start, first, end, tokenCount);

    // totalDuration = 1000 ms -> 10 / 1s = 10 tok/s
    expect(metrics.tokensPerSecond).toBeCloseTo(10, 2);
  });
});
