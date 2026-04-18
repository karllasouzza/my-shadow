const ENABLE_AIRUNTIME_LOGS =
  (typeof __DEV__ !== "undefined" && __DEV__) ||
  process?.env?.DEBUG_AIRUNTIME === "true";

type Meta = Record<string, unknown> | undefined;

export function aiLog(
  level: "info" | "warn" | "error" | "debug",
  tag: string,
  message: string,
  meta?: Meta,
) {
  if (!ENABLE_AIRUNTIME_LOGS) return;
  const ts = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  const line = `[AIRuntime] [${level.toUpperCase()}] ${ts} ${tag} - ${message}${metaStr}`;
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const aiDebug = (tag: string, message: string, meta?: Meta) =>
  aiLog("debug", tag, message, meta);
export const aiInfo = (tag: string, message: string, meta?: Meta) =>
  aiLog("info", tag, message, meta);
export const aiWarn = (tag: string, message: string, meta?: Meta) =>
  aiLog("warn", tag, message, meta);
export const aiError = (tag: string, message: string, meta?: Meta) =>
  aiLog("error", tag, message, meta);

export default aiLog;
