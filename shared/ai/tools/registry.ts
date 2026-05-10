import type { ToolDefinition, ToolName, ToolRegistration } from "./types";

const TOOL_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/;

export function validateRegistration(reg: ToolRegistration): string | null {
  if (!TOOL_NAME_PATTERN.test(reg.name)) {
    return `Invalid tool name "${reg.name}". Must match /^[a-z_][a-z0-9_]*$/.`;
  }
  if (!reg.description || reg.description.trim().length === 0) {
    return `Tool "${reg.name}" must have a non-empty description.`;
  }
  if (reg.inputSchema?.type !== "object") {
    return `Tool "${reg.name}" inputSchema.type must be "object".`;
  }
  return null;
}

export function normalizeToolName(name: string): ToolName {
  return name as ToolName;
}

export function createDefinition(reg: ToolRegistration): ToolDefinition {
  return {
    ...reg,
    name: normalizeToolName(reg.name),
    enabled: reg.enabled ?? true,
  };
}
