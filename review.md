# Code Review: @shared - Detecção de Device e Arquitetura de IA Local

## Resumo Executivo

Baseado na documentação técnica que você compartilhou sobre **Text Generation** e **Architecture** para LLMs em React Native, analisei todo o código do `@shared`. Minha recomendação principal é:

### ✅ **SIM, simplifique a detecção para focar em RAM + GPU**

A detecção atual está **superdimensionada**. CPU brand/performance cores têm impacto marginal comparado a RAM disponível e GPU backend para inferência LLM em mobile.

---

## 1. Problemas Críticos Identificados

### 🔴 **1.1 Detecção de CPU é Complexidade Desnecessária**

**Arquivo:** `/workspace/shared/device/detector.ts` e `hardware-database.ts`

```typescript
// Código atual - complexo e de baixo valor
const cpuProfile = resolveCpuProfile(state.brand);
const performanceCores = Math.max(
  2,
  Math.ceil(state.cpuCores * cpuProfile.performanceCoreRatio),
);
```

**Problema:**

- A razão de performance cores (`0.375` vs `0.5`) faz diferença mínima na prática
- `llama.cpp` usa threads de forma diferente - não mapeia 1:1 com cores físicos
- O artigo técnico menciona: _"Memory bandwidth is the bottleneck, not compute"_

**Impacto:** Falso senso de precisão. Um Snapdragon 8 Gen 2 com 8GB RAM performa similar a um A17 Pro com 8GB RAM se ambos tiverem a mesma RAM disponível.

---

### 🔴 **1.2 Cálculo de RAM Está Otimista Demais**

**Arquivo:** `/workspace/shared/device/detector.ts`

```typescript
// Linha 14-15
const availableRAM =
  Math.max(0, state.totalRAMBytes - state.usedRAMBytes - OS_OVERHEAD_BYTES) /
  BYTES_TO_GB;
```

**Problema:**

- `OS_OVERHEAD_BYTES = 0.8 GB` está subestimado
- Artigo técnico diz: _"iOS typically reserves 1-2GB, Android 1.5-3GB"_
- Seu código usa 0.8GB para ambos → risco de OOM em devices com 6GB RAM

**Recomendação:**

```typescript
const osOverhead = Platform.OS === "ios" ? 1.5e9 : 2e9; // 1.5GB iOS, 2GB Android
```

---

### 🔴 **1.3 GPU Detection Não Considera Vulkan no Android**

**Arquivo:** `/workspace/shared/device/hardware-database.ts`

```typescript
const GPU_PROFILES: Record<string, GpuProfile> = {
  ios: { type: "metal", backend: "metal", vramFraction: 1.0 },
  adreno: { type: "adreno", backend: "opencl", vramFraction: 0.3 },
  mali: { type: "mali", backend: "vulkan", vramFraction: 0.25 },
};
```

**Problema:**

- Artigo técnico: _"Vulkan backend is emerging as more stable than OpenCL on newer Snapdragon chips (8 Gen 2+)"_
- Você está forçando Adreno a usar OpenCL, quando Vulkan pode ser mais estável
- Não há detecção de versão do chipset

**Recomendação:** Adicionar fallback para Vulkan em Snapdragon 8 Gen 2+:

```typescript
if (brand.includes('snapdragon') && osVersion >= /* detectar versão */) {
  return { type: "adreno", backend: "vulkan", vramFraction: 0.35 };
}
```

---

### 🔴 **1.4 Flash Attention Ativado sem Validação Adequada**

**Arquivo:** `/workspace/shared/ai/runtime.ts`

```typescript
// Linha 52-53
this.context = await initLlama({
  ...runtimeConfig,
  flash_attn: hasGPU, // ← PERIGOSO
  flash_attn_type: deviceInfo.gpuBackend === "metal" ? "on" : "auto",
});
```

**Problema Crítico:**

