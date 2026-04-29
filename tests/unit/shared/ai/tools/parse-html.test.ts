import { decodeHtmlEntities, parseHtml } from "@/shared/ai/tools/parse-html";
import { describe, expect, it } from "bun:test";

describe("decodeHtmlEntities", () => {
  it("decodes common HTML entities", () => {
    expect(decodeHtmlEntities("&amp;")).toBe("&");
    expect(decodeHtmlEntities("&lt;")).toBe("<");
    expect(decodeHtmlEntities("&gt;")).toBe(">");
    expect(decodeHtmlEntities("&quot;")).toBe('"');
    expect(decodeHtmlEntities("&nbsp;")).toBe(" ");
    expect(decodeHtmlEntities("&copy;")).toBe("©");
  });

  it("decodes numeric entities", () => {
    expect(decodeHtmlEntities("&#60;")).toBe("<");
    expect(decodeHtmlEntities("&#62;")).toBe(">");
    expect(decodeHtmlEntities("&#38;")).toBe("&");
  });

  it("decodes hex entities", () => {
    expect(decodeHtmlEntities("&#x3C;")).toBe("<");
    expect(decodeHtmlEntities("&#x3E;")).toBe(">");
    expect(decodeHtmlEntities("&#x26;")).toBe("&");
  });

  it("returns unknown entities unchanged", () => {
    expect(decodeHtmlEntities("&unknown;")).toBe("&unknown;");
    expect(decodeHtmlEntities("&bogus;")).toBe("&bogus;");
  });

  it("handles text without entities", () => {
    expect(decodeHtmlEntities("Hello World")).toBe("Hello World");
    expect(decodeHtmlEntities("")).toBe("");
  });
});

describe("parseHtml", () => {
  it("extracts title and meta description", () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>My Test Page</title>
  <meta name="description" content="This is a test page">
</head>
<body><p>Hello world</p></body>
</html>`;
    const parsed = parseHtml(html);
    expect(parsed.title).toBe("My Test Page");
    expect(parsed.description).toBe("This is a test page");
    expect(parsed.language).toBe("en");
  });

  it("removes script and style tags", () => {
    const html = `<html><head>
  <script>alert('xss')</script>
  <style>.hidden{display:none}</style>
</head><body><p>Visible text</p></body></html>`;
    const parsed = parseHtml(html);
    expect(parsed.text).not.toContain("alert");
    expect(parsed.text).not.toContain(".hidden");
    expect(parsed.text).toContain("Visible text");
  });

  it("extracts images with src and alt", () => {
    const html = `<html><body>
  <img src="https://example.com/image.jpg" alt="Example Image">
  <img src="/relative/pic.png" alt="Relative">
</body></html>`;
    const parsed = parseHtml(html, { baseUrl: "https://example.com" });
    expect(parsed.images).toHaveLength(2);
    expect(parsed.images[0].src).toBe("https://example.com/image.jpg");
    expect(parsed.images[0].alt).toBe("Example Image");
    expect(parsed.images[1].src).toBe("https://example.com/relative/pic.png");
    expect(parsed.images[1].alt).toBe("Relative");
  });

  it("extracts links with href and text", () => {
    const html = `<html><body>
  <a href="https://example.com/page1">Page One</a>
  <a href="/page2" title="Page Two">Second Page</a>
</body></html>`;
    const parsed = parseHtml(html, { baseUrl: "https://example.com" });
    // Skip links without text (empty text after tag stripping)
    const validLinks = parsed.links.filter((l) => l.text.length > 0);
    expect(validLinks.length).toBeGreaterThanOrEqual(2);
    const link1 = validLinks.find(
      (l) => l.href === "https://example.com/page1",
    );
    expect(link1).toBeDefined();
    expect(link1!.text).toBe("Page One");

    const link2 = validLinks.find(
      (l) => l.href === "https://example.com/page2",
    );
    expect(link2).toBeDefined();
    expect(link2!.text).toBe("Second Page");
    expect(link2!.title).toBe("Page Two");
  });

  it("respects maxTextLength option", () => {
    const html = `<html><body><p>${"A".repeat(1000)}</p></body></html>`;
    const parsed = parseHtml(html, { maxTextLength: 50 });
    expect(parsed.text.length).toBeLessThanOrEqual(53); // 50 + "..."
    expect(parsed.text).toMatch(/\.\.\.$/);
  });

  it("respects removeSelectors option", () => {
    const html = `<html><body>
  <nav>Navigation content</nav>
  <header>Header content</header>
  <div id="main">Main content</div>
  <footer>Footer content</footer>
</body></html>`;
    const parsed = parseHtml(html, {
      removeSelectors: ["nav", "header", "footer"],
    });
    expect(parsed.text).not.toContain("Navigation");
    expect(parsed.text).not.toContain("Header");
    expect(parsed.text).not.toContain("Footer");
    expect(parsed.text).toContain("Main content");
  });

  it("normalizes whitespace by default", () => {
    const html = `<html><body>
  <p>Hello    world</p>
  <p>  Spaced out  </p>
</body></html>`;
    const parsed = parseHtml(html);
    expect(parsed.text).toContain("Hello world");
    expect(parsed.text).toContain("Spaced out");
  });

  it("handles empty HTML gracefully", () => {
    const parsed = parseHtml("");
    expect(parsed.text).toBe("");
    expect(parsed.images).toEqual([]);
    expect(parsed.videos).toEqual([]);
    expect(parsed.links).toEqual([]);
    expect(parsed.title).toBeUndefined();
  });

  it("extracts DuckDuckGo-style redirect links", () => {
    const html = `<html><body>
  <div class="result">
    <h2><a class="result__a" href="/l/?kh=-1&uddg=aHR0cHM6Ly9leGFtcGxlLmNvbS9hcnRpY2xlMQ==">Example Article One</a></h2>
    <div class="result__snippet">This is a sample snippet.</div>
  </div>
</body></html>`;
    const parsed = parseHtml(html, { baseUrl: "https://duckduckgo.com" });
    const resultLinks = parsed.links.filter(
      (l) => l.href.startsWith("https://") || l.href.startsWith("/l/?"),
    );
    expect(resultLinks.length).toBeGreaterThan(0);
    const link = resultLinks[0];
    expect(link.text).toBe("Example Article One");
  });
});
