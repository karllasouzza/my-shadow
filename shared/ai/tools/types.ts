export interface JSONSchemaObject {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchemaObject;
  handler: ToolHandler;
  enabled: boolean;
  configSchema?: JSONSchemaObject;
}

export type ToolHandler = (
  params: Record<string, unknown>,
  context?: { signal?: AbortSignal },
) => Promise<ToolResult>;

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  source?: string;
}

/** Parsed from llama.rn's TokenData.tool_calls or NativeCompletionResult.tool_calls. */
export interface ToolCallRequest {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  raw: string;
}

export interface ToolRegistryConfig {
  tools: Map<string, ToolDefinition>;
  enabledTools: Set<string>;
}

export interface WebSearchConfig {
  apiKey: string;
  apiUrl?: string;
  defaultCount?: number;
  defaultFreshness?: "oneDay" | "oneWeek" | "oneMonth" | "oneYear" | "noLimit";
  includeSummaries?: boolean;
}

export interface ConsentRequest {
  query: string;
  serviceName: string;
  serviceUrl: string;
  dataDescription: string;
  onConsent: (granted: boolean) => void;
}

export interface ToolRegistration {
  name: string;
  description: string;
  inputSchema: JSONSchemaObject;
  handler: ToolHandler;
  enabled?: boolean;
  configSchema?: JSONSchemaObject;
}

export type LlamaToolFormat = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JSONSchemaObject;
  };
};

export function toLlamaToolsFormat(
  definitions: ToolDefinition[],
): LlamaToolFormat[] {
  return definitions.map((def) => ({
    type: "function" as const,
    function: {
      name: def.name,
      description: def.description,
      parameters: def.inputSchema,
    },
  }));
}
