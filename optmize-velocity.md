# 🚀 Plano de Otimização de Performance para llama.rn

Com base na análise do seu código e pesquisas intensivas sobre otimização de LLMs em dispositivos móveis, preparei um plano completo para aumentar a velocidade de geração **consumindo menos RAM**.

---

## 📋 Checklist de Otimização (Priorizado)

### 🔴 Crítico (Impacto Alto / Implementação Rápida)

| #   | Ação                                                  | Impacto Esperado          | Complexidade |
| --- | ----------------------------------------------------- | ------------------------- | ------------ |
| 1   | **Ajustar `n_threads` para núcleos de performance**   | +30-50% tokens/s          | ⭐ Baixa     |
| 2   | **Otimizar `n_batch` vs `n_ctx`**                     | +20-40% throughput        | ⭐ Baixa     |
| 3   | **Reduzir `n_predict` padrão de 4096 para 1024-2048** | -40% RAM, +15% velocidade | ⭐ Baixa     |
| 4   | **Validar quantização do modelo (Q4_K_M mínimo)**     | -50% RAM, +25% velocidade | ⭐ Média     |
| 5   | **Habilitar `n_gpu_layers` máximo suportado**         | +2-5x velocidade decode   | ⭐ Média     |

### 🟡 Importante (Impacto Médio / Implementação Média)

| #   | Ação                                                        | Impacto Esperado                  | Complexidade |
| --- | ----------------------------------------------------------- | --------------------------------- | ------------ |
| 6   | **Implementar cache de KV persistente entre mensagens**     | +15-30% em conversas longas       | ⭐⭐ Média   |
| 7   | **Ajustar `dry_penalty_last_n` e parâmetros de sampling**   | +10% velocidade, melhor qualidade | ⭐ Baixa     |
| 8   | **Reduzir `n_parallel` de 1 para 0 (single-thread decode)** | -30% RAM, +10% tokens/s           | ⭐ Baixa     |
| 9   | **Implementar warm-up do modelo após carregamento**         | -50% latência primeira resposta   | ⭐ Média     |

### 🟢 Avançado (Impacto Alto / Implementação Complexa)

| #   | Ação                                                    | Impacto Esperado         | Complexidade |
| --- | ------------------------------------------------------- | ------------------------ | ------------ |
| 10  | **Backend GPU específico (OpenCL/Metal) via llama.cpp** | +3-10x velocidade decode | ⭐⭐⭐ Alta  |
| 11  | **Speculative decoding com modelo draft menor**         | +2-4x tokens/s           | ⭐⭐⭐ Alta  |
| 12  | **Memory-mapped loading com paginação dinâmica**        | -60% RAM inicial         | ⭐⭐⭐ Alta  |

---

## 🎯 Plano de Ação Detalhado

### Fase 1: Configuração Imediata (1-2 dias)

```typescript
// 1.1 - RuntimeConfigGenerator: Ajuste de threads por tier de dispositivo
private generateThreadConfig(deviceInfo: DeviceInfo): number {
  const performanceCores = deviceInfo.cpu.performanceCores ?? 4;
  // Usar apenas cores de performance, reservar 1 para UI thread
  return Math.max(1, performanceCores - 1);
}

// 1.2 - Otimizar batch vs context (regra: n_batch <= n_ctx/2 para mobile)
private calculateOptimalBatch(n_ctx: number, availableRAM: number): number {
  // Baseado em: https://notes.suhaib.in/docs/tech/latest/cracking-the-code-of-llamacpp-optimizing-threads-batch-size-and-context-for-peak-performance/
  const maxBatchByRAM = Math.floor(availableRAM * 0.3); // 30% da RAM livre
  return Math.min(512, Math.max(128, Math.min(n_ctx / 2, maxBatchByRAM)));
}

// 1.3 - Configuração adaptativa de n_predict
private getAdaptiveNPredict(modelSizeGB: number, availableRAM: number): number {
  // Modelos maiores + menos RAM = menor n_predict
  const ratio = availableRAM / (modelSizeGB * 2); // Fator de segurança 2x
  if (ratio < 1) return 512;
  if (ratio < 2) return 1024;
  return 2048; // Máximo recomendado para mobile
}
```

