export interface HttpResponse<T> {
  success: boolean;
  status: number;
  data?: T;
  error?: string;
  errorBody?: string;
}

export class HttpClient {
  constructor(private baseHeaders: Record<string, string> = {}) {}

  async post<T>(
    url: string,
    body: unknown,
    options?: {
      headers?: Record<string, string>;
      signal?: AbortSignal;
      timeout?: number;
    },
  ): Promise<HttpResponse<T>> {
    return this.request<T>("POST", url, {
      ...options,
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  }

  async get<T>(
    url: string,
    options?: {
      headers?: Record<string, string>;
      signal?: AbortSignal;
      timeout?: number;
    },
  ): Promise<HttpResponse<T>> {
    return this.request<T>("GET", url, options);
  }

  private async request<T>(
    method: string,
    url: string,
    options?: {
      headers?: Record<string, string>;
      signal?: AbortSignal;
      timeout?: number;
      body?: string;
    },
  ): Promise<HttpResponse<T>> {
    const timeoutSignal =
      options?.timeout != null
        ? AbortSignal.timeout(options.timeout)
        : undefined;
    const signal = combineSignals(timeoutSignal, options?.signal);

    try {
      const response = await fetch(url, {
        method,
        headers: { ...this.baseHeaders, ...options?.headers },
        body: options?.body,
        signal: signal as any,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        return {
          success: false,
          status: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`,
          errorBody,
        };
      }

      const data = (await response.json()) as T;
      return { success: true, status: response.status, data };
    } catch (error) {
      const isAbort =
        error instanceof DOMException && error.name === "AbortError";
      return {
        success: false,
        status: 0,
        error: isAbort
          ? "Request timed out or was aborted."
          : ((error as Error)?.message ?? String(error)),
      };
    }
  }
}

function combineSignals(
  ...signals: (AbortSignal | undefined)[]
): AbortSignal | undefined {
  const valid = signals.filter((s): s is AbortSignal => s != null);
  if (valid.length === 0) return undefined;
  if (valid.length === 1) return valid[0];

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
