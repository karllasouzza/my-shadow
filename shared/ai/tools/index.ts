// ─── Type Re-exports ───
export type {
  ExecutionContext,
  ExecutorConfig, FetchUrlFailure, FetchUrlOptions, FetchUrlResult, FetchUrlSuccess, HttpRequestOptions, HttpResponse, ImageInfo, JSONSchemaObject,
  JSONSchemaProperty, LinkInfo, LlamaToolFormat, ParsedContent, ParseHtmlOptions, SearchResult, ToolDefinition, ToolError, ToolErrorCode, ToolHandler, ToolName, ToolRegistration, ToolResult, VideoInfo, WebSearchParams
} from "./types";

// ─── Value Re-exports ───
export { ToolEngine } from "./engine";
export {
  BROWSER_HEADERS, fetchUrl, fetchUrlDefinition, USER_AGENT_POOL
} from "./handlers/fetch-url";
export { webSearchDefinition, webSearchHandler } from "./handlers/web-search";
export {
  DEFAULT_EXECUTOR_CONFIG, toLlamaToolFormat, toolFail, toolOk
} from "./types";
export { decodeHtmlEntities, parseHtml } from "./utils/html-parser";
export { HttpClient } from "./utils/http-client";
export { isValidFetchUrl } from "./utils/url-validator";

// ─── Singleton ───
import { ToolEngine } from "./engine";

let instance: ToolEngine | null = null;

export function getToolEngine(): ToolEngine {
  return (instance ??= new ToolEngine());
}
