import { aiWarn } from "../log";
import type { ContextConfig } from "./types";

const OOM_PATTERNS: readonly string[] = [
  "out of memory",
  "out_of_memory",
  "outofmemory",
  "oom",
  "bad_alloc",
  "std::bad_alloc",
  "failed to allocate",
  "allocation failed",
  "cannot allocate memory",
  "memory exhausted",
  "enomem",
];

export function isOOMError(error: unknown): boolean {
  if (!error) return false;
  try {
    const anyErr = error as Record<string, unknown>;
    const name = String(anyErr?.name ?? "").toLowerCase();
    const message = String(anyErr?.message ?? "").toLowerCase();
    const code = String(anyErr?.code ?? "");
    const errno = anyErr?.errno;

    for (const p of OOM_PATTERNS) {
      if (name.includes(p) || message.includes(p)) return true;
    }

    if (code === "ENOMEM" || code.toLowerCase() === "enomem") return true;
    if (errno === "ENOMEM" || errno === -12) return true;
  } catch {
    // ignore parsing failures
  }
  return false;
}

export function degradeConfig(config: ContextConfig): ContextConfig {
  const degradedCtx = Math.max(512, Math.floor(config.n_ctx / 2));
  const degradedBatch = Math.max(64, Math.floor(config.n_batch / 2));
  const degradedUbatch = Math.max(32, Math.floor(config.n_ubatch / 2));

  aiWarn("OOM:degrade", `n_ctx=${config.n_ctx}->${degradedCtx}`, {
    original: config.n_ctx,
    degraded: degradedCtx,
  });

  return {
    ...config,
    n_ctx: degradedCtx,
    n_batch: degradedBatch,
    n_ubatch: degradedUbatch,
  };
}

export function canRetry(retryCount: number, maxRetries: number = 1): boolean {
  return retryCount < maxRetries;
}
