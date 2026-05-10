import { aiDebug, aiWarn } from "../../log";
import type {
    ExecutionContext,
    FetchUrlFailure,
    FetchUrlOptions,
    FetchUrlResult,
    ToolRegistration,
    ToolResult,
} from "../types";
import { toolFail, toolOk } from "../types";
import { isValidFetchUrl } from "../utils/url-validator";

export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Cache-Control": "max-age=0",
  DNT: "1",
};

export const USER_AGENT_POOL: readonly string[] = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

export const fetchUrlDefinition: ToolRegistration = {
  name: "fetch_url",
  description: "Fetch the content of a URL and return its HTML body.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL to fetch" },
      timeoutMs: {
        type: "number",
        description: "Timeout in milliseconds",
        default: 15000,
      },
    },
    required: ["url"],
  },
  handler: async (
    params: Record<string, unknown>,
    context?: ExecutionContext,
  ): Promise<ToolResult> => {
    const url = params["url"] as string;
    const result = await fetchUrl(url, { signal: context?.signal });
    if (!result.ok) {
      const failure = result as FetchUrlFailure;
      return toolFail(failure.error.code, failure.error.message);
    }
    return toolOk({
      html: result.html,
      url: result.url,
      statusCode: result.statusCode,
    });
  },
  enabled: true,
};

export async function fetchUrl(
  url: string,
  options?: FetchUrlOptions,
): Promise<FetchUrlResult> {
  const validation = validateRequest(url);
  if (validation) return validation;

  const {
    timeoutMs = 15_000,
    maxSizeBytes = 5 * 1024 * 1024,
    retryAttempts = 2,
    headers: customHeaders,
    signal,
  } = options ?? {};

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    try {
      const response = await attemptFetch(
        url,
        buildHeaders(customHeaders),
        signal,
        timeoutMs,
      );
      return await processResponse(response, url, maxSizeBytes);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!isTransientError(lastError) || attempt >= retryAttempts) break;
      const delay = getRetryDelay(attempt, 500);
      aiWarn(
        "FETCH:retry",
        `attempt=${attempt + 1} delay=${delay}ms url=${url}`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return buildFetchError(url, lastError);
}

function validateRequest(url: string): FetchUrlFailureResult | null {
  if (!isValidFetchUrl(url)) {
    return {
      ok: false,
      error: {
        code: "BLOCKED",
        message: "URL validation failed: blocked or invalid URL",
      },
    };
  }
  return null;
}

function buildHeaders(
  customHeaders?: Record<string, string>,
): Record<string, string> {
  const headers = { ...BROWSER_HEADERS, "User-Agent": getRandomUserAgent() };
  if (customHeaders) Object.assign(headers, customHeaders);
  return headers;
}

async function attemptFetch(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const combinedSignal = combineSignals(controller.signal, signal);

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  aiDebug("FETCH:attempt", `url=${url} timeout=${timeoutMs}ms`);

  try {
    const response = await fetch(url, {
      headers,
      signal: combinedSignal,
      redirect: "follow",
    } as RequestInit);
    clearTimeout(timer);
    return response;
  } catch (error) {
    clearTimeout(timer);
    if (controller.signal.aborted && !signal?.aborted) {
      const err = new Error(`Request timed out after ${timeoutMs}ms.`);
      (err as unknown as Record<string, unknown>)["isTimeout"] = true;
      throw err;
    }
    throw error;
  }
}

async function processResponse(
  response: Response,
  url: string,
  maxSizeBytes: number,
): Promise<FetchUrlResult> {
  const html = await readStreamedBody(response, maxSizeBytes);
  if (html === null) {
    return {
      ok: false,
      error: {
        code: "SIZE_LIMIT",
        message: `Response exceeded size limit of ${maxSizeBytes} bytes`,
      },
    };
  }

  if (!response.ok) {
    return handleNonOkResponse(response, url, html);
  }

  if (detectBlocking(html)) {
    return {
      ok: false,
      error: {
        code: "CAPTCHA",
        message: "Request was blocked by the server (CAPTCHA detected).",
      },
    };
  }

  return {
    ok: true,
    html,
    url,
    statusCode: response.status,
    contentType: response.headers.get("content-type") ?? "",
  };
}

function handleNonOkResponse(
  response: Response,
  _url: string,
  html: string,
): FetchUrlResult {
  if (
    (response.status === 403 || response.status === 429) &&
    detectBlocking(html)
  ) {
    const msg =
      response.status === 429
        ? "Rate limited. Please try again later."
        : "Request was blocked.";
    return { ok: false, error: { code: "CAPTCHA", message: msg } };
  }
  return {
    ok: false,
    error: {
      code: "NETWORK_ERROR",
      message: `HTTP ${response.status}: ${response.statusText}`,
    },
  };
}

async function readStreamedBody(
  response: Response,
  maxSize: number,
): Promise<string | null> {
  if (!response.body?.getReader) {
    return response.text();
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let html = "";
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxSize) {
      reader.cancel();
      return null;
    }
    html += decoder.decode(value, { stream: true });
  }
  html += decoder.decode();
  return html;
}

function detectBlocking(body: string): boolean {
  const patterns = [
    /captcha/i,
    /unusual.?traffic/i,
    /automated.?access/i,
    /too many requests/i,
    /please verify/i,
  ];
  return patterns.some((p) => p.test(body));
}

function getRandomUserAgent(): string {
  return USER_AGENT_POOL[Math.floor(Math.random() * USER_AGENT_POOL.length)];
}

function isTransientError(error: Error): boolean {
  const msg = error.message;
  return (
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("socket hang up") ||
    msg.includes("network error")
  );
}

function getRetryDelay(attempt: number, baseMs: number): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * exponential * 0.3;
  return Math.floor(exponential + jitter);
}

function buildFetchError(
  _url: string,
  error: Error | undefined,
): FetchUrlResult {
  if (!error) {
    return {
      ok: false,
      error: { code: "NETWORK_ERROR", message: "Request failed after retries" },
    };
  }
  const isTimeout =
    (error as unknown as Record<string, unknown>)["isTimeout"] === true ||
    error.message.includes("timed out");
  const code = isTimeout ? "TIMEOUT" : "NETWORK_ERROR";
  return { ok: false, error: { code, message: error.message } };
}

function combineSignals(
  ...signals: (AbortSignal | undefined)[]
): AbortSignal | undefined {
  const valid = signals.filter((s): s is AbortSignal => s != null);
  if (valid.length === 0) return undefined;
  const controller = new AbortController();
  for (const sig of valid) {
    if (sig.aborted) {
      controller.abort(sig.reason);
      return controller.signal;
    }
    sig.addEventListener("abort", () => controller.abort(sig.reason), {
      once: true,
    });
  }
  return controller.signal;
}

type FetchUrlFailureResult = {
  ok: false;
  error: { code: "BLOCKED" | "INVALID_URL"; message: string };
};
