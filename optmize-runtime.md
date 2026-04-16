Agora tenho informações suficientes para criar um plano de otimização completo para sua runtime `llama.rn` focada em dispositivos com pouca RAM. Vou analisar seu código atual e propor melhorias baseadas nas melhores práticas do `llama.cpp`.

---

## 📊 Análise do Seu Código Atual

### ⚠️ Problemas Identificados

| Problema                                     | Impacto                                      | Severidade |
| -------------------------------------------- | -------------------------------------------- | ---------- |
| `n_ctx: 4096` fixo                           | Alto consumo de memória KV cache             | 🔴 Alta    |
| `n_gpu_layers: 99`                           | Pode causar OOM em dispositivos mobile       | 🔴 Alta    |
| `use_mlock: true`                            | Bloqueia RAM, pode matar o app em low-memory | 🔴 Alta    |
| `flash_attn: true` + `flash_attn_type: "on"` | Redundante, pode causar instabilidade        | 🟡 Média   |
| `n_batch: 512`                               | Alto para mobile (recomendado: 64-128)       | 🟡 Média   |
| `n_threads: 4`                               | Pode ser alto para CPUs mobile               | 🟡 Média   |
| `parallel.enable()` em toda requisição       | Overhead desnecessário para uso single-user  | 🟡 Média   |
| Sem KV cache quantization                    | Memória desperdiçada                         | 🔴 Alta    |
| Sem `use_mmap` explícito                     | Perde otimização de lazy loading             | 🟡 Média   |

---

## 🎯 Plano de Ação de Otimização

### **FASE 1: Configurações de Inicialização (Alto Impacto)**

#### ✅ Checklist - Model Loading

- [ ] **Reduzir `n_ctx` dinamicamente** baseado no dispositivo
  - Dispositivos < 4GB RAM: `n_ctx: 1024`
  - Dispositivos 4-6GB RAM: `n_ctx: 2048`
  - Dispositivos > 6GB RAM: `n_ctx: 4096`

- [ ] **Adicionar `use_mmap: true`** para lazy loading do modelo
  - Reduz uso inicial de RAM em ~40-60%
  - O SO gerencia paginação automaticamente

- [ ] **Desabilitar `use_mlock` em dispositivos mobile**
  - `use_mlock: false` para evitar killing pelo OS
  - Apenas habilitar em dispositivos com RAM abundante

- [ ] **Ajustar `n_gpu_layers` dinamicamente**
  - Detectar VRAM disponível antes de carregar
  - Fallback para CPU se GPU OOM

- [ ] **Reduzir `n_batch` para mobile**
  - Recomendado: `n_batch: 64` ou `128`
  - Impacto positivo na latência de geração

```typescript
// Exemplo de configuração otimizada
const getOptimizedConfig = (deviceInfo: DeviceInfo) => ({
  model: path,
  n_ctx: deviceInfo.ram < 4 ? 1024 : deviceInfo.ram < 6 ? 2048 : 4096,
  n_batch: 64, // Reduzido para mobile
  n_threads: Math.min(4, deviceInfo.cpuCores), // Não exceder cores físicos
  n_gpu_layers: deviceInfo.vram ? 99 : 0, // Só se houver VRAM suficiente
  use_mmap: true, // Essencial para low RAM
  use_mlock: false, // Desabilitar em mobile
  flash_attn: true, // Apenas uma vez
  // NOVOS PARÂMETROS:
  cache_type_k: "q8_0", // KV cache quantization
  cache_type_v: "q8_0", // Reduz memória em ~50%
});
```

---

### **FASE 2: Otimização de Memória KV Cache (Alto Impacto)**

#### ✅ Checklist - KV Cache

- [ ] **Implementar KV Cache Quantization**
  - `cache_type_k: 'q8_0'` e `cache_type_v: 'q8_0'`
  - Reduz uso de memória em ~50% com mínimo impacto na qualidade
  - Alternativa mais agressiva: `q4_0` para contextos muito longos

- [ ] **Considerar K/V assimétrico** (se suportado)
  - Keys em 8-bit, Values em 4-bit (K8V4)
  - 59% redução de memória com apenas 0.86% perda de perplexidade

---

### **FASE 3: Otimização de Execução (Médio Impacto)**

#### ✅ Checklist - Runtime

- [ ] **Remover modo paralelo para uso single-user**
  - Seu app processa uma requisição por vez
  - `parallel.enable()` adiciona overhead desnecessário
  - Use `completion()` direto do contexto

- [ ] **Implementar pooling de contexto**
  - Reutilizar contexto entre requisições quando possível
  - Evita recriação de KV cache a cada chamada

- [ ] **Adicionar `n_ubatch` otimizado**
  - `n_ubatch: 64` (menor que `n_batch` para melhor latência)

- [ ] **Implementar sliding window attention** (opcional)
  - Para contextos muito longos em RAM limitada
  - Descarta tokens antigos automaticamente

---

### **FASE 4: Otimização de Modelo (Alto Impacto)**

#### ✅ Checklist - Modelo

