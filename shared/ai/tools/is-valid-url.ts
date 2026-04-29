/**
 * Validates a URL for fetching, blocking SSRF attempts against internal
 * networks and known-dangerous URL schemes.
 *
 * Blocks:
 * - Non-http/https schemes (file://, data:, javascript:, etc.)
 * - IP addresses in private/reserved ranges (localhost, 127.0.0.1, 10.x.x.x,
 *   172.16-31.x.x, 192.168.x.x, 0.0.0.0, [::1], etc.)
 * - Hostnames that resolve to localhost or internal names (e.g.
 *   "localhost", "internal", "intranet", "corp")
 */
export function isValidFetchUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow http and https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block obviously internal hostnames
    const blockedNames = [
      "localhost",
      "local",
      "internal",
      "intranet",
      "corp",
      "home",
    ];
    if (blockedNames.includes(hostname)) {
      return false;
    }

    // Block hostnames ending with .local, .internal, .localhost
    if (
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".localhost")
    ) {
      return false;
    }

    // Block private/reserved IP ranges
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      const parts = hostname.split(".").map(Number);
      if (parts.length === 4) {
        const [a, b, c, d] = parts;
        // Skip obviously non-IP hostnames
        if (
          a > 255 ||
          b > 255 ||
          c > 255 ||
          d > 255 ||
          Number.isNaN(a) ||
          Number.isNaN(b) ||
          Number.isNaN(c) ||
          Number.isNaN(d)
        ) {
          return true;
        }
        // 127.0.0.0/8
        if (a === 127) return false;
        // 10.0.0.0/8
        if (a === 10) return false;
        // 172.16.0.0/12
        if (a === 172 && b >= 16 && b <= 31) return false;
        // 192.168.0.0/16
        if (a === 192 && b === 168) return false;
        // 0.0.0.0/8
        if (a === 0) return false;
        // 100.64.0.0/10 (CGNAT)
        if (a === 100 && b >= 64 && b <= 127) return false;
        // 169.254.0.0/16 (link-local)
        if (a === 169 && b === 254) return false;
        // 198.18.0.0/15 (benchmarking)
        if (a === 198 && (b === 18 || b === 19)) return false;
      }
    }

    // Block IPv6 loopback and private addresses
    // Bun's URL parser returns hostname with brackets: "[::1]"
    const strippedHostname = hostname.replace(/^\[|\]$/g, "");
    if (
      strippedHostname === "::1" ||
      strippedHostname === "0:0:0:0:0:0:0:1" ||
      strippedHostname.startsWith("fd") ||
      strippedHostname.startsWith("fc") ||
      strippedHostname === "::" ||
      strippedHostname === "0:0:0:0:0:0:0:0"
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