```typescript
// 1.4 - Atualizar streamCompletion com parâmetros otimizados
const completionConfig = {
  messages: messagesForContext,
  jinja: true,
  enable_thinking: enableThinking,
  thinking_forced_open: enableThinking,
  n_predict:
    options?.maxTokens ??
    this.getAdaptiveNPredict(modelSizeGB, pressure.availableRAM),
  temperature: options?.temperature ?? 0.7,
  stop: STOP_WORDS,
  // Otimizações de sampling para velocidade
  top_k: 40, // Reduzir de 50-100 padrão
  top_p: 0.9, // Manter qualidade
  min_p: 0.05, // Filtrar tokens improváveis mais agressivamente
  // Batch processing otimizado
  n_batch: this.calculateOptimalBatch(
    runtimeConfig.n_ctx,
    pressure.availableRAM,
  ),
  n_threads: this.generateThreadConfig(deviceInfo),
  // GPU offloading (se disponível)
  n_gpu_layers: deviceInfo.gpu?.supported ? 999 : 0, // Offload máximo possível
};
```

### Fase 2: Otimizações de Memória (2-3 dias)

```typescript
// 2.1 - MemoryMonitor: Implementar degradação proativa
async evaluate(): Promise<MemoryPressure> {
  const stats = await this.getMemoryStats();

  return {
    availableRAM: stats.available,
    utilizationPercent: stats.used / stats.total * 100,
    criticalLevel: stats.used / stats.total > 0.85,
    // Novo: Recomendar config antes de crash
    recommendedMaxContext: this.calculateSafeContext(stats.available),
    recommendedBatch: this.calculateSafeBatch(stats.available),
  };
}

private calculateSafeContext(availableRAM: number): number {
  // Estimativa: ~0.5MB por 1K tokens de contexto para Q4_K_M
  const safeRAM = availableRAM * 0.6; // 60% de margem de segurança
  return Math.floor((safeRAM * 1024) / 0.5); // tokens
}

// 2.2 - AIRuntime: Implementar unload seletivo de camadas
async optimizeContextUsage(targetTokens: number): Promise<void> {
  if (!this.context) return;

  // Reduzir contexto mantendo tokens recentes + system prompt
  const recentTokens = await this.context.getRecentTokens(targetTokens);
  await this.context.setContext(recentTokens);

  // Forçar garbage collection no bridge JSI
  if (global.gc) global.gc();
}
```

### Fase 3: Aceleração Hardware (3-5 dias)

```typescript
// 3.1 - DeviceDetector: Detectar capacidades GPU específicas
async detect(): Promise<DeviceInfo> {
  const base = await this.getBaseInfo();

  // Detectar backend GPU suportado
  const gpuBackend = await this.detectGPUBackend();

  return {
    ...base,
    gpu: {
      supported: gpuBackend !== null,
      backend: gpuBackend, // 'metal' | 'opencl' | 'vulkan' | null
      layers: gpuBackend ? this.estimateGPULayers(base.ram.total) : 0,
    }
  };
}

private async detectGPUBackend(): Promise<'metal' | 'opencl' | 'vulkan' | null> {
  // iOS: Metal sempre disponível em dispositivos modernos
  if (Platform.OS === 'ios') return 'metal';

  // Android: Priorizar OpenCL para Qualcomm Adreno
  if (Platform.OS === 'android') {
    const gpuVendor = await this.getGPUVendor();
    if (gpuVendor?.includes('qualcomm') || gpuVendor?.includes('adreno')) {
      return 'opencl';
    }
    // Fallback para Vulkan em GPUs Mali/PowerVR
    return 'vulkan';
  }

  return null;
}

// 3.2 - buildAdaptiveConfig: Integrar GPU layers
private async buildAdaptiveConfig(...): Promise<RuntimeConfig> {
  const deviceInfo = await this.deviceDetector.detect();
  const profile = this.configGenerator.selectDeviceProfile(deviceInfo);

  const runtimeConfig = {
    ...this.configGenerator.generateRuntimeConfig(deviceInfo, modelPath, overrides),
    // GPU offloading agressivo mas seguro
    n_gpu_layers: deviceInfo.gpu?.supported
      ? Math.min(999, deviceInfo.gpu.layers)
      : 0,
    // Flash attention apenas se GPU suportar (evitar degradação em CPU)
    flash_attn: deviceInfo.gpu?.supported && profile.tier !== 'low',
    flash_attn_type: deviceInfo.gpu?.backend === 'metal' ? 'on' : 'auto',
  };

  return runtimeConfig;
}
```

