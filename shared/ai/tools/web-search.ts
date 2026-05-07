import type { ToolDefinition, ToolResult } from "@/shared/ai/tools/types";
import { fetchUrl } from "./fetch-url";
import { decodeHtmlEntities } from "./parse-html";

export const webSearchToolDefinition: ToolDefinition = {
  name: "web_search",
  description:
    "Search the web for current information using DuckDuckGo. Returns titles, URLs, and snippets from search results.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      freshness: {
        type: "string",
        enum: ["day", "week", "month", "year"],
        description: "Filter results by recency",
      },
      count: { type: "number", minimum: 1, maximum: 20, default: 10 },
    },
    required: ["query"],
  },
  handler: (params, context) =>
    webSearchHandler(
      params as { query: string; freshness?: string; count?: number },
      context,
    ),
  enabled: true,
};

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export async function webSearchHandler(
  params: {
    query: string;
    freshness?: string;
    count?: number;
  },
  context?: { signal?: AbortSignal },
): Promise<ToolResult> {
  try {
    if (!params.query?.trim()) {
      return { success: false, error: "Search query is required." };
    }

    const baseUrl = "https://html.duckduckgo.com/html/";
    const searchParams = new URLSearchParams({
      q: params.query.trim(),
    });

    if (params.freshness) {
      const freshnessMap: Record<string, string> = {
        day: "d",
        week: "w",
        month: "m",
        year: "y",
      };
      const dfValue = freshnessMap[params.freshness];
      if (dfValue) searchParams.append("df", dfValue);
    }

    const url = `${baseUrl}?${searchParams.toString()}`;

    const webSearchTimeout = 12_000;
    console.log(`[web-search] fetching query="${params.query}" url=${url}`);

    const fetchResult = await fetchUrl(url, {
      signal: context?.signal,
      timeout: webSearchTimeout,
      retryAttempts: 2,
      retryDelayMs: 500,
      maxSizeBytes: 3 * 1024 * 1024,
      onRetry: (attempt, error) => {
        console.warn(
          `[web-search] Retry ${attempt} for ${url}:`,
          error.message,
        );
      },
    });

    console.log(
      `[web-search] fetchResult success=${fetchResult.success}`,
      fetchResult.html,
    );

    if (!fetchResult.success) {
      const timeoutMs = webSearchTimeout;
      const errorMessage =
        fetchResult.errorCode === "TIMEOUT"
          ? `Search request timed out after ${timeoutMs / 1000}s. This may be due to network conditions. Please try a simpler query or check your connection.`
          : fetchResult.errorCode === "CAPTCHA"
            ? "Search request was blocked. Please try again later."
            : fetchResult.error || "Failed to fetch search results";
      return {
        success: false,
        error: errorMessage,
        errorCode: fetchResult.errorCode,
      };
    }

    const results = extractDuckDuckGoResults(
      fetchResult.html,
      params.count || 10,
    );

    if (results.length === 0) {
      return {
        success: true,
        data: {
          results: [],
          message: "No search results found for this query.",
        },
      };
    }

    const formatted = formatSearchResultsForLLM(results, params.query);

    return {
      success: true,
      data: {
        query: params.query,
        freshness: params.freshness,
        resultCount: results.length,
        results: formatted,
      },
    };
  } catch (error) {
    console.error("[web-search] Unexpected error:", error);
    return {
      success: false,
      error: "An unexpected error occurred while searching",
      errorCode: (error as any)?.errorCode,
    };
  }
}

function extractDuckDuckGoResults(
  html: string,
  maxCount: number,
): SearchResult[] {
  const results: SearchResult[] = [];

  const resultRegex =
    /<div[^>]*\bclass\s*=\s*["'][^"']*\bresult\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*\bclass\s*=\s*["'][^"']*\bresult\b|$)/gi;

  let match: RegExpExecArray | null;
  while (
    (match = resultRegex.exec(html)) !== null &&
    results.length < maxCount
  ) {
    const block = match[1];

    const titleMatch = block.match(
      /<a[^>]*\bclass\s*=\s*["'][^"']*\bresult__a\b[^"']*["'][^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!titleMatch) continue;

    const rawUrl = decodeHtmlEntities(titleMatch[1]);
    const title = stripHtml(decodeHtmlEntities(titleMatch[2])).trim();
    const url = resolveDuckDuckGoUrl(rawUrl);

    if (!url || !title) continue;

    const snippetMatch = block.match(
      /<(?:div|a)[^>]*\bclass\s*=\s*["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|a)>/i,
    );
    const snippet = snippetMatch
      ? stripHtml(decodeHtmlEntities(snippetMatch[1])).trim()
      : title;

    results.push({
      title,
      url,
      snippet: snippet || title,
      source: extractHostname(url),
    });
  }

  return results;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function resolveDuckDuckGoUrl(href: string): string | null {
  try {
    if (href.includes("/l/?") && href.includes("uddg=")) {
      const urlParams = new URL(href, "https://duckduckgo.com").searchParams;
      const encoded = urlParams.get("uddg");
      if (encoded) return decodeURIComponent(encoded);
    }

    if (href.startsWith("//")) return "https:" + href;
    if (href.startsWith("http://") || href.startsWith("https://")) return href;

    return null;
  } catch {
    return null;
  }
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function formatSearchResultsForLLM(
  results: SearchResult[],
  originalQuery?: string,
): string {
  const header = originalQuery
    ? `Search results for "${originalQuery}":\n\n`
    : "Search results:\n\n";

  const items = results
    .map(
      (r, i) =>
        `${i + 1}. [${r.title}](${r.url})\n   Source: ${r.source}\n   ${r.snippet}\n`,
    )
    .join("\n");

  const footer =
    "\nTip: These results are from DuckDuckGo and may not be exhaustive.";

  return header + items + footer;
}
