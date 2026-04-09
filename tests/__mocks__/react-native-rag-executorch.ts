/**
 * Mock for @react-native-rag/executorch
 * Provides ExecuTorchEmbeddings class
 */

export class ExecuTorchEmbeddings {
  constructor(_config: any) {
    // Mock constructor
  }

  async embed({ text: _text }: { text: string }): Promise<{ embedding: number[] }> {
    const hash = 42;
    return {
      embedding: Array(384)
        .fill(0)
        .map((_, i) => Math.sin(hash + i * 0.1) * 0.1),
    };
  }
}

export default { ExecuTorchEmbeddings };
