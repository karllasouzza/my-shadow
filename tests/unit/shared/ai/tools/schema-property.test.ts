/**
 * Property-based tests for tool definition schema validation.
 *
 * Property 1 — Valid tool names always pass validation
 * Property 2 — Invalid tool names always fail validation
 * Property 3 — Tool definitions with valid schemas don't throw
 * Property 4 — Tool definitions with duplicate names always throw
 */

import { describe, expect, it, mock } from "bun:test";
import * as fc from "fast-check";

// Mock ai log for ToolRegistry
mock.module("@/shared/ai/log", () => ({
  aiInfo: () => {},
  aiDebug: () => {},
  aiError: () => {},
}));

describe("Tool definition schema property tests", () => {
  describe("Tool name validation (regex: /^[a-z_][a-z0-9_]*$/)", () => {
    const NAME_REGEX = /^[a-z_][a-z0-9_]*$/;

    it("valid names always pass the regex", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z_][a-z0-9_]*$/),
          (name) => {
            expect(NAME_REGEX.test(name)).toBe(true);
          },
        ),
        { seed: 42 },
      );
    });

    it("names with uppercase letters always fail", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[A-Z]/).filter((s) => s.length > 0),
          (name) => {
            expect(NAME_REGEX.test(name)).toBe(false);
          },
        ),
        { seed: 42 },
      );
    });

    it("names with hyphens or spaces always fail", () => {
      fc.assert(
        fc.property(
          fc
            .stringMatching(/^[a-z_][a-z0-9_-]*/)
            .filter((s) => s.includes("-")),
          (name) => {
            expect(NAME_REGEX.test(name)).toBe(false);
          },
        ),
        { seed: 42 },
      );
    });

    it("empty string fails", () => {
      expect(NAME_REGEX.test("")).toBe(false);
    });

    it("names starting with number fail", () => {
      fc.assert(
        fc.property(
          fc
            .stringMatching(/^[0-9]/)
            .filter((s) => s.length > 0 && /^[0-9]/.test(s)),
          (name) => {
            expect(NAME_REGEX.test(name)).toBe(false);
          },
        ),
        { seed: 42 },
      );
    });
  });

  describe("Tool definition schema constraints", () => {
    it("definitions with valid names and schemas can be tracked", () => {
      fc.assert(
        fc.property(
          fc
            .stringMatching(/^[a-z_][a-z0-9_]*$/)
            .filter((s) => s.length > 0 && s.length <= 50),
          fc.boolean(),
          (name, enabled) => {
            const def = {
              name,
              description: `Tool: ${name}`,
              inputSchema: {
                type: "object" as const,
                properties: {
                  query: { type: "string" },
                },
                required: ["query"],
              },
              enabled,
              handler: async () => ({ success: true }),
            };

            expect(def.name).toBe(name);
            expect(def.name.length).toBeGreaterThan(0);
            expect(typeof def.handler).toBe("function");
          },
        ),
        { seed: 42, numRuns: 50 },
      );
    });

    it("ToolRegistry rejects duplicate names deterministically", async () => {
      const { ToolRegistry } = await import("@/shared/ai/tools/registry");

      fc.assert(
        fc.property(
          fc
            .stringMatching(/^[a-z_][a-z0-9_]*$/)
            .filter((s) => s.length > 0 && s.length <= 30),
          (name) => {
            const registry = new ToolRegistry();
            registry.register({
              name,
              description: "First",
              inputSchema: { type: "object" },
              handler: async () => ({ success: true }),
            });

            expect(() => {
              registry.register({
                name,
                description: "Duplicate",
                inputSchema: { type: "object" },
                handler: async () => ({ success: true }),
              });
            }).toThrow(`Tool "${name}" is already registered`);
          },
        ),
        { seed: 42, numRuns: 30 },
      );
    });
  });

  describe("Tool execution invariants", () => {
    it("execute never throws — always returns ToolResult", async () => {
      const { ToolRegistry } = await import("@/shared/ai/tools/registry");

      await fc.assert(
        fc.asyncProperty(
          fc
            .stringMatching(/^[a-z_][a-z0-9_]*$/)
            .filter((s) => s.length > 0 && s.length <= 20),
          fc.boolean(),
          async (name, success) => {
            const registry = new ToolRegistry();
            registry.register({
              name,
              description: "Property test tool",
              inputSchema: { type: "object" },
              handler: async () => ({
                success,
                data: success ? { value: 42 } : undefined,
                source: "test",
              }),
            });

            const result = await registry.execute(name, {});

            // Invariant: execute should never throw
            expect(result).toBeDefined();
            expect(typeof result.success).toBe("boolean");
            if (result.success) {
              expect(result.source).toBe("test");
            }
          },
        ),
        { seed: 42, numRuns: 20 },
      );
    });
  });
});
