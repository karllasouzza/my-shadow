import { aiDebug, aiError, aiInfo } from "../log";
import { executeWithRetry } from "./executor";
import { createDefinition, validateRegistration } from "./registry";
import type {
    ExecutionContext,
    LlamaToolFormat,
    ToolDefinition,
    ToolRegistration,
    ToolResult,
} from "./types";
import { toLlamaToolFormat, toolFail, toolOk } from "./types";

export class ToolEngine {
  private tools: Map<string, ToolDefinition> = new Map();

  register(registration: ToolRegistration): ToolResult<void> {
    const error = validateRegistration(registration);
    if (error) {
      aiError("TOOL:register:invalid", error);
      return toolFail("EXECUTION_FAILED", error);
    }
    if (this.tools.has(registration.name)) {
      return toolFail(
        "EXECUTION_FAILED",
        `Tool "${registration.name}" is already registered.`,
      );
    }
    const definition = createDefinition(registration);
    this.tools.set(registration.name, definition);
    aiInfo(
      "TOOL:register",
      `name=${definition.name} enabled=${definition.enabled}`,
    );
    return toolOk(undefined);
  }

  unregister(name: string): ToolResult<void> {
    if (!this.tools.delete(name)) {
      return toolFail("NOT_FOUND", `Tool "${name}" not found.`);
    }
    aiInfo("TOOL:unregister", `name=${name}`);
    return toolOk(undefined);
  }

  enable(name: string): ToolResult<void> {
    const tool = this.tools.get(name);
    if (!tool) {
      return toolFail("NOT_FOUND", `Tool "${name}" not found.`);
    }
    (tool as { enabled: boolean }).enabled = true;
    aiInfo("TOOL:enable", `name=${name}`);
    return toolOk(undefined);
  }

  disable(name: string): ToolResult<void> {
    const tool = this.tools.get(name);
    if (!tool) {
      return toolFail("NOT_FOUND", `Tool "${name}" not found.`);
    }
    (tool as { enabled: boolean }).enabled = false;
    aiInfo("TOOL:disable", `name=${name}`);
    return toolOk(undefined);
  }

  isEnabled(name: string): boolean {
    return this.tools.get(name)?.enabled ?? false;
  }

  getDefinition(name: string): ToolDefinition | null {
    return this.tools.get(name) ?? null;
  }

  getEnabled(): readonly ToolDefinition[] {
    return Array.from(this.tools.values()).filter((t) => t.enabled);
  }

  getAll(): readonly ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): readonly LlamaToolFormat[] {
    return this.getEnabled().map(toLlamaToolFormat);
  }

  hasEnabledTools(): boolean {
    return this.getEnabled().length > 0;
  }

  get size(): number {
    return this.tools.size;
  }

  async execute(
    name: string,
    params: Record<string, unknown>,
    context?: ExecutionContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return toolFail("NOT_FOUND", `Tool "${name}" not found.`);
    }
    if (!tool.enabled) {
      return toolFail("DISABLED", `Tool "${name}" is disabled.`);
    }

    const start = Date.now();
    aiDebug("TOOL:execute:start", `name=${name}`, { params });

    const result = await executeWithRetry(tool.handler, params, context);
    const duration = Date.now() - start;

    if (result.ok) {
      aiInfo("TOOL:execute:done", `name=${name} duration_ms=${duration}`);
    } else {
      const { error } = result as { ok: false; error: { message: string } };
      aiError(
        "TOOL:execute:error",
        `name=${name} duration_ms=${duration} error=${error.message}`,
      );
    }

    return result;
  }
}
