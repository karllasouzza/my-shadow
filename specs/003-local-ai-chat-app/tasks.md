# Tasks: Local AI Chat Application — Refatoração shared/ai/

**Input**: Design documents from `/specs/003-local-ai-chat-app/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅
**Scope**: Refazer completamente `shared/ai/` — todas as 3 camadas (catalog, manager, runtime)

---

## Phase 1: Setup & Diagnóstico

**Purpose**: Entender estado atual, mapear dependências externas, preparar terreno para refatoração

- [x] T001 [P] Mapear todos os imports externos ao `shared/ai/` (quem importa o quê)
  - Arquivos: `features/**/*.ts`, `features/**/*.tsx`, `app/**/*.tsx`
  - Documentar em `specs/003-local-ai-chat-app/dependency-map.md`
- [x] T002 [P] Identificar código morto/arquivos não utilizados em `shared/ai/`
  - Verificar: `shared/ai/model-manager.ts` (antigo vs novo), `shared/ai/model-catalog.ts`, `shared/ai/local-ai-runtime.ts`
- [x] T003 Listar todos os bugs conhecidos e problemas de design atuais
  - Review de `research.md` + análise manual
  - Documentar gaps: duplicação, acoplamento, responsabilidades erradas

**Checkpoint**: Diagnóstico completo, sabemos o que existe vs o que precisamos

---

## Phase 2: Foundational — Refazer Camada de Tipos e Constantes

**Purpose**: Base tipada e constantes que TODO o resto depende. Sem isso, nenhuma outra tarefa pode começar.

**⚠️ CRITICAL**: Esta fase BLOCKS todas as demais. Nenhuma user story pode começar sem tipos definidos.

### 2.1: Tipos Unificados

- [x] T004 Reescrever `shared/ai/types.ts` (novo arquivo consolidado)
  - Unificar tipos de `manager/types.ts`, `runtime/types.ts`, `catalog/types.ts`
  - Entidades: `ModelCatalogEntry`, `DownloadedModel`, `DownloadState`, `LlamaModel`, `ModelStatus`, `ChatMessage` (IA), `CompletionOutput`, `CompletionOptions`, `LocalAIRuntimeStatus`
  - Exportar tudo de um único ponto
- [x] T005 Reescrever `shared/ai/constants.ts` (novo arquivo consolidado)
  - Unificar constantes de `manager/constants.ts` + `runtime/constants.ts`
  - Keys MMKV, paths, limites de contexto, timeouts, buffers de disco
  - Exportar tudo de um único ponto

### 2.2: Sistema de Erros Específico de IA

- [x] T006 Criar `shared/ai/errors.ts`
  - Error codes específicos de IA: `MODEL_NOT_FOUND`, `DOWNLOAD_FAILED`, `INSUFFICIENT_RAM`, `INSUFFICIENT_DISK`, `CONTEXT_OVERFLOW`, `GENERATION_TIMEOUT`, `MODEL_LOAD_FAILED`, `RUNTIME_NOT_INITIALIZED`
  - Factory functions: `createModelNotFoundError()`, `createDownloadError()`, etc.
  - Manter compatibilidade com `AppErrorCode` de `shared/utils/app-error.ts`

**Checkpoint**: Tipos, constantes e erros definidos. Camada de foundation pronta.

---

## Phase 3: Refazer Camada de Catálogo (shared/ai/catalog/)

**Purpose**: Catálogo de modelos estático — dados, tipos e helpers de lookup.

### 3.1: Catálogo de Modelos

- [x] T007 [P] Reescrever `shared/ai/catalog/types.ts`
  - `ModelCatalogEntry` com todos os campos do data-model.md
  - Adicionar campos: `quantization`, `params` (ex: "0.5B"), `tags: string[]`
- [x] T008 [P] Reescrever `shared/ai/catalog/data.ts`
  - Manter 3 modelos Qwen 2.5 existentes
  - Adicionar metadata rica: `tags: ["lightweight", "instruct"]`, etc.
  - Validar cada entrada com Zod schema
- [x] T009 Reescrever `shared/ai/catalog/helpers.ts`
  - `findModelById(id: string)` — buscar por ID
  - `getAllModels()` — listar todos
  - `getModelsByRam(maxRamBytes: number)` — filtrar por RAM disponível
  - `isModelDownloaded(modelId: string)` — check via `getDownloadedModelMap()`
- [x] T010 Reescrever `shared/ai/catalog/index.ts`
  - Re-exportar tudo corretamente
  - Adicionar validação de integridade do catálogo no boot

**Checkpoint**: Catálogo funcional, tipado, com helpers de busca e filtro.

---

## Phase 4: Refazer Camada de Storage (shared/ai/storage/)

**Purpose**: Persistência MMKV para configuração de modelos — ativo e baixados.

### 4.1: Storage de Modelos

- [x] T011 [P] Reescrever `shared/ai/storage/types.ts`
  - Tipos: `ModelConfigStorage`, `DownloadedModelMap`
  - Schema de validação Zod
- [x] T012 [P] Reescrever `shared/ai/storage/mmkv.ts`
  - Singleton MMKV com `createMMKV({ id: "model_config" })`
  - Lazy initialization com thread-safety
- [x] T013 Reescrever `shared/ai/storage/model-config.ts`
  - `getActiveModelId(): string | null`
  - `setActiveModelId(modelId: string): void`
  - `clearActiveModelId(): void`
  - `getDownloadedModelMap(): DownloadedModelMap`
  - `setDownloadedModelPath(modelId: string, path: string): void`
  - `removeDownloadedModel(modelId: string): void`
  - `replaceDownloadedModelMap(map: DownloadedModelMap): void`
  - Todas as funções com validação de entrada (Zod)
- [x] T014 Reescrever `shared/ai/storage/index.ts`
  - Re-exportar tudo

**Checkpoint**: Storage funcional, validado, com tipagem forte.

---

## Phase 5: Refazer Camada de Paths (shared/ai/paths/)

**Purpose**: Resolução de paths de arquivos, sanitização de model IDs, migração legacy.

### 5.1: Path Resolution

- [x] T015 [P] Reescrever `shared/ai/paths/constants.ts`
  - `MODELS_SUBDIRECTORY`, `MODEL_FILE_EXTENSION`
  - Migrar de `manager/constants.ts` para cá
- [x] T016 [P] Reescrever `shared/ai/paths/resolver.ts`
  - `ensureFileUri(pathOrUri: string): string` — garantir prefix `file://`
  - `getModelsDirectoryUri(): Result<string>` — resolver diretório base
  - `sanitizeModelId(modelId: string): string` — normalizar IDs
  - `getDefaultModelFileName(modelId: string): string` — gerar filename padrão
  - `resolveModelDestinationUri(modelId, customPath?, modelsDir): string` — resolver path final
  - `extractFileNameFromUrl(url: string): string` — parse de URL
  - `resolveLegacyModelUri(downloadUrl, modelsDir): string` — migração legacy
