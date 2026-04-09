# Contract: Model Loading Interface

## Purpose

Defines the contract for the Model Loading screen. This screen is mandatory — the user cannot access the main app until the model is successfully loaded into memory.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `modelConfiguration` | `ModelConfiguration` | Yes | The model to load into memory |
| `ragContentDbPath` | `string` | Yes | Path to the bundled rag-content.db |
| `ramBudget60` | `number` | Yes | 60% RAM budget in bytes |
| `onLoadSuccess` | `() => void` | Yes | Callback when model is ready |
| `onLoadFailure` | `(error: Error) => void` | Yes | Callback when loading fails |

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `loadStatus` | `'loading' \| 'success' \| 'failed'` | Current loading state |
| `loadProgress` | `number` | 0.0 to 1.0 loading progress |
| `errorMessage` | `string \| null` | Error description if failed |

## States

| State | Loading | Empty | Success | Error |
|-------|---------|-------|---------|-------|
| Model initialization | Progress indicator (indeterminate or %), back button blocked | N/A | N/A | N/A |
| Model loaded | N/A | N/A | Brief success state, auto-navigate to main app | N/A |
| Load failed | N/A | N/A | N/A | Error message + retry + cancel buttons |

## Loading Sequence

```
1. Validate model file exists at modelConfiguration.filePath
2. Check estimatedRamBytes <= ramBudget60
   └─ If exceeds budget → fail with "Modelo excede limite de memória"
3. Initialize ExecuTorch runtime with model file
4. Load rag-content.db into OPSQLite vector store
5. Run test generation (1 token) to verify pipeline
6. Mark modelConfiguration.isLoaded = true
7. Update modelConfiguration.lastUsedAt = now
8. Navigate to main reflection interface
```

## Error Handling

| Error | User Message | Recovery |
|-------|-------------|----------|
| Model file not found | "Arquivo do modelo não encontrado. Selecione outro modelo." | Navigate back to model selection |
| Model exceeds RAM budget | "Este modelo requer mais memória do que o disponível. Escolha um modelo menor." | Navigate back to model selection |
| ExecuTorch init failed | "Falha ao inicializar o modelo. Tente novamente." | Retry button |
| rag-content.db missing | "Base de conhecimento não encontrada. A geração será limitada." | Continue with limited RAG, show warning |
| rag-content.db corrupted | "Base de conhecimento corrompida. Prompt usar modelos sem contexto." | Continue with fallback prompts |
| Test generation failed | "O modelo não está respondendo corretamente. Tente recarregar." | Retry button |

## Back Button Contract

- **During loading**: Back button is BLOCKED. `usePreventRemove` is active.
- **On failure**: Back button shows confirmation dialog: "Deseja cancelar? O modelo precisa ser carregado para usar o app." Options: "Cancelar" (navigate to model selection) / "Continuar" (stay on loading screen).
- **On success**: Back button is unblocked and navigation proceeds automatically.

## Navigation Contract

- **On success**: Navigate to main reflection interface (replace stack, prevent back to onboarding)
- **On failure + cancel**: Navigate to Model Selection screen
- **On failure + retry**: Stay on loading screen, retry load sequence
