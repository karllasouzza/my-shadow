export interface GenerationMetrics {
  tttf: number; // Time to first token (ms)
  totalDuration: number;
  tokenCount: number;
  tokensPerSecond: number;
}

export function calculateMetrics(
  startTime: number,
  firstTokenTime: number | null,
  endTime: number,
  tokenCount: number,
): GenerationMetrics {
  const totalDuration = endTime - startTime;
  const tttf =
    firstTokenTime !== null ? firstTokenTime - startTime : totalDuration;
  const tokensPerSecond =
    totalDuration > 0 ? (tokenCount / totalDuration) * 1000 : 0;

  return {
    tttf: Math.round(tttf * 100) / 100,
    totalDuration: Math.round(totalDuration * 100) / 100,
    tokenCount,
    tokensPerSecond: Math.round(tokensPerSecond * 100) / 100,
  };
}