- Artigo técnico alerta: _"Flash Attention requires specific tensor layouts. The crash mentioned happens because llama.cpp's Flash Attention kernels don't support all GPU layer configurations on Adreno."_
- **Solução recomendada:** `flash_attn: false` para Android, `flash_attn: true` apenas para iOS Metal

**Correção:**

```typescript
flash_attn: deviceInfo.platform === 'ios' && hasGPU,
flash_attn_type: deviceInfo.platform === 'ios' ? "on" : "off",
```

---

## 2. O Que Manter vs Simplificar

### ✅ **MANTER (Essencial)**

| Componente                            | Por Que Manter                                                  |
| ------------------------------------- | --------------------------------------------------------------- |
| **RAM total/disponível**              | Fator #1 para determinar se modelo cabe na memória              |
| **GPU backend (Metal/Vulkan/OpenCL)** | Determina aceleração possível e quantos layers offload          |
| **Platform (iOS/Android)**            | Comportamentos nativos diferentes (background, memory warnings) |
| **MemoryMonitor**                     | Sistema de avaliação contínua de pressão de memória é excelente |
| **OOM Detection**                     | Heurística de detecção de out-of-memory é sólida                |
| **Singleton AIRuntime**               | Padrão correto para evitar double-load e SIGSEGV                |

---

### ❌ **SIMPLIFICAR OU REMOVER**

| Componente                               | Ação Recomendada                                        | Justificativa                             |
| ---------------------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| **cpuBrand**                             | Remover ou tornar opcional                              | Não afeta decisão de qual modelo carregar |
| **performanceCores**                     | Simplificar para `Math.min(cpuCores, 8)`                | Ratio por brand é falso refinamento       |
| **gpuMemoryMB calculado**                | Usar apenas se API nativa fornecer valor real           | Calcular como fração da RAM é impreciso   |
| **deviceModel/osVersion**                | Manter apenas para logging/debug                        | Não usamos para decisões de runtime       |
| **DeviceTier (budget/midRange/premium)** | Substituir por cálculo direto baseado em RAM disponível | Tiers criam falsos limites artificiais    |

---

## 3. Mudanças Específicas Recomendadas

### 📝 **3.1 Refatorar `detectCapabilities` para Foco em RAM/GPU**

**Arquivo:** `/workspace/shared/device/detector.ts`

```typescript
// NOVA VERSÃO SIMPLIFICADA
export async function detectCapabilities(
  deps: DetectionDeps,
): Promise<DeviceInfo> {
  const state = await deps.getSystemState();

  // Overhead correto por plataforma
  const osOverhead = deps.platform === "ios" ? 1.5e9 : 2e9;
  const availableRAM = Math.max(
    0,
    state.totalRAMBytes - state.usedRAMBytes - osOverhead,
  );

  // GPU detection simplificada
  const gpuProfile = resolveGpuProfile(deps.platform, state.brand);

  return {
    totalRAM: state.totalRAMBytes / BYTES_TO_GB,
    availableRAM: availableRAM / BYTES_TO_GB,
    // Mantém cpuCores apenas para n_threads, sem brand
    cpuCores: Math.min(state.cpuCores, 8),
    hasGPU: gpuProfile.backend !== null && availableRAM > 1e9, // 1GB mínimo
    gpuBackend: gpuProfile.backend,
    platform: deps.platform,
    detectedAt: Date.now(),
  };
}
```

---

### 📝 **3.2 Atualizar `hardware-database.ts` para Vulkan no Android Moderno**

```typescript
// Detectar Android version para Vulkan
export function resolveGpuProfile(
  platform: "ios" | "android",
  brand?: string,
  osVersion?: string,
): GpuProfile {
  if (platform === "ios") return GPU_PROFILES.ios;

  // Snapdragon 8 Gen 2+ (2023+) suporta Vulkan melhor que OpenCL
  const isModernSnapdragon =
    brand?.toLowerCase().includes("snapdragon") &&
    osVersion &&
    parseInt(osVersion) >= 13; // Android 13+

  if (isModernSnapdragon) {
    return { type: "adreno", backend: "vulkan", vramFraction: 0.35 };
  }

  const key = Object.keys(GPU_PROFILES).find((k) =>
    brand?.toLowerCase().includes(k),
  );
  return key
    ? GPU_PROFILES[key]
    : { type: "unknown", backend: "vulkan", vramFraction: 0.3 }; // Vulkan como default
}
```

