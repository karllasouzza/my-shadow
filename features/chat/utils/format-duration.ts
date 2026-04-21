/**
 * Formats a duration in seconds as "M:SS" where SS is zero-padded.
 *
 * Examples:
 *   formatDuration(0)    → "0:00"
 *   formatDuration(59)   → "0:59"
 *   formatDuration(60)   → "1:00"
 *   formatDuration(65)   → "1:05"
 *   formatDuration(3600) → "60:00"
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
