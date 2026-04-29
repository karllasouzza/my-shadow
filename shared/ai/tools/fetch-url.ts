import { isValidFetchUrl } from "./is-valid-url";

type BunFetchSignal = any;

export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Cache-Control": "max-age=0",
  DNT: "1",
};

export const USER_AGENT_POOL: string[] = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

export interface FetchUrlOptions {
  signal?: AbortSignal;
  timeout?: number;
  headers?: Record<string, string>;
  useBrowserHeaders?: boolean;
  maxRedirects?: number;
  validateSSL?: boolean;
  maxSizeBytes?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface FetchUrlResult {
  success: boolean;
  html: string;
  status?: number;
  statusText?: string;
  finalUrl?: string;
  error?: string;
  errorCode?:
    | "NETWORK_ERROR"
    | "TIMEOUT"
    | "BLOCKED"
    | "CAPTCHA"
    | "PARSE_ERROR"
    | "SIZE_LIMIT";
  url: string;
  responseHeaders?: Record<string, string>;
}

function detectBlocking(html: string): boolean {
  const patterns = [
    /captcha/i,
    /unusual.?traffic/i,
    /automated.?access/i,
    /too many requests/i,
    /please verify/i,
  ];
  return patterns.some((p) => p.test(html));
}

function getRetryDelay(attempt: number, baseDelayMs: number): number {
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * exponential * 0.3;
  return Math.floor(exponential + jitter);
}

function isTransientError(error: Error, status?: number): boolean {
  if (status === 429 || status === 503 || status === 502) return true;
  const msg = error.message;
  return (
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("socket hang up") ||
    msg.includes("network error")
  );
}

function pickUserAgent(): string {
  const pool = USER_AGENT_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function fetchUrl(
  url: string,
  options?: FetchUrlOptions,
): Promise<FetchUrlResult> {
  const {
    signal,
    timeout = 15_000,
    headers: customHeaders,
    useBrowserHeaders = true,
    maxSizeBytes = 5 * 1024 * 1024,
    retryAttempts = 2,
    retryDelayMs = 500,
    onRetry,
  } = options ?? {};

  if (!isValidFetchUrl(url)) {
    return {
      success: false,
      url,
      html: "",
      error: "URL validation failed: blocked or invalid URL",
      errorCode: "BLOCKED",
    };
  }

  let attempt = 0;
  let lastError: Error | undefined;
  let lastStatus: number | undefined;

  while (attempt <= retryAttempts) {
    attempt++;

    try {
      const controller = new AbortController();
      const combinedSignals = [controller.signal];
      if (signal) combinedSignals.push(signal);

      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchHeaders: Record<string, string> = {};
      if (useBrowserHeaders) {
        Object.assign(fetchHeaders, BROWSER_HEADERS);
        fetchHeaders["User-Agent"] = pickUserAgent();
      }
      if (customHeaders) {
        Object.assign(fetchHeaders, customHeaders);
      }

      const response = await fetch(url, {
        headers: fetchHeaders,
        signal: combineSignals(...combinedSignals) as BunFetchSignal,
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers?.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const finalUrl = response.url || url;

      const reader = response.body?.getReader();
      let html = "";
      let totalBytes = 0;
      const decoder = new TextDecoder("utf-8", { fatal: false });

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          totalBytes += value.byteLength;
          if (totalBytes > maxSizeBytes) {
            reader.cancel();
            return {
              success: false,
              url,
              html: "",
              error: `Response exceeded size limit of ${maxSizeBytes} bytes`,
              errorCode: "SIZE_LIMIT",
              status: response.status,
              statusText: response.statusText,
              finalUrl,
              responseHeaders,
            };
          }
          html += decoder.decode(value, { stream: true });
        }
      } else {
        html = await response.text();
      }

      html += decoder.decode();

      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          if (detectBlocking(html)) {
            return {
              success: false,
              url,
              html: "",
              error:
                response.status === 429
                  ? "Rate limited. Please try again later."
                  : "Request was blocked.",
              errorCode: "CAPTCHA",
              status: response.status,
              statusText: response.statusText,
              finalUrl,
              responseHeaders,
            };
          }
          if (
            isTransientError(
              new Error(`HTTP ${response.status}`),
              response.status,
            )
          ) {
            if (attempt <= retryAttempts) {
              const delay = getRetryDelay(attempt, retryDelayMs);
              await new Promise((r) => setTimeout(r, delay));
              continue;
            }
          }
        }

        return {
          success: false,
          url,
          html,
          error: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          statusText: response.statusText,
          finalUrl,
          responseHeaders,
        };
      }

      if (detectBlocking(html)) {
        return {
          success: false,
          url,
          html: "",
          error: "Request was blocked by the server (CAPTCHA detected).",
          errorCode: "CAPTCHA",
          status: response.status,
          statusText: response.statusText,
          finalUrl,
          responseHeaders,
        };
      }

      return {
        success: true,
        html,
        status: response.status,
        statusText: response.statusText,
        finalUrl,
        url,
        responseHeaders,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (isTransientError(lastError)) {
        if (attempt <= retryAttempts) {
          onRetry?.(attempt, lastError);
          const delay = getRetryDelay(attempt, retryDelayMs);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }

      const isTimeout =
        lastError.name === "TimeoutError" ||
        lastError.message.includes("aborted") ||
        lastError.message.includes("timed out");

      return {
        success: false,
        url,
        html: "",
        error: isTimeout ? "Request timed out." : lastError.message,
        errorCode: isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
        status: lastStatus,
      };
    }
  }

  return {
    success: false,
    url,
    html: "",
    error: lastError?.message ?? "Request failed after retries",
    errorCode: "NETWORK_ERROR",
    status: lastStatus,
  };
}

function combineSignals(
  ...signals: (AbortSignal | undefined)[]
): AbortSignal | undefined {
  const valid = signals.filter((s): s is AbortSignal => s != null);

  const controller = new AbortController();
  for (const signal of valid) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}