- [x] T017 Reescrever `shared/ai/paths/index.ts`
  - Re-exportar tudo

**Checkpoint**: Path resolution funcional, seguro, com migração legacy.

---

## Phase 6: Refazer Camada de Download (shared/ai/download/)

**Purpose**: Download resumível atômico com progresso, cancelamento e validação.

### 6.1: Download Engine

- [x] T018 [P] Reescrever `shared/ai/download/types.ts`
  - `DownloadFileOptions`, `DownloadedFile`, `ResumableRef`, `DownloadProgress`
- [x] T019 [P] Reescrever `shared/ai/download/resumable.ts`
  - `createResumableDownload(options): Promise<Result<DownloadedFile>>`
  - `FileSystem.createDownloadResumable()` com callback de progresso
  - Suporte a cancelamento via `cancelAsync()`
  - Cleanup de `.part` em falha/cancelamento
  - Validação de arquivo baixado (size > 0)
  - Move atômico de `.part` para destino final
- [x] T020 Reescrever `shared/ai/download/index.ts`
  - Re-exportar tudo

**Checkpoint**: Download funcional com progresso, cancelamento e atomicidade.

---

## Phase 7: Refazer Camada de Validação (shared/ai/validation/)

**Purpose**: Validação de arquivos de modelo, disco e RAM.

### 7.1: Validation Engine