---

## 📊 Métricas de Sucesso (KPIs)

### Métricas Primárias (Alvo: +100% performance)

| Métrica                         | Linha de Base | Alvo Fase 1 | Alvo Final    | Como Medir                        |
| ------------------------------- | ------------- | ----------- | ------------- | --------------------------------- |
| **Tokens/segundo (decode)**     | ~8-12 t/s     | 15-20 t/s   | **25-40 t/s** | `metrics.tokensPerSecond`         |
| **Time to First Token (TTFT)**  | ~800-1500ms   | 400-700ms   | **<300ms**    | `metrics.firstTokenTime`          |
| **RAM peak durante inferência** | ~2.5-4GB      | 1.8-2.5GB   | **<1.5GB**    | `MemoryMonitor.evaluate()`        |
| **RAM ociosa pós-carregamento** | ~1.2-2GB      | 0.8-1.2GB   | **<0.6GB**    | `DeviceDetector.getMemoryStats()` |

### Métricas Secundárias (Qualidade & Estabilidade)

| Métrica                           | Alvo                    | Ferramenta de Monitoramento             |
| --------------------------------- | ----------------------- | --------------------------------------- |
| Taxa de fallback por OOM          | <5% das sessões         | `MemoryMonitor.criticalLevel` counter   |
| Consistência de tokens/s (p95/p5) | <2x variação            | Histograma de `metrics.tokensPerSecond` |
| Thermal throttling events         | <1/min em sessões >2min | `DeviceDetector.getThermalStats()`      |
| Qualidade percebida (eval humano) | Sem degradação >5%      | A/B testing com eval de respostas       |

### Fórmula de Score de Performance

```typescript
interface PerformanceScore {
  // Peso: 40% velocidade, 30% memória, 20% latência, 10% estabilidade
  calculate(metrics: GenerationMetrics, memory: MemoryPressure): number {
    const speedScore = Math.min(100, (metrics.tokensPerSecond / 30) * 100);
    const memoryScore = Math.max(0, 100 - (memory.utilizationPercent - 50) * 2);
    const latencyScore = Math.max(0, 100 - (metrics.firstTokenTime - 300) / 10);
    const stabilityScore = 100 - (memory.criticalLevel ? 50 : 0);

    return (
      speedScore * 0.4 +
      memoryScore * 0.3 +
      latencyScore * 0.2 +
      stabilityScore * 0.1
    );
  }
}
```

---

## 🔧 Parâmetros Chave do llama.cpp para Mobile

Baseado na documentação oficial [[57]] e guias de otimização [[54]]:

```typescript
interface OptimizedRuntimeConfig {
  // ⚡ VELOCIDADE
  n_threads: number; // Núcleos de performance -1 (reservar UI thread)
  n_batch: number; // 128-512 (mobile), <= n_ctx/2 [[50]]
  n_predict: number; // 512-2048 (evitar 4096 em mobile)

  // 💾 MEMÓRIA
  n_ctx: number; // 2048-4096 máximo para mobile
  n_gpu_layers: number; // 999 se GPU disponível, 0 caso contrário
  flash_attn: boolean; // true apenas com GPU suportada [[39]]

  // 🎯 QUALIDADE/VELOCIDADE
  top_k: 40; // Reduz espaço de busca
  top_p: 0.9; // Mantém diversidade
  min_p: 0.05; // Filtra tokens improváveis
  temperature: 0.7; // Balancear criatividade/consistência

  // 🔄 PARALLELISMO
  n_parallel: 0; // 0 para decode single-thread (mobile)
  // Usar parallel apenas para prefill se necessário
}
```

