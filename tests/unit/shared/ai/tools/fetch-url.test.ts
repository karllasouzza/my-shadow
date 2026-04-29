import { isValidFetchUrl } from "@/shared/ai/tools/is-valid-url";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

describe("isValidFetchUrl", () => {
  it("allows valid https URLs", () => {
    expect(isValidFetchUrl("https://example.com")).toBe(true);
    expect(isValidFetchUrl("https://www.google.com/search?q=test")).toBe(true);
    expect(isValidFetchUrl("http://example.org/path?query=1")).toBe(true);
  });

  it("blocks non-http/https schemes", () => {
    expect(isValidFetchUrl("file:///etc/passwd")).toBe(false);
    expect(isValidFetchUrl("data:text/html,<script>")).toBe(false);
    expect(isValidFetchUrl("javascript:alert(1)")).toBe(false);
    expect(isValidFetchUrl("ftp://files.example.com")).toBe(false);
    expect(isValidFetchUrl("blob:some-uuid")).toBe(false);
  });

  it("blocks localhost", () => {
    expect(isValidFetchUrl("http://localhost")).toBe(false);
    expect(isValidFetchUrl("http://localhost:8080")).toBe(false);
    expect(isValidFetchUrl("https://localhost:3000/api")).toBe(false);
  });

  it("blocks 127.0.0.1", () => {
    expect(isValidFetchUrl("http://127.0.0.1")).toBe(false);
    expect(isValidFetchUrl("http://127.0.0.1:3000")).toBe(false);
    expect(isValidFetchUrl("https://127.0.0.1/api")).toBe(false);
  });

  it("blocks private IP ranges", () => {
    expect(isValidFetchUrl("http://10.0.0.1")).toBe(false);
    expect(isValidFetchUrl("http://192.168.1.1")).toBe(false);
    expect(isValidFetchUrl("http://172.16.0.1")).toBe(false);
    expect(isValidFetchUrl("http://172.31.255.255")).toBe(false);
    expect(isValidFetchUrl("http://0.0.0.0")).toBe(false);
  });

  it("allows public IPs", () => {
    expect(isValidFetchUrl("http://8.8.8.8")).toBe(true);
    expect(isValidFetchUrl("http://1.1.1.1")).toBe(true);
    expect(isValidFetchUrl("http://93.184.216.34")).toBe(true);
  });

  it("blocks internal hostnames", () => {
    expect(isValidFetchUrl("http://internal")).toBe(false);
    expect(isValidFetchUrl("http://intranet")).toBe(false);
    expect(isValidFetchUrl("https://corp/api")).toBe(false);
    expect(isValidFetchUrl("http://myapp.local")).toBe(false);
    expect(isValidFetchUrl("http://server.internal")).toBe(false);
  });

  it("blocks IPv6 loopback", () => {
    expect(isValidFetchUrl("http://[::1]")).toBe(false);
    expect(isValidFetchUrl("http://[0:0:0:0:0:0:0:1]")).toBe(false);
    expect(isValidFetchUrl("http://[::]")).toBe(false);
  });

  it("returns false for invalid URLs", () => {
    expect(isValidFetchUrl("")).toBe(false);
    expect(isValidFetchUrl("not-a-url")).toBe(false);
    expect(isValidFetchUrl("http://")).toBe(false);
  });
});

describe("fetchUrl (unit tests with mocked fetch)", () => {
  let fetchUrl: any;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    globalThis.fetch = mock(async (_url: string, _options?: any) => {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        url: _url,
        headers: new Map([["content-type", "text/html"]]),
        body: {
          getReader: () => {
            const encoder = new TextEncoder();
            const data = encoder.encode(
              "<html><body>Hello world</body></html>",
            );
            let pos = 0;
            return {
              read: async () => {
                if (pos >= data.byteLength) {
                  return { done: true, value: undefined as any };
                }
                pos += 10;
                return { done: false, value: data.slice(pos - 10, pos) };
              },
              cancel: async () => {},
            };
          },
        },
      };
    }) as unknown as typeof globalThis.fetch;

    const mod = await import("@/shared/ai/tools/fetch-url");
    fetchUrl = mod.fetchUrl;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("blocks invalid URLs via SSRF protection", async () => {
    const result = await fetchUrl("http://localhost:8080");
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("BLOCKED");
  });

  it("applies browser headers by default", async () => {
    await fetchUrl("https://example.com");
    const fetchCall = (globalThis.fetch as any).mock?.calls?.[0] ?? [];
    const headers = fetchCall[1]?.headers ?? {};
    expect(headers["User-Agent"]).toBeDefined();
    expect(headers["Accept"]).toContain("text/html");
    expect(headers["DNT"]).toBe("1");
  });

  it("returns success with html content", async () => {
    const result = await fetchUrl("https://example.com");
    expect(result.success).toBe(true);
    expect(result.html).toBeDefined();
    expect(result.url).toBe("https://example.com");
  });
});