- [x] T021 [P] Reescrever `shared/ai/validation/types.ts`
  - `ModelFileDiagnostics`, `DiskSpaceCheck`, `RamCheck`
- [x] T022 [P] Reescrever `shared/ai/validation/file.ts`
  - `fileExists(pathOrUri): Promise<boolean>`
  - `verifyModelFile(pathOrUri, expectedSize?): Promise<Result<number>>`
  - Validar: existência, size > MIN_VALID_MODEL_BYTES, size ratio vs esperado
- [x] T023 [P] Reescrever `shared/ai/validation/disk-space.ts`
  - `hasEnoughDiskSpace(requiredBytes): Promise<Result<boolean>>`
  - Usar `FileSystem.getFreeDiskStorageAsync()` se disponível
  - Buffer de segurança de 100MB
- [x] T024 [P] Reescrever `shared/ai/validation/ram.ts`
  - `hasEnoughRam(estimatedRamBytes): Promise<Result<boolean>>`
  - Usar `DeviceInfo.getTotalMemory()`
  - Retornar warning (não bloqueio) se RAM insuficiente
- [x] T025 Reescrever `shared/ai/validation/index.ts`
  - Re-exportar tudo

**Checkpoint**: Validação completa de arquivo, disco e RAM.

---

## Phase 8: Refazer ModelManager (shared/ai/manager/)

**Purpose**: Orquestrador principal — combina download, storage, validation em API coesa.

### 8.1: ModelManager Service

- [x] T026 [P] Reescrever `shared/ai/manager/types.ts`
  - `ModelManagerState`, `ModelOperationResult`
  - Estado unificado: download active, progress, loaded model, errors
- [x] T027 Reescrever `shared/ai/manager/model-manager.service.ts`
  - **downloadModel(modelId, url, options)**: Orquestrar download → validate → persist
    - Usar T019 (download), T022 (validation), T013 (storage)
    - Progress callbacks, cancelamento
    - Persistir path via `setDownloadedModelPath`
  - **loadModel(modelId, filePath)**: Validar → carregar no runtime
    - Usar T022 (file validation), T032 (runtime loadModel)
    - Set active model on success
  - **unloadModel()**: Descarregar do runtime + limpar active model
    - Usar T032 (runtime unloadModel)
  - **getActiveModel()**: Ler de storage
  - **setActiveModel(modelId)**: Persistir em storage
  - **getDownloadedModels()**: Ler mapa de storage
  - **getDownloadedModelPath(modelId)**: Resolver path com fallbacks legacy
  - **cancelDownload()**: Cancelar download ativo
  - **getDownloadProgress()**: Progresso atual (0-100)
  - **isDownloadActive()**: Se download está em andamento
  - **hasEnoughRam() / hasEnoughDisk()**: Delegar para T024, T023
- [x] T028 Reescrever `shared/ai/manager/index.ts`
  - Re-exportar tudo

**Checkpoint**: ModelManager completo, orquestrando todas as camadas inferiores.

---

## Phase 9: Refactor Camada de Runtime (shared/ai/runtime/)

**Purpose**: Wrapper do `llama.rn` — load, unload, generate completion com streaming.

### 9.1: Local AI Runtime

- [x] T029 [P] Reescrever `shared/ai/runtime/types.ts`
  - Manter compatibilidade com `llama.rn` types (`RNLlamaOAICompatibleMessage`)
  - `LlamaModel`, `LocalAIRuntimeStatus`, `CompletionOutput`, `CompletionOptions`
- [x] T030 [P] Reescrever `shared/ai/runtime/constants.ts`
  - `DEFAULT_CONTEXT_LENGTH = 4096`, `RESERVED_RESPONSE_TOKENS = 512`, `GENERATION_TIMEOUT_MS = 60000`
- [x] T031 [P] Reescrever `shared/ai/runtime/model-file.ts`
  - `resolveModelPath(modelPath): string` — garantir `file://`
  - `diagnoseModelFile(filePath): Promise<ModelFileDiagnostics>` — validar existência + size