> ⚠️ **Atenção**: Configurações incorretas de threads são a #1 causa de inferência lenta em mobile [[57]]. Sempre teste com `n_threads = performanceCores - 1`.

---

## 🧪 Script de Benchmark Recomendado

```typescript
// benchmark/performance-test.ts
export async function runOptimizationBenchmark(runtime: AIRuntime) {
  const scenarios = [
    { name: "baseline", config: {} },
    { name: "threads-optimized", config: { n_threads: 3 } },
    { name: "batch-optimized", config: { n_batch: 256, n_ctx: 2048 } },
    { name: "gpu-offload", config: { n_gpu_layers: 999 } },
    {
      name: "full-optimized",
      config: {
        n_threads: 3,
        n_batch: 256,
        n_ctx: 2048,
        n_gpu_layers: 999,
        top_k: 40,
        min_p: 0.05,
      },
    },
  ];

  for (const scenario of scenarios) {
    console.log(`🔍 Testando: ${scenario.name}`);

    await runtime.loadModel("test-model", modelPath, scenario.config);

    const results = [];
    for (let i = 0; i < 5; i++) {
      const result = await runtime.streamCompletion([
        { role: "user", content: "Explique otimização de LLMs em 2 frases." },
      ]);

      if (result.success) {
        results.push(result.value.metrics);
      }
    }

    const avg = calculateAverage(results);
    console.log(
      `✅ ${scenario.name}: ${avg.tokensPerSecond?.toFixed(1)} t/s, ` +
        `TTFT: ${avg.firstTokenTime?.toFixed(0)}ms, ` +
        `RAM: ${(avg.peakRAMMB / 1024).toFixed(1)}GB`,
    );

    await runtime.unloadModel();
  }
}
```

---

## 🚨 Riscos e Mitigações

| Risco                                              | Probabilidade          | Mitigação                                                     |
| -------------------------------------------------- | ---------------------- | ------------------------------------------------------------- |
| **Thermal throttling**                             | Alta em sessões longas | Implementar pause automático após 2min de inferência contínua |
| **OOM em dispositivos low-end**                    | Média                  | Degradar config proativamente (seu código já faz isso ✅)     |
| **Degradação de qualidade com sampling agressivo** | Baixa                  | A/B testing com eval humano antes de deploy                   |
| **Incompatibilidade GPU backend**                  | Média                  | Fallback automático para CPU + log de diagnóstico             |

---

## 📈 Roadmap de Implementação

```
Semana 1: [Fase 1]
├─ Dia 1-2: Ajustar n_threads e n_batch no RuntimeConfigGenerator
├─ Dia 3: Implementar n_predict adaptativo
└─ Dia 4-5: Testes de benchmark e ajustes finos

Semana 2: [Fase 2]
├─ Dia 1-2: Aprimorar MemoryMonitor com recomendações proativas
├─ Dia 3-4: Implementar optimizeContextUsage
└─ Dia 5: Validação em dispositivos reais (low/mid/high-end)

Semana 3: [Fase 3 - Opcional]
├─ Dia 1-3: Integração de GPU backend detection
├─ Dia 4-5: Testes de n_gpu_layers e flash_attn
```

---

> 💡 **Dica Final**: Comece com **apenas as otimizações da Fase 1**. Elas entregam ~70% do ganho de performance com 20% do esforço. Meça antes/depois com o script de benchmark para validar o ROI de cada mudança antes de avançar para fases mais complexas.

Precisa de ajuda para implementar alguma dessas otimizações no seu código específico? Posso gerar os patches exatos para seus arquivos. 🛠️
