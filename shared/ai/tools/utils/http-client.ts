import type { HttpResponse, HttpRequestOptions } from '../types'

export class HttpClient {
  constructor(private readonly baseHeaders: Record<string, string> = {}) {}

  async get<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>(url, { method: 'GET' }, options?.timeoutMs, options?.signal)
  }

  async post<T>(url: string, body: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    const init: RequestInit = {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    }
    return this.request<T>(url, init, options?.timeoutMs, options?.signal)
  }

  private async request<T>(
    url: string,
    init: RequestInit,
    timeoutMs?: number,
    signal?: AbortSignal
  ): Promise<HttpResponse<T>> {
    const combinedSignal = this.combineSignals(
      timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
      signal
    )

    try {
      const response = await fetch(url, {
        ...init,
        headers: { ...this.baseHeaders, ...(init.headers as Record<string, string>) },
        signal: combinedSignal,
      } as RequestInit)
      if (!response.ok) {
        return { success: false, status: response.status, data: null, error: `HTTP ${response.status}: ${response.statusText}` }
      }
      const data = (await response.json()) as T
      return { success: true, status: response.status, data, error: null }
    } catch (error) {
      return this.buildErrorResponse<T>(error)
    }
  }

  private buildErrorResponse<T>(error: unknown): HttpResponse<T> {
    const isAbort = error instanceof DOMException && error.name === 'AbortError'
    const message = isAbort
      ? 'Request timed out or was aborted.'
      : ((error as Error)?.message ?? String(error))
    return { success: false, status: 0, data: null, error: message }
  }

  private combineSignals(...signals: (AbortSignal | undefined)[]): AbortSignal | undefined {
    const valid = signals.filter((s): s is AbortSignal => s != null)
    if (valid.length === 0) return undefined
    if (valid.length === 1) return valid[0]

    const controller = new AbortController()
    for (const sig of valid) {
      if (sig.aborted) { controller.abort(sig.reason); return controller.signal }
      sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true })
    }
    return controller.signal
  }
}