- [x] T032 Reescrever `shared/ai/runtime/local-ai-runtime.service.ts`
  - **initialize()**: Boot do runtime (idempotent)
  - **loadModel(modelId, modelPath)**: `initLlama()` com `n_ctx`, `use_mlock`, `n_gpu_layers`
  - **unloadModel()**: `context.release()` + limpar estado
  - **generateCompletion(messages, options)**: Streaming com `onToken` callback
    - Format prompt com sistema de contexto (últimas 10 msgs)
    - Timeout de 60s
    - Token count tracking
  - **tokenize(text)**: Contar tokens de um texto
  - **isModelLoaded(modelId?)**: Check se modelo está carregado
  - **getCurrentModel()**: Retornar modelo atual
  - **getStatus()**: Status completo do runtime
  - **waitReady()**: Promise que resolve quando runtime está pronto
  - **isAvailable()**: Check se runtime está disponível (não-web)
- [x] T033 Reescrever `shared/ai/runtime/index.ts`
  - Re-exportar tudo

**Checkpoint**: Runtime completo com streaming, timeout, token counting.

---

## Phase 10: Consolidação e Re-exports

**Purpose**: API pública limpa, re-exports organizados, barrel files corretos.

### 10.1: Barrel Files e API Pública

- [x] T034 Reescrever `shared/ai/index.ts` (novo arquivo raiz)
  - Barrel file principal que re-exporta tudo de forma organizada:
    ```ts
    export * from "./catalog";
    export * from "./manager";
    export * from "./runtime";
    export * from "./storage";
    export * from "./download";
    export * from "./validation";
    export * from "./paths";
    export * from "./types";
    export * from "./constants";
    export * from "./errors";
    ```
- [x] T035 [P] Remover barrel files antigos duplicados
  - `shared/ai/model-manager.ts` → apontar para `manager/index.ts` ou remover
  - `shared/ai/model-catalog.ts` → apontar para `catalog/index.ts` ou remover
  - `shared/ai/local-ai-runtime.ts` → apontar para `runtime/index.ts` ou remover
- [x] T036 [P] Atualizar TODOS os imports externos
  - `features/chat/view-model/use-chat-vm.ts`
  - `features/model-management/view-model/use-models-vm.ts`
  - `features/model-management/view/models-screen.tsx`
  - `features/model-management/components/model-catalog.tsx`
  - Garantir que todos apontam para os novos paths corretos
- [x] T037 Rodar `npx tsc --noEmit` para verificar que tudo compila
  - Corrigir qualquer error de tipo/importação
  - Zero errors esperado

**Checkpoint**: API pública limpa, todos os imports funcionando, TypeScript compila sem erros.

---

## Phase 11: Integração e Testes Manuais

**Purpose**: Validar que o `shared/ai/` refatorado funciona com o app real.

### 11.1: Testes de Integração Manual

- [ ] T038 Validar fluxo de download completo
  - Abrir app → Models tab → Baixar modelo → Verificar progresso → Verificar "Disponível"
  - Confirmar que modelo persiste após restart do app
- [ ] T039 Validar fluxo de load/unload
  - Models tab → Carregar modelo → Verificar "Em uso"
  - Ir para Chat tab → Verificar que modelo está pronto
  - Voltar para Models → Descarregar → Verificar status
- [ ] T040 Validar auto-load no launch
  - Fechar app completamente → Reabrir
  - Verificar que modelo ativo é carregado automaticamente
  - Chat tab deve mostrar modelo pronto
- [ ] T041 Validar envio de mensagem com contexto
  - Chat tab → Enviar 3+ mensagens
  - Verificar que IA responde com contexto das mensagens anteriores
  - Verificar truncamento automático se exceder contexto
- [ ] T042 Validar remoção de modelo
  - Models tab → Remover modelo baixado → Confirmação → Verificar "Baixar" novamente
  - Verificar que arquivo foi deletado do filesystem

**Checkpoint**: Todos os fluxos manuais passando. `shared/ai/` refatorado funciona.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)        → No dependencies, start immediately
Phase 2 (Types)        → Depends on Phase 1 diagnostic — BLOCKS everything else
Phase 3 (Catalog)      → Depends on Phase 2 types
Phase 4 (Storage)      → Depends on Phase 2 types
Phase 5 (Paths)        → Depends on Phase 2 types + constants
Phase 6 (Download)     → Depends on Phase 4 (storage), Phase 5 (paths), Phase 2 (types)
Phase 7 (Validation)   → Depends on Phase 2 (types, constants), Phase 5 (paths)
Phase 8 (Manager)      → Depends on Phase 4, 5, 6, 7 — ORCHESTRATOR
Phase 9 (Runtime)      → Depends on Phase 2 (types, constants) — independent de 3-8
Phase 10 (Consolidate) → Depends on ALL phases 2-9 complete
Phase 11 (Test)        → Depends on Phase 10 complete
```

### Execution Strategy

**Sequential (single developer)**:

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9 → Phase 10 → Phase 11
```

