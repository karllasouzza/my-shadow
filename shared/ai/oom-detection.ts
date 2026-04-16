// Utility to heuristically detect out-of-memory conditions from errors
export function isLikelyOOMError(error: unknown): boolean {
  if (!error) return false;
  try {
    const anyErr = error as any;
    const name = (anyErr?.name ?? "").toString().toLowerCase();
    const message = (anyErr?.message ?? "").toString().toLowerCase();
    const code = (anyErr?.code ?? "").toString();
    const errno = anyErr?.errno;

    // Common native / C++ / runtime substrings that indicate OOM
    const patterns = [
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

    for (const p of patterns) {
      if (name.includes(p) || message.includes(p)) return true;
    }

    // Check well-known codes/errno
    if (code === "ENOMEM" || code.toLowerCase() === "enomem") return true;
    if (errno === "ENOMEM" || errno === -12) return true;
  } catch {
    // ignore parsing failures
  }
  return false;
}
