import type {
  ImageInfo,
  LinkInfo,
  ParsedContent,
  ParseHtmlOptions,
  VideoInfo,
} from "../types";

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&copy;": "\u00A9",
  "&reg;": "\u00AE",
  "&trade;": "\u2122",
  "&apos;": "'",
  "&cent;": "\u00A2",
  "&pound;": "\u00A3",
  "&yen;": "\u00A5",
  "&euro;": "\u20AC",
  "&sect;": "\u00A7",
  "&deg;": "\u00B0",
  "&plusmn;": "\u00B1",
  "&middot;": "\u00B7",
  "&mdash;": "\u2014",
  "&ndash;": "\u2013",
  "&laquo;": "\u00AB",
  "&raquo;": "\u00BB",
  "&lsquo;": "\u2018",
  "&rsquo;": "\u2019",
  "&ldquo;": "\u201C",
  "&rdquo;": "\u201D",
  "&bull;": "\u2022",
  "&hellip;": "\u2026",
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#(?:\d+|x[\da-fA-F]+)|[a-zA-Z]+);/g, (match) => {
    if (match.startsWith("&#")) return decodeNumericEntity(match);
    return HTML_ENTITIES[match.toLowerCase()] ?? match;
  });
}

function decodeNumericEntity(match: string): string {
  try {
    const isHex = match[2] === "x" || match[2] === "X";
    const codePoint = isHex
      ? parseInt(match.slice(3, -1), 16)
      : parseInt(match.slice(2, -1), 10);
    return String.fromCodePoint(codePoint);
  } catch {
    return match;
  }
}

export function parseHtml(
  html: string,
  options?: ParseHtmlOptions,
): ParsedContent {
  const {
    extractOnlySelector,
    removeSelectors: removeSels,
    decodeEntities: shouldDecode = true,
    normalizeWhitespace: normalize = true,
    maxTextLength,
  } = options ?? {};

  let workingHtml = extractOnlySelector
    ? extractSection(html, extractOnlySelector)
    : html;

  workingHtml = removeDefaultTags(workingHtml, removeSels);
  const title = extractTitle(workingHtml);
  const description = extractDescription(workingHtml);
  const language = extractLanguage(workingHtml);
  const images = extractImages(workingHtml);
  const videos = extractVideos(workingHtml);
  const links = extractLinks(workingHtml);
  let text = stripTags(workingHtml);

  if (shouldDecode) text = decodeHtmlEntities(text);
  if (normalize) text = normalizeText(text);
  if (maxTextLength && text.length > maxTextLength) {
    text = text.slice(0, maxTextLength) + "...";
  }

  return { title, description, text, language, images, videos, links };
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : "";
}

function extractDescription(html: string): string {
  const match = html.match(
    /<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([^"']*)["']/i,
  );
  return match ? decodeHtmlEntities(match[1]) : "";
}

function extractLanguage(html: string): string {
  const match = html.match(/<html[^>]*\blang\s*=\s*["']([^"']+)["']/i);
  return match ? match[1] : "";
}

function extractImages(html: string): ImageInfo[] {
  const images: ImageInfo[] = [];
  const regex = /<img[^>]+src\s*=\s*["']([^"']+)["']([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    images.push({
      src: decodeHtmlEntities(match[1]),
      alt: extractAttr(match[2], "alt") ?? "",
      title: extractAttr(match[2], "title") ?? "",
      width: extractAttr(match[2], "width") ?? "",
      height: extractAttr(match[2], "height") ?? "",
    });
  }
  return images;
}

function extractVideos(html: string): VideoInfo[] {
  const videos: VideoInfo[] = [];
  const regex = /<video[^>]*>([\s\S]*?)<\/video>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const poster = extractAttr(match[0], "poster") ?? "";
    const directSrc = extractAttr(match[0], "src");
    if (directSrc) {
      videos.push({ src: decodeHtmlEntities(directSrc), type: "", poster });
    }
    extractSourceElements(match[1], poster, videos);
  }
  return videos;
}

function extractSourceElements(
  content: string,
  poster: string,
  videos: VideoInfo[],
): void {
  const regex = /<source[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const src = extractAttr(match[0], "src");
    if (src) {
      videos.push({
        src: decodeHtmlEntities(src),
        type: extractAttr(match[0], "type") ?? "",
        poster,
      });
    }
  }
}

function extractLinks(html: string): LinkInfo[] {
  const links: LinkInfo[] = [];
  const regex =
    /<a\s+([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const href = decodeHtmlEntities(match[2]);
    const text = match[4]
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (href && text) {
      links.push({ href, text: decodeHtmlEntities(text) });
    }
  }
  return links;
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ");
}

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\n /g, "\n")
    .replace(/ \n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function removeDefaultTags(
  html: string,
  extraSelectors?: readonly string[],
): string {
  const defaults = ["script", "style", "noscript", "svg"];
  const all = [...defaults, ...(extraSelectors ?? [])];
  let result = html;
  for (const tag of all) {
    const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    result = result.replace(regex, "");
  }
  return result;
}

function extractSection(html: string, selector: string): string {
  const classNames = selector
    .replace(/^\./, "")
    .split(/[\s,]+/)
    .filter(Boolean);
  if (classNames.length === 0) return html;
  for (const cls of classNames) {
    const pattern = new RegExp(
      `<[^>]*class\\s*=\\s*["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>[\\s\\S]*?(?=<(?:div|section|article)[^>]*class\\s*=|$)`,
      "i",
    );
    const match = html.match(pattern);
    if (match) return match[0];
  }
  return html;
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
