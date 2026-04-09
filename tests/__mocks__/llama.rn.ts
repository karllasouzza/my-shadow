/**
 * T025-T027: Mock for llama.rn native module
 *
 * Provides mock implementations of llama.rn APIs for testing
 */

export type RNLlamaOAICompatibleMessage = {
  role: string;
  content?: string;
  reasoning_content?: string;
};

export interface NativeTokenizeResult {
  tokens: number[];
}

export interface NativeCompletionResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timings?: {
    predicted_per_token_ms: number;
    predicted_per_second: number;
  };
}

export type TokenData = {
  token: string;
};

export type CompletionParams = {
  prompt?: string;
  messages?: RNLlamaOAICompatibleMessage[];
  n_predict?: number;
  stop?: string[];
};

export type ContextParams = {
  model: string;
  use_mlock?: boolean;
  n_ctx?: number;
  n_gpu_layers?: number;
  embedding?: boolean;
};

// Mock completion response generator
export const mockCompletionText =
  "1. O que voce sente quando observa suas sombras internas?\n2. Como suas emocoes se manifestam em momentos de silencio?\n3. Qual padrao recorrente voce nota em suas interacoes?\n4. O que sua intuicao diz sobre este momento?\n5. Como voce pode integrar este aspecto em sua jornada?";

// Mock LlamaContext class
export class LlamaContext {
  id: number;
  gpu: boolean = false;
  reasonNoGPU: string = "";
  model: any;

  constructor(params: any) {
    this.id = Math.floor(Math.random() * 1000);
    this.model = params.model;
  }

  async completion(
    params: CompletionParams,
    callback?: (data: TokenData) => void,
  ): Promise<NativeCompletionResult> {
    // Simulate streaming if callback provided
    if (callback && mockCompletionText) {
      const words = mockCompletionText.split(" ");
      for (const word of words) {
        callback({ token: word + " " });
      }
    }

    const text = params.prompt ? mockCompletionText : mockCompletionText;
    const tokens = text.split(" ").length;

    return {
      text,
      promptTokens: params.messages?.length ?? 10,
      completionTokens: tokens,
      totalTokens: (params.messages?.length ?? 10) + tokens,
      timings: {
        predicted_per_token_ms: 50,
        predicted_per_second: 20,
      },
    };
  }

  async tokenize(text: string): Promise<NativeTokenizeResult> {
    // Simple word-based tokenization mock
    const tokens = text
      .split(/\s+/)
      .filter(Boolean)
      .map((_, i) => i);
    return { tokens };
  }

  async detokenize(tokens: number[]): Promise<string> {
    return tokens.map((t) => `token${t}`).join(" ");
  }

  async embedding(text: string): Promise<{ embedding: number[] }> {
    // Simple mock embedding - 384 dimensions to match MULTI_QA_MINILM
    const hash = text.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
    return {
      embedding: Array(384)
        .fill(0)
        .map((_, i) => Math.sin(hash + i) * 0.1),
    };
  }

  async release(): Promise<void> {
    // Mock release
  }

  async loadSession(_filepath: string): Promise<any> {
    return {};
  }

  async saveSession(_filepath: string, _options?: any): Promise<number> {
    return 0;
  }

  async clearCache(_clearData?: boolean): Promise<void> {
    // Mock clear cache
  }
}

// Mock initLlama function
let mockContextInstance: LlamaContext | null = null;

export async function initLlama(
  params: ContextParams,
  _onProgress?: (progress: number) => void,
): Promise<LlamaContext> {
  mockContextInstance = new LlamaContext(params);
  return mockContextInstance;
}

export async function releaseAllLlama(): Promise<void> {
  mockContextInstance = null;
}

export async function loadLlamaModelInfo(
  model: string,
): Promise<Record<string, unknown>> {
  return {
    model,
    context_length: 4096,
    embedding_length: 384,
    block_count: 12,
    architecture: "qwen2",
  };
}

export const BuildInfo = {
  number: 1,
  commit: "mock",
};

// Helper to set custom mock response
export function setMockCompletion(text: string): void {
  (moduleExports as any)._mockText = text;
}

const moduleExports = {
  LlamaContext,
  initLlama,
  releaseAllLlama,
  loadLlamaModelInfo,
  BuildInfo,
  setMockCompletion,
  mockCompletionText,
};

export default moduleExports;
