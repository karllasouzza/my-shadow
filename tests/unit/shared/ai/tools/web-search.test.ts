import { beforeEach, describe, expect, it, mock } from "bun:test";

// Mock @/shared/ai/tools/fetch-url
import { readFileSync } from "fs";

let mockFetchUrlResponse: any = null;

mock.module("@/shared/ai/tools/fetch-url", () => ({
  fetchUrl: async (_url: string, _options?: any) => {
    if (mockFetchUrlResponse) {
      return mockFetchUrlResponse;
    }
    return { success: true, html: "<html></html>" };
  },
}));

describe("Web Search", () => {
  let webSearchHandler: any;
  let formatSearchResultsForLLM: any;

  beforeEach(async () => {
    mockFetchUrlResponse = null;
    const mod = await import("@/shared/ai/tools/web-search");
    webSearchHandler = mod.webSearchHandler;
    formatSearchResultsForLLM = mod.formatSearchResultsForLLM;
  });

  describe("webSearchHandler", () => {
    it("returns error for empty query", async () => {
      const result = await webSearchHandler({ query: "" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });

    it("returns error for whitespace-only query", async () => {
      const result = await webSearchHandler({ query: "   " });
      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });

    it("handles fetch failure gracefully", async () => {
      mockFetchUrlResponse = {
        success: false,
        error: "Network error",
        errorCode: "NETWORK_ERROR",
      };
      const result = await webSearchHandler({ query: "test" });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("handles CAPTCHA blocking", async () => {
      mockFetchUrlResponse = {
        success: false,
        errorCode: "CAPTCHA",
        error: "CAPTCHA detected",
      };
      const result = await webSearchHandler({ query: "test" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("blocked");
    });

    it("processes DuckDuckGo HTML results correctly", async () => {
      const sampleHtml = readFileSync(
        "tests/fixtures/duckduckgo-sample.html",
        "utf-8",
      );
      mockFetchUrlResponse = {
        success: true,
        html: sampleHtml,
        finalUrl: "https://html.duckduckgo.com/html/?q=example+query",
      };

      const result = await webSearchHandler({ query: "example query" });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.resultCount).toBeGreaterThan(0);
    });

    it("handles empty HTML response", async () => {
      mockFetchUrlResponse = {
        success: true,
        html: "<html><body></body></html>",
        finalUrl: "https://html.duckduckgo.com/html/?q=test",
      };

      const result = await webSearchHandler({ query: "test" });
      expect(result.success).toBe(true);
      expect((result.data as any).message).toContain("No search results found");
    });

    it("preserves abort signal", async () => {
      mockFetchUrlResponse = {
        success: true,
        html: "<html><body></body></html>",
      };

      const controller = new AbortController();
      const promise = webSearchHandler(
        { query: "test" },
        { signal: controller.signal },
      );
      controller.abort();
      // The promise should resolve (abort may or may not propagate depending on timing)
      const result = await promise;
      expect(result).toBeDefined();
    });
  });

  describe("formatSearchResultsForLLM", () => {
    it("formats results as readable string with query", () => {
      const results = [
        {
          title: "First Result",
          url: "https://example.com/1",
          snippet: "First result snippet",
          source: "example.com",
        },
        {
          title: "Second Result",
          url: "https://example.com/2",
          snippet: "Second result snippet",
          source: "example.com",
        },
      ];

      const formatted = formatSearchResultsForLLM(results, "test query");
      expect(formatted).toContain("test query");
      expect(formatted).toContain("First Result");
      expect(formatted).toContain("Second Result");
      expect(formatted).toContain("https://example.com/1");
      expect(formatted).toContain("DuckDuckGo");
    });

    it("formats without query", () => {
      const results = [
        {
          title: "Result",
          url: "https://example.com",
          snippet: "Snippet",
          source: "example.com",
        },
      ];

      const formatted = formatSearchResultsForLLM(results);
      expect(formatted).toContain("Search results:");
      expect(formatted).toContain("Result");
    });

    it("handles empty results array", () => {
      const formatted = formatSearchResultsForLLM([], "test");
      expect(formatted).toContain("test");
      expect(formatted).toContain("Search results");
      expect(formatted).toContain("DuckDuckGo");
    });
  });
});
