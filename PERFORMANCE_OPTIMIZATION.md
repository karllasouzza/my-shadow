# Análise de Otimização: Aceleração de Carregamento e Inferência de Modelos

## 📊 Análise do Log Fornecido

### Métricas Críticas

```
Duração Total: 27.6 segundos
Time-to-First-Token (TTFT): 9.3 segundos ⚠️ CRÍTICO
Processamento do Prompt: 8.78s para 11 tokens = 798ms/token ⚠️ MUITO LENTO
Geração de Tokens: 18.27s para 135 tokens = 135ms/token (razoável)

Resumo:
- 31% do tempo é TTFT
- 32% é processamento do prompt
- 67% é geração de resposta
```

### Problema Principal

**O processamento do prompt é 6x mais lento que a geração de tokens**, indicando que o modelo não está devidamente otimizado para o pipeline de prompt.

---

## 🔴 Gargalos Identificados

### 1. **GPU Acceleration Insuficiente** (MÁXIMA PRIORIDADE)

**Local**: `shared/ai/text-generation/config.ts:19`

```typescript
n_gpu_layers: device.platform === "iOS" ? 99 : device.hasGPU ? 10 : 0,
```

**Problema**:

- Apenas 10 camadas (de ~13-20 do qwen3-0.6b) são offlad para GPU em Android
- O valor 99 para iOS força todas as camadas para GPU, mas Android fica com apenas 10
- Isso força 50-60% do modelo a rodar em CPU

**Impacto**:

- Prompt processing: CPU-bound (lento)
- Token generation: Parcialmente GPU-acelerado (mais rápido)
- Diferença de 798ms vs 135ms/token = **6x de diferença**

**Solução**:

```typescript
// Para qwen3-0.6b (modelo pequeno)
n_gpu_layers: device.hasGPU ? 99 : 0,  // Offload tudo para GPU
```

---

### 2. **Batch Size Subótimo para Mobile**

**Local**: `shared/ai/text-generation/config.ts:17`

```typescript
n_batch: isLowEnd ? 256 : isMid ? 512 : 1024,
```

**Problema**:

- `n_batch=512` (padrão para mid-tier) é grande demais para processamento paralelo de múltiplos tokens
- Causa maior latência no processamento do prompt
- Não há `n_batch_prompt` separado para otimizar prompt vs generation

**Solução**:

```typescript
n_batch: isLowEnd ? 128 : isMid ? 256 : 512,
n_ubatch: isLowEnd ? 128 : isMid ? 256 : 512,  // Micro-batch para mais paralelismo
```

---

### 3. **Flash Attention Overhead em Modelos Pequenos**

**Local**: `shared/ai/text-generation/runtime.ts:95-96`

```typescript
flash_attn: hasGPU,
flash_attn_type: hasGPU ? "on" : "auto",
```

**Problema**:

- Flash Attention é otimizado para modelos grandes (13B+)
- Para modelos pequenos (0.6B), o overhead de ativação pode ser maior que o benefício
- Especialmente lento em prompt processing

**Solução**:

```typescript
// Desativar flash_attn para modelos < 2B
flash_attn: device.availableRAM < 4 || fileSizeBytes < 500_000_000 ? false : hasGPU,
flash_attn_type: hasGPU ? "auto" : "auto",
```

---

### 4. **Detecção de CPU Cores Incorreta**

**Local**: `shared/device.ts:31`

```typescript
cpuCores: 4,  // Hardcoded!
```

**Problema**:

- Todos os devices usam 4 cores, mesmo que tenham 6-8
- Threads são configuradas com base nisso
- Subutiliza hardware moderno

**Solução**:

```typescript
import { maxCpuCores } from "react-native-device-info";

cpuCores: await maxCpuCores().catch(() => 4),
```

---

### 5. **Conservativismo Excessivo em Detecção de RAM**

**Local**: `shared/device.ts:24-25`

```typescript
const isIOS = Platform.OS === "ios";
const availableRAM = Math.max(0, (total - used) / GB - (isIOS ? 1.5 : 2.0));
```

**Problema**:

- Subtrai 1.5GB (iOS) ou 2GB (Android) de buffer
- Reduz RAM disponível reportado
- Força uso de `n_batch` menores desnecessariamente
- Para qwen3-0.6b em device com 6GB, reporta apenas 4GB

**Solução**:

```typescript
// Buffer adaptativo baseado no RAM total
const buffer = device.totalRAM > 8 ? 0.8 : device.totalRAM > 6 ? 1.0 : 1.5;
const availableRAM = Math.max(0, (total - used) / GB - buffer);
```

---

### 6. **Falta de KV Cache Optimization**

**Local**: `shared/ai/text-generation/runtime.ts` (não configurado)

**Problema**:

- KV cache não tem estratégia de compressão (q8, q4)
- KV cache cresce linearmente com context window
- Para contexto de 4096 tokens, KV cache pode ser 300MB+
- Causa memory pressure e GC

**Solução**: Adicionar configuração:

```typescript
const config = buildConfig(device, path);
return {
  ...config,
  cache_type_k: "q8", // Quantize KV cache
  cache_type_v: "q8",
  defrag_thold: 0.1, // Defraga quando 10% fragmentado
};
```

