// ─── Type Re-exports ───
export type {
  ToolName,
  ToolErrorCode,
  ToolError,
  ToolResult,
  JSONSchemaObject,
  JSONSchemaProperty,
  ToolRegistration,
  ToolDefinition,
  ToolHandler,
  ExecutionContext,
  ExecutorConfig,
  LlamaToolFormat,
  FetchUrlOptions,
  FetchUrlSuccess,
  FetchUrlFailure,
  FetchUrlResult,
  ParseHtmlOptions,
  ParsedContent,
  ImageInfo,
  VideoInfo,
  LinkInfo,
  SearchResult,
  WebSearchParams,
  HttpResponse,
  HttpRequestOptions,
} from './types'

// ─── Value Re-exports ───
export { toolOk, toolFail, toLlamaToolFormat, DEFAULT_EXECUTOR_CONFIG } from './types'
export { ToolEngine } from './engine'
export { HttpClient } from './utils/http-client'
export { parseHtml, decodeHtmlEntities } from './utils/html-parser'
export { isValidFetchUrl } from './utils/url-validator'
export { fetchUrl, BROWSER_HEADERS, USER_AGENT_POOL, fetchUrlDefinition } from './handlers/fetch-url'
export { webSearchDefinition, webSearchHandler } from './handlers/web-search'

// ─── Singleton ───
import { ToolEngine } from './engine'

let instance: ToolEngine | null = null

export function getToolEngine(): ToolEngine {
  return (instance ??= new ToolEngine())
}
