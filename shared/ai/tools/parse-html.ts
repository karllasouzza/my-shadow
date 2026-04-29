export interface ImageInfo {
  src: string;
  alt?: string;
  title?: string;
  width?: string;
  height?: string;
}

export interface VideoInfo {
  src: string;
  poster?: string;
  type?: string;
}

export interface LinkInfo {
  href: string;
  text: string;
  title?: string;
  rel?: string;
}

export interface ParsedContent {
  text: string;
  title?: string;
  description?: string;
  images: ImageInfo[];
  videos: VideoInfo[];
  links: LinkInfo[];
  language?: string;
}

export interface ParseHtmlOptions {
  baseUrl?: string;
  extractOnlySelector?: string;
  removeSelectors?: string[];
  decodeEntities?: boolean;
  normalizeWhitespace?: boolean;
  maxTextLength?: number;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&copy;": "©",
  "&reg;": "®",
  "&trade;": "™",
  "&apos;": "'",
  "&cent;": "¢",
  "&pound;": "£",
  "&yen;": "¥",
  "&euro;": "€",
  "&sect;": "§",
  "&deg;": "°",
  "&plusmn;": "±",
  "&middot;": "·",
  "&mdash;": "—",
  "&ndash;": "–",
  "&laquo;": "«",
  "&raquo;": "»",
  "&lsquo;": "'",
  "&rsquo;": "'",
  "&ldquo;": '"',
  "&rdquo;": '"',
  "&bull;": "•",
  "&hellip;": "…",
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#(?:\d+|x[\da-fA-F]+)|[a-zA-Z]+);/g, (match) => {
    if (match.startsWith("&#")) {
      try {
        if (match[2] === "x" || match[2] === "X") {
          return String.fromCodePoint(parseInt(match.slice(3, -1), 16));
        }
        return String.fromCodePoint(parseInt(match.slice(2, -1), 10));
      } catch {
        return match;
      }
    }
    return HTML_ENTITIES[match.toLowerCase()] ?? match;
  });
}

function resolveUrl(href: string, baseUrl?: string): string {
  if (!baseUrl) return href;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

function extractAttr(attrs: string, name: string): string | undefined {
  const regex = new RegExp(
    `${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]*))`,
    "i",
  );
  const match = attrs.match(regex);
  if (!match) return undefined;
  return decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? "");
}

function extractSection(html: string, selector: string): string {
  // DuckDuckGo uses CSS classes like .result, .links
  const classNames = selector
    .replace(/^\./, "")
    .split(/[\s,]+/)
    .filter(Boolean);

  if (classNames.length === 0) return html;

  // Find the first occurrence of any matching class and extract from there
  const patterns = classNames.map(
    (cls) =>
      new RegExp(
        `<[^>]*class\\s*=\\s*["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>[\\s\\S]*?(?=<(?:div|section|article)[^>]*class\\s*=|$)`,
        "i",
      ),
  );

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[0];
  }

  return html;
}

function removeSelectors(html: string, selectors: string[]): string {
  let result = html;
  for (const sel of selectors) {
    const lower = sel.toLowerCase();
    if (lower === "script") {
      result = result.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    } else if (lower === "style") {
      result = result.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    } else if (lower === "noscript") {
      result = result.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");
    } else if (lower === "header") {
      result = result.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");
    } else if (lower === "footer") {
      result = result.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
    } else if (lower === "nav") {
      result = result.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
    } else if (lower === "svg") {
      result = result.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "");
    } else {
      // Generic tag removal
      const tagRegex = new RegExp(
        `<${lower}[^>]*>[\\s\\S]*?<\\/${lower}>`,
        "gi",
      );
      result = result.replace(tagRegex, "");
    }
  }
  return result;
}

