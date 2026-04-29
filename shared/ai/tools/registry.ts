import { aiDebug, aiError, aiInfo } from "@/shared/ai/log";
import type {
  LlamaToolFormat,
  ToolDefinition,
  ToolRegistration,
  ToolResult,
} from "./types";
import { toLlamaToolsFormat } from "./types";

const TOOL_NAME_REGEX = /^[a-z_][a-z0-9_]*$/;

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(registration: ToolRegistration): void {
    if (this.tools.has(registration.name)) {
      throw new Error(`Tool "${registration.name}" is already registered.`);
    }

    if (!TOOL_NAME_REGEX.test(registration.name)) {
      throw new Error(
        `Invalid tool name "${registration.name}". Must match /^[a-z_][a-z0-9_]*$/.`,
      );
    }

    const tool: ToolDefinition = {
      ...registration,
      enabled: registration.enabled ?? true,
    };

    this.tools.set(registration.name, tool);
    aiInfo("TOOL:register", `name=${tool.name} enabled=${tool.enabled}`);
  }

  unregister(name: string): void {
    if (this.tools.delete(name)) {
      aiInfo("TOOL:unregister", `name=${name}`);
    }
  }

  enable(name: string): void {
    const tool = this.tools.get(name);
    if (!tool) {
      aiDebug("TOOL:enable:not-found", `name=${name}`);
      return;
    }
    tool.enabled = true;
    aiInfo("TOOL:enable", `name=${name}`);
  }

  disable(name: string): void {
    const tool = this.tools.get(name);
    if (!tool) {
      aiDebug("TOOL:disable:not-found", `name=${name}`);
      return;
    }
    tool.enabled = false;
    aiInfo("TOOL:disable", `name=${name}`);
  }

  isEnabled(name: string): boolean {
    return this.tools.get(name)?.enabled ?? false;
  }

  getDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getEnabled(): ToolDefinition[] {
    return Array.from(this.tools.values()).filter((t) => t.enabled);
  }

  getAllDefinitions(): LlamaToolFormat[] {
    return toLlamaToolsFormat(this.getEnabled());
  }

  async execute(
    name: string,
    params: Record<string, unknown>,
    context?: { signal?: AbortSignal },
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool "${name}" not found.` };
    }

    if (!tool.enabled) {
      return { success: false, error: `Tool "${name}" is disabled.` };
    }

    const start = Date.now();
    aiDebug("TOOL:execute:start", `name=${name}`, { params });

    try {
      const result = await tool.handler(params, context);
      const duration = Date.now() - start;
      aiInfo(
        "TOOL:execute:done",
        `name=${name} success=${result.success} duration_ms=${duration}`,
        { duration_ms: duration },
      );
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      const message = (error as Error)?.message ?? String(error);
      aiError(
        "TOOL:execute:error",
        `name=${name} duration_ms=${duration} error=${message}`,
        { error: message },
      );
      return { success: false, error: message };
    }
  }

  hasEnabledTools(): boolean {
    return this.getEnabled().length > 0;
  }

  get size(): number {
    return this.tools.size;
  }
}
