# Contract: Model Selection & Download Interface

## Purpose

Defines the contract between the Model Selection screen and the device detection / download services. Shown only on first launch OR when no model is downloaded.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deviceInfo` | `DeviceInfo` | Yes | RAM, storage, biometric capabilities |
| `availableModels` | `AvailableModel[]` | Yes | Catalog of downloadable models |
| `onDownloadComplete` | `(config: ModelConfiguration) => void` | Yes | Callback with downloaded model config |
| `onSkip` | `() => void` | No | Optional skip callback (not available for first launch) |

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `selectedModel` | `ModelConfiguration` | The model that was downloaded and configured |
| `downloadPath` | `string` | File path where model was saved |
| `customFolderUri` | `string \| null` | SAF folder URI if user chose custom location |

## States

| State | Loading | Empty | Success | Error |
|-------|---------|-------|---------|-------|
| Initial load | Device detection in progress | N/A | Compatible models listed | Device detection failed |
| Model list | N/A | No compatible models found | Models listed with recommendations | N/A |
| Download in progress | Progress bar (0-100%), cancel button visible | N/A | N/A | Download failed — retry button shown |
| Download complete | N/A | N/A | Success confirmation, proceed to loading screen | N/A |

## Model Catalog

The available model catalog is defined at build time:

```typescript
const MODEL_CATALOG: AvailableModel[] = [
  {
    key: 'qwen2.5-0.5b-q4',
    name: 'Qwen 2.5 0.5B (Rápido)',
    description: 'Modelo leve, ideal para dispositivos com menos memória. Respostas rápidas com boa qualidade.',
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    fileSizeBytes: 350_000_000,
    estimatedRamBytes: 500_000_000,
    quantization: 'Q4_K_M',
  },
  {
    key: 'qwen2.5-1.5b-q4',
    name: 'Qwen 2.5 1.5B (Equilibrado)',
    description: 'Bom equilíbrio entre qualidade e desempenho. Recomendado para maioria dos dispositivos.',
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    fileSizeBytes: 1_000_000_000,
    estimatedRamBytes: 1_500_000_000,
    quantization: 'Q4_K_M',
  },
  {
    key: 'qwen2.5-3b-q4',
    name: 'Qwen 2.5 3B (Qualidade)',
    description: 'Melhor qualidade de geração. Requer dispositivo com 8GB+ RAM para operação estável.',
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
    fileSizeBytes: 1_800_000_000,
    estimatedRamBytes: 2_500_000_000,
    quantization: 'Q4_K_M',
  },
];
```

**Note**: `isCompatible` and `isRecommended` fields are computed at runtime based on `DeviceInfo.ramBudget60`.

## Error Handling

| Error | User Message | Recovery |
|-------|-------------|----------|
| No compatible models | "Nenhum modelo compatível encontrado para este dispositivo." | No recovery — user cannot proceed |
| Download failed (network) | "Falha no download. Verifique sua conexão e tente novamente." | Retry button |
| Download failed (storage) | "Espaço insuficiente. Libere espaço e tente novamente." | No recovery until storage freed |
| Download cancelled | "Download cancelado." | Retry button |
| Corrupted model file | "Arquivo do modelo corrompido. Baixe novamente." | Re-download button |
| SAF permission denied | "Permissão de armazenamento negada. Usando local padrão." | Fall back to default path |

## Navigation Contract

- **On download complete**: Navigate to Model Loading screen
- **On no compatible models**: Block navigation — show error state
- **On cancel during download**: Stay on model selection screen, allow retry
- **Skip**: Not available for first launch — user MUST download a model
