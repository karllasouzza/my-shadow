/**
 * URL validation with SSRF prevention.
 * Blocks private/reserved IP ranges, internal hostnames, and non-HTTP schemes.
 */

export function isValidFetchUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!isValidScheme(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    if (isBlockedHostname(hostname)) return false;
    if (isPrivateIPv4(hostname)) return false;
    if (isPrivateIPv6(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function isValidScheme(protocol: string): boolean {
  return protocol === "http:" || protocol === "https:";
}

function isBlockedHostname(hostname: string): boolean {
  const blockedNames = [
    "localhost",
    "local",
    "internal",
    "intranet",
    "corp",
    "home",
  ];
  if (blockedNames.includes(hostname)) return true;
  if (hostname.endsWith(".local")) return true;
  if (hostname.endsWith(".internal")) return true;
  if (hostname.endsWith(".localhost")) return true;
  return false;
}

function isPrivateIPv4(hostname: string): boolean {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return false;
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  if (parts.some((p) => p > 255 || Number.isNaN(p))) return false;
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
}

function isPrivateIPv6(hostname: string): boolean {
  const stripped = hostname.replace(/^\[|\]$/g, "");
  if (stripped === "::1") return true;
  if (stripped === "0:0:0:0:0:0:0:1") return true;
  if (stripped.startsWith("fd") || stripped.startsWith("fc")) return true;
  if (stripped === "::" || stripped === "0:0:0:0:0:0:0:0") return true;
  return false;
}
