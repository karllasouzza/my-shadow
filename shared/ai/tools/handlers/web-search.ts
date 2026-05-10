import type { ToolRegistration, ToolResult, SearchResult, WebSearchParams, ExecutionContext, FetchUrlFailure } from '../types'
import { toolOk, toolFail } from '../types'
import { fetchUrl } from './fetch-url'
import { decodeHtmlEntities } from '../utils/html-parser'
import { aiDebug, aiError } from '../../log'

export const webSearchDefinition: ToolRegistration = {
  name: 'web_search',
  description: 'Search the web via DuckDuckGo. Returns titles, URLs, and snippets.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      freshness: {
        type: 'string',
        enum: ['day', 'week', 'month', 'year'],
        description: 'Filter results by recency',
      },
      count: { type: 'number', minimum: 1, maximum: 20, default: 10 },
    },
    required: ['query'],
  },
  handler: webSearchHandler,
  enabled: true,
}

export async function webSearchHandler(
  params: Record<string, unknown>,
  context?: ExecutionContext
): Promise<ToolResult> {
  try {
    const { query, freshness, count } = parseParams(params)
    if (!query) return toolFail('EXECUTION_FAILED', 'Search query is required.')

    const url = buildSearchUrl(query, freshness)
    aiDebug('TOOL:web_search', `query="${query}" url=${url}`)

    const fetchResult = await fetchUrl(url, {
      signal: context?.signal,
      timeoutMs: 12_000,
      retryAttempts: 2,
      maxSizeBytes: 3 * 1024 * 1024,
    })

    if (!fetchResult.ok) {
      const failure = fetchResult as FetchUrlFailure
      return mapFetchError(failure.error)
    }

    const results = extractResults(fetchResult.html, count ?? 10)
    if (results.length === 0) {
      return toolOk({ results: [], message: 'No search results found for this query.' })
    }

    const formatted = formatForLLM(results, query)
    return toolOk({ query, freshness, resultCount: results.length, results: formatted })
  } catch (error) {
    aiError('TOOL:web_search:error', (error as Error)?.message ?? String(error))
    return toolFail('EXECUTION_FAILED', 'An unexpected error occurred while searching')
  }
}

function parseParams(params: Record<string, unknown>): WebSearchParams {
  return {
    query: (params['query'] as string)?.trim() ?? '',
    freshness: params['freshness'] as WebSearchParams['freshness'],
    count: (params['count'] as number) ?? 10,
  }
}

function buildSearchUrl(query: string, freshness?: string): string {
  const baseUrl = 'https://html.duckduckgo.com/html/'
  const searchParams = new URLSearchParams({ q: query })

  if (freshness) {
    const map: Record<string, string> = { day: 'd', week: 'w', month: 'm', year: 'y' }
    const dfValue = map[freshness]
    if (dfValue) searchParams.append('df', dfValue)
  }

  return `${baseUrl}?${searchParams.toString()}`
}

function extractResults(html: string, maxCount: number): SearchResult[] {
  const results: SearchResult[] = []
  const regex = /<div[^>]*\bclass\s*=\s*["'][^"']*\bresult\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*\bclass\s*=\s*["'][^"']*\bresult\b|$)/gi

  let match: RegExpExecArray | null
  while ((match = regex.exec(html)) !== null && results.length < maxCount) {
    const parsed = parseResultBlock(match[1])
    if (parsed) results.push(parsed)
  }
  return results
}

function parseResultBlock(block: string): SearchResult | null {
  const titleMatch = block.match(
    /<a[^>]*\bclass\s*=\s*["'][^"']*\bresult__a\b[^"']*["'][^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i
  )
  if (!titleMatch) return null

  const rawUrl = decodeHtmlEntities(titleMatch[1])
  const title = stripHtml(decodeHtmlEntities(titleMatch[2])).trim()
  const url = decodeRedirectUrl(rawUrl)

  if (!url || !title) return null

  const snippetMatch = block.match(
    /<(?:div|a)[^>]*\bclass\s*=\s*["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|a)>/i
  )
  const snippet = snippetMatch
    ? stripHtml(decodeHtmlEntities(snippetMatch[1])).trim()
    : title

  return { title, url, snippet: snippet || title }
}

function formatForLLM(results: SearchResult[], query: string): string {
  const header = `Search results for "${query}":\n\n`
  const items = results
    .map((r, i) => `${i + 1}. [${r.title}](${r.url})\n   ${r.snippet}\n`)
    .join('\n')
  const footer = '\nTip: These results are from DuckDuckGo and may not be exhaustive.'
  return header + items + footer
}

function decodeRedirectUrl(href: string): string | null {
  try {
    if (href.includes('/l/?') && href.includes('uddg=')) {
      const urlParams = new URL(href, 'https://duckduckgo.com').searchParams
      const encoded = urlParams.get('uddg')
      if (encoded) return decodeURIComponent(encoded)
    }
    if (href.startsWith('//')) return 'https:' + href
    if (href.startsWith('http://') || href.startsWith('https://')) return href
    return null
  } catch {
    return null
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
}

function mapFetchError(error: { code: string; message: string }): ToolResult<never> {
  if (error.code === 'TIMEOUT') {
    return toolFail('TIMEOUT', 'Search request timed out. Try a simpler query or check your connection.')
  }
  if (error.code === 'CAPTCHA') {
    return toolFail('BLOCKED', 'Search request was blocked. Please try again later.')
  }
  return toolFail('NETWORK_ERROR', error.message)
}
