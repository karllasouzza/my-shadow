import { describe, expect, it, beforeEach, mock } from "bun:test";

// Mock ai log to avoid console noise
const mockInfo: string[] = [];
const mockDebug: string[] = [];
const mockError: string[] = [];

mock.module("@/shared/ai/log", () => ({
  aiInfo: (tag: string, msg: string) => { mockInfo.push(`${tag}: ${msg}`); },
  aiDebug: (tag: string, msg: string) => { mockDebug.push(`${tag}: ${msg}`); },
  aiError: (tag: string, msg: string) => { mockError.push(`${tag}: ${msg}`); },
}));

describe("ToolRegistry", () => {
  let ToolRegistry: any;

  beforeEach(async () => {
    mockInfo.length = 0;
    mockDebug.length = 0;
    mockError.length = 0;
    const mod = await import("@/shared/ai/tools/registry");
    ToolRegistry = mod.ToolRegistry;
  });

  describe("register", () => {
    it("registers a valid tool", () => {
      const registry = new ToolRegistry();
      registry.register({
        name: "web_search",
        description: "Search the web",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
        handler: async () => ({ success: true, data: {} }),
      });

      expect(registry.size).toBe(1);
      expect(registry.getDefinition("web_search")).toBeDefined();
    });

    it("throws on duplicate name", () => {
      const registry = new ToolRegistry();
      registry.register({
        name: "test_tool",
        description: "A test tool",
        inputSchema: { type: "object" },
        handler: async () => ({ success: true }),
      });

      expect(() => {
        registry.register({
          name: "test_tool",
          description: "Duplicate",
          inputSchema: { type: "object" },
          handler: async () => ({ success: true }),
        });
      }).toThrow('Tool "test_tool" is already registered');
    });

    it("throws on invalid name format", () => {
      const registry = new ToolRegistry();
      expect(() => {
        registry.register({
          name: "Invalid-Name",
          description: "Bad name",
          inputSchema: { type: "object" },
          handler: async () => ({ success: true }),
        });
      }).toThrow(/Invalid tool name/);
    });

    it("accepts valid snake_case names", () => {
      const registry = new ToolRegistry();
      registry.register({
        name: "my_test_tool_1",
        description: "Valid name",
        inputSchema: { type: "object" },
        handler: async () => ({ success: true }),
      });
      expect(registry.size).toBe(1);
    });
  });

  describe("unregister", () => {
    it("removes a registered tool", () => {
      const registry = new ToolRegistry();
      registry.register({
        name: "test_tool",
        description: "A test tool",
        inputSchema: { type: "object" },
        handler: async () => ({ success: true }),
      });

      registry.unregister("test_tool");
      expect(registry.size).toBe(0);
      expect(registry.getDefinition("test_tool")).toBeUndefined();
    });

    it("does not throw when unregistering non-existent tool", () => {
      const registry = new ToolRegistry();
      expect(() => registry.unregister("nonexistent")).not.toThrow();
    });
  });

  describe("enable / disable", () => {
    it("enables a tool by default", () => {
      const registry = new ToolRegistry();
      registry.register({
        name: "test_tool",
        description: "A test tool",
        inputSchema: { type: "object" },
        handler: async () => ({ success: true }),
      });

      expect(registry.isEnabled("test_tool")).toBe(true);
    });

    it("disables and re-enables a tool", () => {
      const registry = new ToolRegistry();
      registry.register({
        name: "test_tool",
        description: "A test tool",
        inputSchema: { type: "object" },
        handler: async () => ({ success: true }),
      });

      registry.disable("test_tool");
      expect(registry.isEnabled("test_tool")).toBe(false);

      registry.enable("test_tool");
      expect(registry.isEnabled("test_tool")).toBe(true);
    });

    it("getEnabled returns only enabled tools", () => {
      const registry = new ToolRegistry();
      registry.register({
        name: "tool_a",
        description: "Tool A",
        inputSchema: { type: "object" },
        handler: async () => ({ success: true }),
      });
      registry.register({
        name: "tool_b",
        description: "Tool B",
        inputSchema: { type: "object" },
        handler: async () => ({ success: true }),
      });

      registry.disable("tool_b");
      const enabled = registry.getEnabled();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].name).toBe("tool_a");
    });

    it("getAllDefinitions returns only enabled tools in llama.rn format", () => {
      const registry = new ToolRegistry();
      registry.register({
        name: "tool_a",
        description: "Tool A",
        inputSchema: {
          type: "object",
          properties: { q: { type: "string" } },
          required: ["q"],
        },
        handler: async () => ({ success: true }),
      });
      registry.register({
        name: "tool_b",
        description: "Tool B",
        inputSchema: { type: "object" },
        handler: async () => ({ success: true }),
      });

      registry.disable("tool_b");
      const defs = registry.getAllDefinitions();

      expect(defs).toHaveLength(1);
      expect(defs[0].type).toBe("function");
      expect(defs[0].function.name).toBe("tool_a");
    });

    it("hasEnabledTools returns false when all disabled", () => {
      const registry = new ToolRegistry();
      registry.register({
        name: "test_tool",
        description: "Test",
        inputSchema: { type: "object" },
        handler: async () => ({ success: true }),
      });

      expect(registry.hasEnabledTools()).toBe(true);
      registry.disable("test_tool");
      expect(registry.hasEnabledTools()).toBe(false);
    });
  });

  describe("execute", () => {
    it("executes a tool handler and returns result", async () => {
      const registry = new ToolRegistry();
      registry.register({
        name: "echo",
        description: "Echoes params",
        inputSchema: {
          type: "object",
          properties: { msg: { type: "string" } },
        },
        handler: async (params) => ({
          success: true,
          data: params,
          source: "echo",
        }),
      });

      const result = await registry.execute("echo", { msg: "hello" });
      expect(result.success).toBe(true);
      expect((result.data as any).msg).toBe("hello");
      expect(result.source).toBe("echo");
    });

    it("returns error for unknown tool", async () => {
      const registry = new ToolRegistry();
      const result = await registry.execute("nonexistent", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("returns error for disabled tool", async () => {
      const registry = new ToolRegistry();
      registry.register({
        name: "test_tool",
        description: "Test",
        inputSchema: { type: "object" },
        handler: async () => ({ success: true, data: {} }),
      });

      registry.disable("test_tool");
      const result = await registry.execute("test_tool", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("disabled");
    });

    it("catches handler exceptions", async () => {
      const registry = new ToolRegistry();
      registry.register({
        name: "failing_tool",
        description: "Always fails",
        inputSchema: { type: "object" },
        handler: async () => {
          throw new Error("Something went wrong");
        },
      });

      const result = await registry.execute("failing_tool", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Something went wrong");
    });
  });

  describe("getAll", () => {
    it("returns all registered tools regardless of enabled state", () => {
      const registry = new ToolRegistry();
      registry.register({
        name: "tool_a",
        description: "A",
        inputSchema: { type: "object" },
        handler: async () => ({ success: true }),
      });
      registry.register({
        name: "tool_b",
        description: "B",
        inputSchema: { type: "object" },
        handler: async () => ({ success: true }),
      });

      registry.disable("tool_b");
      const all = registry.getAll();
      expect(all).toHaveLength(2);
    });
  });
});