export function parseHtml(
  html: string,
  options?: ParseHtmlOptions,
): ParsedContent {
  const {
    baseUrl,
    extractOnlySelector,
    removeSelectors: removeSels,
    decodeEntities: shouldDecode = true,
    normalizeWhitespace: normalize = true,
    maxTextLength,
  } = options ?? {};

  // Extract subsection if requested
  let workingHtml = html;
  if (extractOnlySelector) {
    workingHtml = extractSection(workingHtml, extractOnlySelector);
  }

  // Remove unwanted tags
  const defaultRemove = ["script", "style", "noscript", "svg"];
  const allRemove = [...defaultRemove, ...(removeSels ?? [])];
  workingHtml = removeSelectors(workingHtml, allRemove);

  // Extract <title>
  const titleMatch = workingHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? decodeHtmlEntities(titleMatch[1].trim())
    : undefined;

  // Extract <html lang>
  const langMatch = workingHtml.match(
    /<html[^>]*\blang\s*=\s*["']([^"']+)["']/i,
  );
  const language = langMatch ? langMatch[1] : undefined;

  // Extract meta description
  const descMatch = workingHtml.match(
    /<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([^"']*)["']/i,
  );
  const description = descMatch ? decodeHtmlEntities(descMatch[1]) : undefined;

  // Extract visible text
  let text = workingHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ");

  if (shouldDecode) {
    text = decodeHtmlEntities(text);
  }

  if (normalize) {
    text = text.replace(/\s+/g, " ").trim();
    // Restore intentional line breaks
    text = text
      .replace(/\n /g, "\n")
      .replace(/ \n/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
  }

  if (maxTextLength && text.length > maxTextLength) {
    text = text.slice(0, maxTextLength) + "...";
  }

  // Extract images
  const images: ImageInfo[] = [];
  const imgRegex = /<img[^>]+src\s*=\s*["']([^"']+)["']([^>]*)>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRegex.exec(workingHtml)) !== null) {
    const src = resolveUrl(decodeHtmlEntities(imgMatch[1]), baseUrl);
    const attrs = imgMatch[2] ?? "";
    images.push({
      src,
      alt: extractAttr(attrs, "alt"),
      title: extractAttr(attrs, "title"),
      width: extractAttr(attrs, "width"),
      height: extractAttr(attrs, "height"),
    });
  }

  // Extract videos
  const videos: VideoInfo[] = [];
  const videoRegex = /<video[^>]*>([\s\S]*?)<\/video>/gi;
  let videoMatch: RegExpExecArray | null;
  while ((videoMatch = videoRegex.exec(workingHtml)) !== null) {
    const videoContent = videoMatch[1];
    const poster = extractAttr(videoMatch[0], "poster");

    // Check for src on video tag itself
    const directSrc = extractAttr(videoMatch[0], "src");
    if (directSrc) {
      videos.push({
        src: resolveUrl(decodeHtmlEntities(directSrc), baseUrl),
        poster: poster ? resolveUrl(poster, baseUrl) : undefined,
      });
    }

    // Check for source child elements
    const sourceRegex = /<source[^>]*>/gi;
    let sourceMatch: RegExpExecArray | null;
    while ((sourceMatch = sourceRegex.exec(videoContent)) !== null) {
      const src = extractAttr(sourceMatch[0], "src");
      const type = extractAttr(sourceMatch[0], "type");
      if (src) {
        videos.push({
          src: resolveUrl(decodeHtmlEntities(src), baseUrl),
          poster: poster ? resolveUrl(poster, baseUrl) : undefined,
          type,
        });
      }
    }
  }

  // Extract links
  const links: LinkInfo[] = [];
  const linkRegex =
    /<a\s+([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRegex.exec(workingHtml)) !== null) {
    const href = resolveUrl(decodeHtmlEntities(linkMatch[2]), baseUrl);
    const innerText = linkMatch[4]
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!href || !innerText) continue;

    const beforeAttrs = linkMatch[1];
    const afterAttrs = linkMatch[3];
    const allAttrs = beforeAttrs + " " + afterAttrs;

    links.push({
      href,
      text: decodeHtmlEntities(innerText),
      title: extractAttr(allAttrs, "title"),
      rel: extractAttr(allAttrs, "rel"),
    });
  }

  return {
    text,
    title,
    description,
    images,
    videos,
    links,
    language,
  };
}