- [ ] **Usar quantização Q4_K_M ou Q3_K_M**
  - Q4_K_M: melhor balanço qualidade/tamanho (~4.3GB para 7B)
  - Q3_K_M: para RAM muito limitada (~3.7GB para 7B)
  - Q5_K_M: se qualidade for crítica (~5GB para 7B)

- [ ] **Considerar modelos menores para mobile**
  - 1B-3B params para dispositivos entry-level
  - 7B params para mid-range
  - 13B+ apenas para flagship

- [ ] **Implementar speculative decoding** (avançado)
  - Usar modelo draft menor (ex: 1.5B) para acelerar 7B
  - Ganho de 2-8x em velocidade

---

### **FASE 5: Gerenciamento de Memória (Alto Impacto)**

#### ✅ Checklist - Memory Management

- [ ] **Implementar monitoramento de memória**
  - Detectar low memory warnings do OS
  - Fazer unload automático do modelo quando necessário

- [ ] **Adicionar `unloadModel()` proativo**
  - Liberar memória quando app vai para background
  - Recarregar quando volta para foreground

- [ ] **Implementar cache de prompts**
  - Reutilizar KV cache de system prompts comuns
  - Reduz prefill time em até 90%

---

## 🎬 Código Otimizado Sugerido

```typescript
import { createError, err, ok, Result } from "@/shared/utils/app-error";
import type {
  LlamaContext,
  RNLlamaOAICompatibleMessage,
  TokenData,
} from "llama.rn";
import { initLlama, loadLlamaModelInfo } from "llama.rn";
import { findModelById } from "./catalog";
import { calculateMetrics, GenerationMetrics } from "./metrics";
import type { ChatMessage } from "./types/chat";
import type {
  CompletionOutput,
  LoadedModel,
  StreamCompletionOptions,
} from "./types/runtime";

let instance: AIRuntime | null = null;

const STOP_WORDS = [
  "</s>",
  "<|end|>",
  "<|eot_id|>",
  "<|end_of_text|>",
  "<|EOT|>",
  "<|END_OF_TURN_TOKEN|>",
  "<|end_of_turn|>",
];

interface DeviceInfo {
  ram: number; // GB
  cpuCores: number;
  vram?: number; // MB, undefined se não houver GPU
}

export class AIRuntime {
  private model: LoadedModel | null = null;
  private context: LlamaContext | null = null;
  private stop: (() => Promise<void>) | null = null;
  private deviceInfo: DeviceInfo;

  constructor() {
    // Detectar capacidades do dispositivo
    this.deviceInfo = this.detectDeviceCapabilities();
  }

  private detectDeviceCapabilities(): DeviceInfo {
    // Implementar detecção real baseada em Platform (React Native)
    // Exemplo simplificado:
    const totalMemory = (global as any).deviceMemory || 4; // GB
    const cpuCores = navigator.hardwareConcurrency || 4;

    // Detectar VRAM (iOS/Android específico)
    const vram = undefined; // Implementar detecção de GPU

    return { ram: totalMemory, cpuCores, vram };
  }

  private getOptimizedContextConfig(modelPath: string) {
    const { ram, cpuCores, vram } = this.deviceInfo;

    // Configurações dinâmicas baseadas na RAM
    const config = {
      model: modelPath,
      // Contexto adaptativo: menos RAM = contexto menor
      n_ctx: ram < 4 ? 1024 : ram < 6 ? 2048 : 4096,
      // Batch menor para mobile reduz pressão de memória
      n_batch: 64,
      // Não exceder cores físicos
      n_threads: Math.min(4, cpuCores),
      // GPU layers só se houver VRAM suficiente
      n_gpu_layers: vram && vram > 2000 ? 99 : 0,
      // ESSENCIAL: mmap para lazy loading (economia de RAM)
      use_mmap: true,
      // DESABILITAR mlock em mobile (evita killing pelo OS)
      use_mlock: false,
      // Flash attention otimizado
      flash_attn: true,
      // KV CACHE QUANTIZATION: reduz memória em ~50%
      cache_type_k: "q8_0" as const,
      cache_type_v: "q8_0" as const,
      // Embedding desabilitado por padrão (economia de memória)
      embedding: false,
    };

    console.log("[AIRuntime] Configuração otimizada:", {
      ram: `${ram}GB`,
      n_ctx: config.n_ctx,
      n_batch: config.n_batch,
      n_threads: config.n_threads,
      gpuLayers: config.n_gpu_layers,
    });

    return config;
  }

  async loadModel(modelId: string, path: string): Promise<Result<LoadedModel>> {
    try {
      await this.unloadModel();
      await loadLlamaModelInfo(path);

      const config = this.getOptimizedContextConfig(path);
      this.context = await initLlama(config);

      this.model = { id: modelId, isLoaded: true };
      return ok(this.model);
    } catch (error) {
      this.model = null;
      this.context = null;
      return err(
        createError(
          "NOT_READY",
          "Falha ao carregar modelo.",
          { modelId, path },
          error as Error,
        ),
      );
    }
  }

  async unloadModel(): Promise<Result<void>> {
    if (!this.context) return ok(undefined);

    await this.cancelGeneration();
    // Sempre tentar desabilitar parallel se estiver ativo
    await this.context.parallel?.disable().catch(() => {});
    this.context = null;
    this.model = null;
    return ok(undefined);
  }

  async streamCompletion(
    messages: ChatMessage[],
    options?: StreamCompletionOptions,
  ): Promise<Result<CompletionOutput>> {
    if (!this.context || !this.model) {
      return err(createError("NOT_READY", "Nenhum modelo carregado."));
    }

    const enableThinking =
      !!options?.enableThinking &&
      (findModelById(this.model.id)?.supportsReasoning ?? false);

    let text = "";
    let reasoning = "";
    let tokenCount = 0;
    let firstTokenTime: number | null = null;
    const messagesForContext = this.sanitizeMessagesForLLMContext(messages);
    const startTime = performance.now();

    const signal = options?.abortSignal;
    const onAbort = () => void this.cancelGeneration();

    try {
      // MODO OTIMIZADO: Usar completion direto em vez de parallel para single-user
      // Isso elimina o overhead de gerenciamento de slots do parallel mode
      const result = await this.context.completion(
        {
          messages: messagesForContext,
          jinja: true,
          enable_thinking: enableThinking,
          thinking_forced_open: enableThinking,
          n_predict: options?.maxTokens ?? 2048, // Reduzido para mobile
          temperature: options?.temperature ?? 0.7,
          stop: STOP_WORDS,
          // DRY penalty reduzido para economizar computação
          dry_penalty_last_n: 32, // Reduzido de 64
        },
        (data: TokenData) => {
          const t = data.token ?? "";
          const r = data.reasoning_content ?? "";
          if (!t && !r) return;

          if (firstTokenTime === null) firstTokenTime = performance.now();

          // Contagem otimizada de tokens
          if (t) tokenCount++;
          if (r) {
            const reasoningTokenCount = r.trim()
              ? r.trim().split(/\s+/).filter(Boolean).length
              : 0;
            tokenCount += reasoningTokenCount;
          }

          text += t;
          reasoning += r;
          options?.onStreamChunk?.({ token: t, reasoning: r || undefined });
        },
      );

      if (signal?.aborted) {
        return err(createError("ABORTED", "Geração cancelada."));
      }

      if (!text.trim() && !reasoning.trim()) {
        return err(
          createError("LOCAL_GENERATION_UNAVAILABLE", "Resposta vazia."),
        );
      }

      const metrics = calculateMetrics(
        startTime,
        firstTokenTime,
        performance.now(),
        tokenCount,
      );

      return ok({ text, reasoning: reasoning || undefined, metrics });
    } catch (error) {
      console.error("Erro durante geração local:", error);
      if ((error as Error).name === "AbortError") {
        return err(createError("ABORTED", "Geração cancelada."));
      }
      return err(
        createError(
          "LOCAL_GENERATION_UNAVAILABLE",
          "Falha ao gerar texto.",
          {},
          error as Error,
        ),
      );
    }
  }

  // ... resto do código permanece igual
}
```

