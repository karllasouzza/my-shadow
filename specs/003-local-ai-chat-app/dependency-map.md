# Dependency Map: shared/ai/

**Date**: 10 de abril de 2026
**Feature**: 003-local-ai-chat-app

---

## External Imports (quem importa o quê)

### features/chat/view-model/use-chat-vm.ts
```ts
import { getLocalAIRuntime } from "@/shared/ai/local-ai-runtime";
```
- Depende de: `shared/ai/runtime/local-ai-runtime.service.ts` (via re-export)

### features/model-management/view-model/use-models-vm.ts
```ts
import { getLocalAIRuntime } from "@/shared/ai/local-ai-runtime";
import { getModelManager } from "@/shared/ai/model-manager";
import { MODEL_CATALOG, findModelById, type ModelCatalogEntry } from "@/shared/ai/model-catalog";
```
- Depende de: `shared/ai/runtime/`, `shared/ai/manager/`, `shared/ai/catalog/`

### features/model-management/view/models-screen.tsx
```ts
import { MODEL_CATALOG } from "@/shared/ai/model-catalog";
```
- Depende de: `shared/ai/catalog/data.ts` (via re-export)

### features/model-management/components/model-catalog.tsx
```ts
import type { ModelCatalogEntry } from "@/shared/ai/model-catalog";
```
- Depende de: `shared/ai/catalog/types.ts` (via re-export)

---

## Internal Dependency Graph (shared/ai/)

```
shared/ai/
├── catalog/
│   ├── types.ts          ← ModelCatalogEntry
│   ├── data.ts           ← depende de types.ts
│   ├── helpers.ts        ← depende de data.ts, types.ts
│   └── index.ts          ← re-export tudo
│
├── manager/
│   ├── types.ts          ← DownloadState, DownloadedFile, ResumableRef
│   ├── constants.ts      ← keys MMKV, paths, thresholds
│   ├── paths.ts          ← depende de constants.ts, FileSystem
│   ├── storage.ts        ← depende de constants.ts, MMKV
│   ├── validation.ts     ← depende de constants.ts, paths.ts, FileSystem
│   ├── download.ts       ← depende de types.ts, FileSystem
│   ├── model-manager.service.ts ← DEPENDE DE TUDO ACIMA + runtime + storage + validation + download
│   └── index.ts          ← re-export tudo
│
├── runtime/
│   ├── types.ts          ← ChatMessage, LlamaModel, CompletionOutput, etc.
│   ├── constants.ts      ← n_ctx, timeout
│   ├── model-file.ts     ← resolveModelPath, diagnoseModelFile
│   ├── local-ai-runtime.service.ts ← DEPENDE DE types, constants, model-file, llama.rn
│   └── index.ts          ← re-export tudo
│
├── model-manager.ts      ← re-export manager/index.ts (barrel file duplicado)
├── model-catalog.ts      ← re-export catalog/index.ts (barrel file duplicado)
└── local-ai-runtime.ts   ← re-export runtime/index.ts (barrel file duplicado)
```

---

## Código Morto / Duplicado

### Arquivos Barrel Duplicados (legacy)
| Arquivo | Aponta Para | Status |
|---------|-------------|--------|
| `shared/ai/model-manager.ts` | `./manager/model-manager.service.ts` | ✅ Funcional mas redundante |
| `shared/ai/model-catalog.ts` | `./catalog` | ✅ Funcional mas redundante |
| `shared/ai/local-ai-runtime.ts` | `./runtime` | ✅ Funcional mas redundante |

### Duplicação de Tipos
- `ModelCatalogEntry` definido em `catalog/types.ts` — importado corretamente
- `DownloadState` definido em `manager/types.ts` — não conflita com outros
- **Problema**: `manager/model-manager.service.ts` importa de caminhos relativos complexos, dificultando refatoração

### Bugs Conhecidos e Problemas de Design
1. **Download não persistia path** — Corrigido em commit anterior (`setDownloadedModel` agora é chamado)
2. **Auto-load comentado no `_layout.tsx`** — Código presente mas desabilitado (T046)
3. **ModelSelectorFooter não integrado** — Componente existe mas não é usado na ChatScreen
4. **Cores hardcodeadas** em `chat-screen.tsx` e `_layout.tsx` — violam constituição
5. **Contexto de conversa não implementado** — Mensagens não são enviadas como contexto ao modelo
6. **Acoplamento alto no ModelManager** — Orquestra tudo diretamente ao invés de delegar para serviços especializados
7. **Sem validação Zod** — Nenhuma validação de schema nos inputs de storage/catalogo
8. **Error codes genéricos** — Usa apenas `AppErrorCode` genéricos, sem codes específicos de IA

---

## Resumo

- **4 arquivos externos** importam de `shared/ai/`
- **20 arquivos internos** no módulo `shared/ai/`
- **3 barrel files redundantes** que podem ser removidos
- **8 problemas de design** documentados para resolver na refatoração
- **1 bug crítico corrigido** (download persistence)
