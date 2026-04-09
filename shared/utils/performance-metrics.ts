/**
 * T018: Implement generation/export timing utility
 *
 * Provides performance metrics collection and monitoring for generation
 * and export operations against defined p95 budgets.
 */

export type OperationType =
  | "guided_questions"
  | "final_review"
  | "markdown_export"
  | "create_reflection"
  | "generate_guided_questions";

export interface TimingBudget {
  operationType: OperationType;
  p95Ms: number;
  p99Ms?: number;
}

export interface TimingMetric {
  operationType: OperationType;
  startMs: number;
  endMs?: number;
  durationMs?: number;
  withinBudget?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Performance metrics tracker and validator
 */
export class PerformanceMetrics {
  private metrics: TimingMetric[] = [];
  private budgets: Map<OperationType, TimingBudget> = new Map([
    ["guided_questions", { operationType: "guided_questions", p95Ms: 8000 }],
    ["final_review", { operationType: "final_review", p95Ms: 20000 }],
    ["markdown_export", { operationType: "markdown_export", p95Ms: 10000 }],
    ["create_reflection", { operationType: "create_reflection", p95Ms: 5000 }],
    [
      "generate_guided_questions",
      { operationType: "generate_guided_questions", p95Ms: 8000 },
    ],
  ]);

  constructor() {}

  /**
   * Start timing an operation
   */
  startTiming(
    operationType: OperationType,
  ): (metadata?: Record<string, unknown>) => void {
    const metric: TimingMetric = {
      operationType,
      startMs: Date.now(),
    };

    const metricIndex = this.metrics.length;
    this.metrics.push(metric);

    // Return stop function
    return (metadata?: Record<string, unknown>) => {
      this.stopTiming(metricIndex, metadata);
    };
  }

  /**
   * Stop timing (called by stop function)
   */
  private stopTiming(
    metricIndex: number,
    metadata?: Record<string, unknown>,
  ): void {
    const metric = this.metrics[metricIndex];
    if (metric) {
      metric.endMs = Date.now();
      metric.durationMs = metric.endMs - metric.startMs;
      metric.metadata = metadata;

      // Check against budget
      const budget = this.budgets.get(metric.operationType);
      if (budget) {
        metric.withinBudget = metric.durationMs <= budget.p95Ms;
      }
    }
  }

  /**
   * Get timing summary for an operation type
   */
  getSummary(operationType: OperationType): {
    count: number;
    minMs: number;
    maxMs: number;
    avgMs: number;
    p95Ms: number;
    withinBudgetCount: number;
    budgetMs?: number;
  } {
    const opMetrics = this.metrics.filter(
      (m) => m.operationType === operationType && m.durationMs !== undefined,
    );

    if (opMetrics.length === 0) {
      return {
        count: 0,
        minMs: 0,
        maxMs: 0,
        avgMs: 0,
        p95Ms: 0,
        withinBudgetCount: 0,
      };
    }

    const durations = opMetrics.map((m) => m.durationMs!).sort((a, b) => a - b);
    const withinBudgetCount = opMetrics.filter((m) => m.withinBudget).length;
    const budget = this.budgets.get(operationType);

    // Calculate p95
    const p95Index = Math.ceil(durations.length * 0.95) - 1;
    const p95 = durations[Math.max(0, p95Index)];

    return {
      count: opMetrics.length,
      minMs: Math.min(...durations),
      maxMs: Math.max(...durations),
      avgMs: durations.reduce((a, b) => a + b, 0) / durations.length,
      p95Ms: p95,
      withinBudgetCount,
      budgetMs: budget?.p95Ms,
    };
  }

  /**
   * Check if operation is within budget
   */
  isWithinBudget(operationType: OperationType, durationMs: number): boolean {
    const budget = this.budgets.get(operationType);
    if (!budget) return true; // No budget defined
    return durationMs <= budget.p95Ms;
  }

  /**
   * Set custom budget
   */
  setBudget(operationType: OperationType, p95Ms: number): void {
    this.budgets.set(operationType, { operationType, p95Ms });
  }

  /**
   * Get all recorded metrics
   */
  getAllMetrics(): TimingMetric[] {
    return [...this.metrics];
  }

  /**
   * Clear metrics (for testing)
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const operationTypes = new Set(this.metrics.map((m) => m.operationType));
    let report = "# Performance Metrics Report\n\n";

    for (const opType of operationTypes) {
      const summary = this.getSummary(opType);
      if (summary.count === 0) continue;

      report += `## ${opType}\n`;
      report += `- Count: ${summary.count}\n`;
      report += `- Min: ${summary.minMs}ms\n`;
      report += `- Max: ${summary.maxMs}ms\n`;
      report += `- Avg: ${Math.round(summary.avgMs)}ms\n`;
      report += `- P95: ${summary.p95Ms}ms`;

      if (summary.budgetMs) {
        const status =
          summary.p95Ms <= summary.budgetMs ? "✓ PASS" : "✗ FAILED";
        report += ` [Budget: ${summary.budgetMs}ms - ${status}]`;
      }
      report += `\n`;
      report += `- Within Budget: ${summary.withinBudgetCount}/${summary.count}\n\n`;
    }

    return report;
  }
}

// Singleton instance
let metricsInstance: PerformanceMetrics;

export const getPerformanceMetrics = (): PerformanceMetrics => {
  if (!metricsInstance) {
    metricsInstance = new PerformanceMetrics();
  }
  return metricsInstance;
};