---

### 7. **Sem Warming Up do Modelo**

**Local**: Não existe em `runtime.ts`

**Problema**:

- Primeira inferência é mais lenta (cold start)
- JIT compilation, memory allocation, cache setup
- TTFT poderia ser ~20-30% mais rápido com warmup

**Solução**: Adicionar após load:

```typescript
// Após loadModel() - warmup com prompt pequeno
await this.context.parallel.completion(
  {
    messages: [{ role: "user", content: "Hi" }],
    n_predict: 1,
    temperature: 0.0,
  },
  () => {},
);
```

---

### 8. **Thinking Mode Overhead Não Documentado**

**Local**: `shared/ai/text-generation/runtime.ts:183`

**Problema**:

- `enable_thinking: true` requer camadas extras (causa overhead)
- Processamento de thinking tags via regex é wasteful
- Para qwen3-0.6b, thinking pode ocupar 30-40% da saída

**Solução**:

```typescript
// Desativar thinking por padrão para modelos < 1B
enable_thinking: fileSizeBytes > 800_000_000 && !!options?.enableThinking,
```

---

### 9. **Sem Prompt Caching**

**Local**: Não existe

**Problema**:

- Mesmo prompt é reprocessado sempre que há múltiplas mensagens
- Histórico de chat reprocessado integralmente a cada nova mensagem
- Para conversa com 10 mensagens, 9x waste de processamento

**Solução**: Implementar cache:

```typescript
private promptCache: Map<string, any> = new Map();

// Hash do histórico
const promptHash = hashMessages(messages);
if (this.promptCache.has(promptHash)) {
  // Usar KV cache cached
  return this.streamCompletion(messages, options);
}
```

---

### 10. **Sem Speculative Decoding**

**Local**: Não implementado

**Problema**:

- Cada token é gerado sequencialmente
- Pode-se prever próximos tokens em paralelo
- llama.rn suporta mas não é usado

**Solução**: Habilitar quando disponível:

```typescript
draft_model: device.availableRAM > 4 ? path : undefined,
n_draft: device.availableRAM > 6 ? 5 : 3,
```

---

## 📈 Impacto Estimado das Otimizações

| Otimização          | Impacto            | Dificuldade    | Prioridade |
| ------------------- | ------------------ | -------------- | ---------- |
| 1️⃣ GPU Layers       | -40% TTFT          | ⭐ Fácil       | 🔴 CRÍTICA |
| 2️⃣ Batch Size       | -15% TTFT          | ⭐ Fácil       | 🔴 CRÍTICA |
| 3️⃣ Flash Attention  | -10% TTFT          | ⭐ Fácil       | 🟡 Alta    |
| 4️⃣ CPU Cores        | -5%                | ⭐ Fácil       | 🟡 Média   |
| 5️⃣ RAM Buffer       | -10% latência      | ⭐ Fácil       | 🟡 Média   |
| 6️⃣ KV Cache         | -15% memory        | ⭐⭐ Média     | 🟢 Média   |
| 7️⃣ Warmup           | -20% primeira inf. | ⭐⭐ Média     | 🟢 Baixa   |
| 8️⃣ Thinking Mode    | -30% overhead      | ⭐ Fácil       | 🟡 Alta    |
| 9️⃣ Prompt Cache     | -70% multi-turn    | ⭐⭐⭐ Difícil | 🟢 Futura  |
| 🔟 Speculative Dec. | -25% geração       | ⭐⭐⭐ Difícil | 🟢 Futura  |

**Potencial de melhoria**: ~70% redução em TTFT com otimizações 1-5

---

## 🎯 Implementação Recomendada (Ordem de Prioridade)

### Fase 1: Ganhos Rápidos (30min)

1. ✅ Aumentar `n_gpu_layers` para 99 em Android
2. ✅ Reduzir `n_batch`
3. ✅ Desativar Flash Attention para modelos pequenos
4. ✅ Corrigir detecção de CPU cores
5. ✅ Ajustar buffer de RAM

### Fase 2: Otimizações Médias (2h)

6. ✅ Adicionar KV cache quantization
7. ✅ Model warmup após load
8. ✅ Conditional thinking mode

### Fase 3: Melhorias Avançadas (8h+)

9. 🔄 Implementar prompt caching
10. 🔄 Adicionar speculative decoding

---

## 📋 Métricas para Monitorar

Adicionar logs específicos para medir progresso:

```typescript
// ANTES
INFERENCE:first-token ttf_ms=9302

// DEPOIS (esperado)
INFERENCE:first-token ttf_ms=2500-3500
INFERENCE:gpu-utilization: 85%
INFERENCE:memory-peak: 2.5GB
INFERENCE:prompt-cache-hit: 0/1
```

---

## 🔗 Referências

- [llama.rn Configurações](https://github.com/jhen0409/llama-rs-mobile/blob/main/docs/API.md)
- [llama.cpp Backend Options](https://github.com/ggerganov/llama.cpp/blob/master/common/common.h#L100-L150)
- [Speculative Decoding Papers](https://arxiv.org/abs/2302.01318)
- [Flash Attention Performance](https://github.com/Dao-AILab/flash-attention)