**Parallel (if multiple developers)**:

```
Phase 1 → Phase 2 (BLOCKS all)
After Phase 2:
  Dev A: Phase 3 (Catalog) + Phase 10 (after 3-9)
  Dev B: Phase 4 (Storage) + Phase 5 (Paths)
  Dev C: Phase 6 (Download) + Phase 7 (Validation)
  Dev D: Phase 8 (Manager — after 4,5,6,7) + Phase 9 (Runtime)
Final: Phase 10 (Consolidate) → Phase 11 (Test)
```

### Within Each Phase

- Tasks marked [P] can run in parallel (different files)
- Non-parallel tasks depend on sibling [P] tasks in same phase
- Each phase must complete before next phase begins
- Phase 8 (Manager) is the critical integration point — must wait for 4, 5, 6, 7

### Parallel Example: Phase 2 (Foundation)

```bash
# All 3 tasks can run in parallel (different files):
Task T004: shared/ai/types.ts
Task T005: shared/ai/constants.ts
Task T006: shared/ai/errors.ts
```

### Parallel Example: Phase 6 (Download)

```bash
# T018 (types) and T019 (resumable) can run in parallel
# T020 (index) waits for both to complete
```

---

## Implementation Strategy

### Refactoring Approach: Strangler Fig

1. **Não deletar arquivos antigos imediatamente**: Manter legacy até novo código estar funcional
2. **Criar novos arquivos ao lado dos antigos**: `shared/ai/storage/`, `shared/ai/download/`, etc.
3. **Migrar imports gradualmente**: Atualizar features para usar novos módulos
4. **Deletar legacy somente após Phase 10**: Quando tudo compila e testes passam

### Order of Operations

1. Complete Phase 1-2 (diagnostic + types/constants/errors)
2. Complete Phase 3-7 (catalog, storage, paths, download, validation — independent layers)
3. Complete Phase 8-9 (manager orchestrator + runtime — integration layers)
4. Complete Phase 10 (consolidate API, update imports, delete legacy)
5. Complete Phase 11 (manual integration tests)

### Risk Mitigation

- **Commit a cada phase completa**: Ponto de rollback claro
- **Rodar `tsc --noEmit` após cada phase**: Zero regressão de tipos
- **Testar app a cada 2 phases**: Funcionalidade não quebra
- **Manter `shared/ai/model-manager.ts` antigo funcionando até Phase 10**: Fallback seguro

---

## Total Task Count

| Phase                 | Tasks  | Parallelizable |
| --------------------- | ------ | -------------- |
| Phase 1: Setup        | 3      | 2              |
| Phase 2: Foundation   | 3      | 3              |
| Phase 3: Catalog      | 4      | 2              |
| Phase 4: Storage      | 4      | 2              |
| Phase 5: Paths        | 3      | 2              |
| Phase 6: Download     | 3      | 2              |
| Phase 7: Validation   | 5      | 4              |
| Phase 8: Manager      | 3      | 1              |
| Phase 9: Runtime      | 5      | 4              |
| Phase 10: Consolidate | 4      | 2              |
| Phase 11: Test        | 5      | 0              |
| **TOTAL**             | **42** | **24**         |

---

## Notes

- `[P]` = pode rodar em paralelo (arquivos diferentes, sem dependências)
- `[Story]` = mapeado para user story (não aplicável aqui — é refatoração de infra)
- Cada phase é um checkpoint independente — commit e testar ao final de cada uma
- **NÃO deletar código antigo até Phase 10** — usar abordagem Strangler Fig
- TypeScript deve compilar sem erros após cada phase (`npx tsc --noEmit`)
- Rodar `bun lint` após cada phase para garantir código limpo
