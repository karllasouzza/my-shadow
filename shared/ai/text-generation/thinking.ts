import type { StreamEvent, ThinkingState } from "./types";

const THINK_OPEN = "<think>";
const THINK_CLOSE = "</think>";

export function createThinkingState(): ThinkingState {
  return { isInsideThinkBlock: false, reasoning: "", buffer: "" };
}

export function isThinkingSupported(
  supportsReasoning: boolean,
  templateContent?: string,
): boolean {
  if (supportsReasoning) return true;
  return templateContent?.toLowerCase().includes("think") ?? false;
}

export function detectThinkingStart(
  token: string,
  state: ThinkingState,
): boolean {
  const combined = state.buffer + token;
  if (combined.includes(THINK_OPEN)) {
    state.isInsideThinkBlock = true;
    state.buffer = "";
    return true;
  }
  // Buffer partial tag matches
  if (THINK_OPEN.startsWith(combined) && combined.length < THINK_OPEN.length) {
    state.buffer = combined;
  } else {
    state.buffer = "";
  }
  return false;
}

export function detectThinkingEnd(
  token: string,
  state: ThinkingState,
): boolean {
  const combined = state.buffer + token;
  if (combined.includes(THINK_CLOSE)) {
    state.isInsideThinkBlock = false;
    state.buffer = "";
    return true;
  }
  if (
    THINK_CLOSE.startsWith(combined) &&
    combined.length < THINK_CLOSE.length
  ) {
    state.buffer = combined;
  } else {
    state.buffer = "";
  }
  return false;
}

export function processThinkingToken(
  token: string,
  state: ThinkingState,
  enableThinking: boolean,
): StreamEvent | null {
  if (!enableThinking) return null;

  // Already inside a think block
  if (state.isInsideThinkBlock) {
    if (token.includes(THINK_CLOSE)) {
      const parts = token.split(THINK_CLOSE);
      const reasoningPart = parts[0] ?? "";
      state.reasoning += reasoningPart;
      state.isInsideThinkBlock = false;
      // Return final thinking chunk; remaining text handled by caller
      return reasoningPart ? { type: "thinking", token: reasoningPart } : null;
    }
    state.reasoning += token;
    return { type: "thinking", token };
  }

  // Check for opening tag
  if (token.includes(THINK_OPEN)) {
    state.isInsideThinkBlock = true;
    const afterTag = token.split(THINK_OPEN)[1] ?? "";
    if (afterTag) {
      state.reasoning += afterTag;
      return { type: "thinking", token: afterTag };
    }
    return null;
  }

  return null;
}

export function extractThinkingFromText(text: string): {
  cleanText: string;
  reasoning: string;
} {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  let reasoning = "";
  let match: RegExpExecArray | null;

  while ((match = thinkRegex.exec(text)) !== null) {
    reasoning += match[1];
  }

  const cleanText = text.replace(thinkRegex, "").trim();
  return { cleanText, reasoning };
}