---

### 📝 **3.3 Corrigir Memory Budget Calculation**

**Artigo técnico fornece fórmula exata:**

```
Total RAM = Model Weights + KV Cache + Working Activations + Overhead
```

**Seu código atual em `memory-monitor.ts` usa heurística simples demais:**

```typescript
// Linha 72-74 - muito simplista
const safeTokens = Math.floor(
  (availableRAM * SAFE_MEMORY_FRACTION) / bytesPerToken,
);
```

**Melhor abordagem:**

```typescript
// Adicionar ao RuntimeConfigGenerator
calculateMemoryBudget(modelSizeGB: number, contextSize: number): number {
  const kvCacheGB = (2 * 32 * contextSize * 4096 * 2) / (1024 ** 3); // f16
  const workingMemGB = modelSizeGB * 0.15; // 15% overhead
  const overheadGB = 0.5; // gráficos ggml, vocabulário

  return modelSizeGB + kvCacheGB + workingMemGB + overheadGB;
}
```

---

### 📝 **3.4 Implementar Pre-flight Check Antes de Load**

**Adicionar ao `model-loader.ts`:**

```typescript
export async function loadModel(modelId: string): Promise<ModelLoadResult> {
  const model = findModelById(modelId);
  if (!model) return { success: false, error: "Modelo não encontrado." };

  // NEW: Pre-flight memory check com cálculo preciso
  const deviceInfo = await detectDevice();
  const requiredRAM = calculateMemoryBudget(
    model.fileSizeBytes / 1024 ** 3,
    2048, // contexto padrão
  );

  if (deviceInfo.availableRAM < requiredRAM) {
    return {
      success: false,
      error: `RAM insuficiente: ${deviceInfo.availableRAM.toFixed(1)}GB disponível, ${requiredRAM.toFixed(1)}GB necessário.`,
    };
  }

  // ... resto do código
}
```

---

## 4. Checklist de Implementação Baseado no Artigo

O artigo fornece um **Summary Checklist for Implementation**. Veja o que você já tem vs o que falta:

| Item                                 | Status          | Localização                                                   |
| ------------------------------------ | --------------- | ------------------------------------------------------------- |
| ✅ Testar em device 6GB RAM          | ⚠️ Parcial      | `device-profiles.ts` tem budget tier mas overhead está errado |
| ✅ Verificar behavior em background  | ✅ Implementado | `memory-monitor.ts` com AppState listener                     |
| ✅ Testar double-load scenario       | ✅ Implementado | `AIRuntime` singleton com mutex via `isLoading`               |
| ✅ Memory warning listeners          | ⚠️ Parcial      | Tem `evaluate()` mas não usa `onTrimMemory` nativo do Android |
| ❌ Exclude from backup (iOS)         | **FALTA**       | Adicionar `excludesFromBackup = true` nos arquivos de modelo  |
| ❌ SHA256 verification post-download | **FALTA**       | `manager.ts` baixa mas não verifica integridade               |
| ❌ Airplane mode test                | ⚠️ Não testado  | Assumindo que funciona offline mas não há teste explícito     |

---

## 5. Arquitetura: Service-Store Pattern

**Você já implementou corretamente!**

- ✅ `AIRuntime` como singleton service
- ✅ Separação entre service (native) e store (Zustand presumivelmente)
- ✅ Geração em background desacoplada do lifecycle do componente

**Única melhoria sugerida:**

Adicionar **EventEmitter** para notificações de progresso em tempo real:

```typescript
// Em AIRuntime
private eventEmitter = new EventEmitter();

async streamCompletion(messages: ChatMessage[], options?: StreamCompletionOptions){
  // ...
  this.eventEmitter.emit('token', { token, reasoning });
  // ...
}

subscribeToGeneration(callback: (data: any) => void){
  return this.eventEmitter.on('token', callback);
}
```

---

## 6. Quantização de Cache: Sua Implementação Está Boa

**Arquivo:** `/workspace/shared/ai/cache-quantization.ts`

✅ Você já suporta `f16`, `q8_0`, `q4_0`
✅ Warn quando Q4_0 causa perda de qualidade (8-15%)
✅ Fallback para f16 se tipo inválido

**Alinhado com artigo:** _"Use q8_0 for cache if doing coding tasks, q4_0 for general chat"_

**Sugestão:** Adicionar opção por tipo de tarefa:

```typescript
buildCacheQuantizationParams(taskType: 'coding' | 'chat'): {
  cache_type_k: taskType === 'coding' ? 'q8_0' : 'q4_0',
  cache_type_v: taskType === 'coding' ? 'q8_0' : 'q4_0',
}
```

---

## 7. Conclusão e Prioridades

### 🎯 **Prioridade 1 (Crítico - Fix Imediato)**

1. **Corrigir OS_OVERHEAD_BYTES** para 1.5GB (iOS) / 2GB (Android)
2. **Desativar Flash Attention no Android** ou validar chipset antes
3. **Implementar pre-flight memory check** com cálculo preciso de RAM necessária

### 🎯 **Prioridade 2 (Importante - Próxima Sprint)**

4. **Simplificar detecção de CPU** → remover brand/performanceCoreRatio
5. **Adicionar Vulkan fallback** para Snapdragon modernos
6. **Implementar SHA256 verification** pós-download de modelos

### 🎯 **Prioridade 3 (Nice-to-have)**

7. **Excluir modelos do iCloud backup** (`excludesFromBackup = true`)
8. **Adicionar task-type aware cache quantization** (coding vs chat)
9. **Logging de deviceModel/osVersion** apenas para debug, não decisões

---

## 8. Código Final Recomendado para `detector.ts`

```typescript
import { resolveGpuProfile } from "./hardware-database";
import { DetectionDeps, DeviceInfo } from "./types";

const BYTES_TO_GB = 1024 ** 3;

export async function detectCapabilities(
  deps: DetectionDeps,
): Promise<DeviceInfo> {
  const state = await deps.getSystemState();

  // Overhead correto por plataforma (baseado em dados reais)
  const osOverhead = deps.platform === "ios" ? 1.5e9 : 2e9;
  const availableRAMBytes = Math.max(
    0,
    state.totalRAMBytes - state.usedRAMBytes - osOverhead,
  );

  const gpuProfile = resolveGpuProfile(
    deps.platform,
    state.brand,
    state.osVersion,
  );

  return {
    totalRAM: state.totalRAMBytes / BYTES_TO_GB,
    availableRAM: availableRAMBytes / BYTES_TO_GB,
    cpuCores: Math.min(state.cpuCores, 8), // Limite prático para llama.cpp
    hasGPU: gpuProfile.backend !== null && availableRAMBytes > 1e9,
    gpuBackend: gpuProfile.backend,
    platform: deps.platform,
    detectedAt: Date.now(),
  };
}
```

**Isso remove:**

- `cpuBrand` (inútil para decisões)
- `performanceCores` (falso refinamento)
- `gpuMemoryMB` (impreciso quando calculado)
- `gpuType` (redundante com backend)
- `osVersion`/`deviceModel` (apenas para logging)

---

**Resumo:** Sua arquitetura está 80% alinhada com as melhores práticas do artigo. Os 20% restantes são ajustes de precisão (overhead de RAM, Flash Attention, Vulkan) que podem prevenir crashes em produção. Simplificar a detecção de CPU vai reduzir complexidade sem perder capacidade de decisão.