---

## 📈 Métricas de Sucesso

### **KPIs Principais**

| Métrica                       | Antes                  | Depois                       | Meta         |
| ----------------------------- | ---------------------- | ---------------------------- | ------------ |
| **RAM no carregamento**       | ~100% do modelo        | ~40-60% do modelo (com mmap) | -40%         |
| **RAM durante inferência**    | 2-3x tamanho do modelo | 1.5-2x tamanho do modelo     | -50%         |
| **Tokens/segundo**            | Baseline               | +20-40%                      | > baseline   |
| **Tempo de carregamento**     | Baseline               | +50% mais rápido (mmap)      | < 5s para 7B |
| **Contexto máximo (4GB RAM)** | ~1024 tokens           | ~2048 tokens                 | 2x           |
| **Taxa de OOM**               | X%                     | < 1%                         | Mínimo       |

### **Métricas de Qualidade**

| Métrica                | Meta                     |
| ---------------------- | ------------------------ |
| Perplexity degradation | < 2% com KV cache q8_0   |
| Task accuracy (GSM8K)  | < 3% loss com Q4_K_M     |
| User perceived latency | < 500ms para first token |

---

## 🔧 Testes Recomendados

1. **Benchmark de memória**: Monitorar RSS do processo durante carga e inferência
2. **Stress test**: Enviar múltiplas requisições sequenciais e verificar estabilidade
3. **Teste de background**: Verificar se o app não é killed pelo OS
4. **Comparação A/B**: Testar configurações com/sem cada otimização

---

## ⚡ Quick Wins (Implementar Imediatamente)

1. **Trocar `use_mlock: true` → `use_mlock: false`**
2. **Adicionar `use_mmap: true`**
3. **Reduzir `n_batch: 512` → `n_batch: 64`**
4. **Adicionar `cache_type_k: 'q8_0'` e `cache_type_v: 'q8_0'`**
5. **Remover `parallel.enable()` e usar `completion()` direto**

Essas 5 mudanças devem reduzir o uso de RAM em 40-60% sem perda significativa de performance!
