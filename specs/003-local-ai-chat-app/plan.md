# Implementation Plan: Local AI Chat Application

**Branch**: `003-local-ai-chat-app` | **Date**: 10 de abril de 2026 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-local-ai-chat-app/spec.md`

## Summary

Implementar e ajustar as 3 telas principais do app de chat com IA local (Chat, Histórico, Gerenciamento de Modelos), corrigir o fluxo de download e salvamento de modelos no dispositivo, integrar o `ModelSelectorFooter` na tela de Chat, habilitar auto-load do modelo ativo no launch, e garantir persistência correta de conversas e modelos via MMKV. O projeto já possui a arquitetura base (MVVM com Legend State, runtime llama.rn, catálogo estático, componentes UI) mas precisa de integração completa e correções de bugs no fluxo de download/salvamento.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.1, React Native 0.81.5, Expo SDK 54
**Primary Dependencies**:

- `llama.rn ^0.10.0` — inferência LLM local com llama.cpp
- `@legendapp/state ^3.0.0-beta.46` — estado reativo observável
- `react-native-mmkv ^4.3.1` — persistência leve (conversas, config de modelos)
- `expo-file-system` — downloads resumíveis com `createDownloadResumable`
- `react-native-device-info` — validação de RAM
- `expo-router ~6.0` — file-based routing com tabs
- `nativewind ^4.2.3` — estilização via Tailwind CSS
- `@rn-primitives/*` — componentes UI headless
- `sonner-native` — toasts para feedback

**Storage**: MMKV (conversas + config de modelos), FileSystem (arquivos GGUF em `documentDirectory/models/`)
**Testing**: Jest ^30.3 + @testing-library/react-native ^13.3 (configurado mas sem testes implementados — `tests/` dir inexistente)
**Target Platform**: iOS 15+ e Android (Expo com New Architecture, Hermes)
**Project Type**: Mobile app (Expo/React Native universal — iOS, Android, web fallback)
**Performance Goals**:

- 55+ FPS durante streaming e scroll
- First token < 5s para modelos até 3B
- TTI < 10s com modelo em memória
- Download + load + first message < 3min (Wi-Fi, modelos até 2GB)
  **Constraints**:
- 100% offline após download de modelos
- n_ctx=4096 tokens máximo por modelo
- Últimas 10 mensagens (5 trocas) como contexto de conversa
- Truncamento automático quando excede contexto
- RAM mínima de 4GB no dispositivo
  **Scale/Scope**: App individual, até 50 conversas salvas, catálogo estático com 3 modelos Qwen 2.5 GGUF (0.5B, 1.5B, 3B)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Baseado na `CONSTITUTION.md` do projeto:

| Gate                                           | Status     | Notes                                                                                          |
| ---------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| TypeScript estrito (`strict: true`, sem `any`) | ✅ Pass    | Configurado no `tsconfig.json`, overrides apenas para testes e JSX                             |
| Arquitetura MVVM por feature                   | ✅ Pass    | Features em `features/<name>/` com `model/`, `service/`, `view/`, `view-model/`, `components/` |
| Separação de responsabilidades                 | ✅ Pass    | Models (tipos), Services (lógica), ViewModels (estado), Views (UI)                             |
| Padrão `Result<T>` para erros                  | ✅ Pass    | `ok(value)` / `err(error)` via `shared/utils/app-error.ts`                                     |
| Validação com Zod                              | ✅ Pass    | Zod ^4.3.6 instalado e disponível                                                              |
| Componentes UI via `components/ui/`            | ✅ Pass    | Button, Text, Icon, Select, Skeleton existentes                                                |
| Cores via tema (sem hardcodear)                | ⚠️ Partial | `chat-screen.tsx` tem cores hardcodeadas (`#3b82f6`, `#ef4444`) — precisa corrigir             |
| Legend State `observer()` para reatividade     | ✅ Pass    | `ChatScreenInner`, `HistoryScreen`, `ModelsScreen` já usam `observer()`                        |
| Mensagens de erro em português                 | ✅ Pass    | Todas as mensagens já estão em PT-BR                                                           |
| Cobertura de testes 100% services/utils        | ❌ Fail    | Nenhum arquivo de teste existe — `tests/` dir inexistente                                      |
| Anti-pattern: sem `as any` ou `// @ts-ignore`  | ✅ Pass    | Nenhum encontrado no código atual                                                              |
| Performance: `observer()` granular             | ✅ Pass    | ViewModels usam Legend State corretamente                                                      |
| Mensagens ≤ 10.000 chars                       | ✅ Pass    | Validado em `ChatInput`                                                                        |
| Streaming token-a-token                        | ✅ Pass    | Implementado via `onToken` callback no runtime                                                 |

**Violations to address**:

1. ⚠️ Cores hardcodeadas em `chat-screen.tsx` — usar variáveis de tema
2. ❌ Nenhum teste implementado — fora do escopo deste plano (feature de implementação UI)

## Project Structure

### Documentation (this feature)

```text
specs/003-local-ai-chat-app/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (if applicable)
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
my-shadow/
├── app/
│   ├── _layout.tsx              # Root layout com Tabs (Chat, Modelos, Historico)
│   ├── chat/index.tsx           # Route wrapper → ChatScreen
│   ├── models/index.tsx         # Route wrapper → ModelsScreen
│   ├── history/index.tsx        # Route wrapper → HistoryScreen
│   └── +not-found.tsx           # 404 screen
│
├── features/
│   ├── chat/
│   │   ├── model/               # ChatMessage, ChatConversation types
│   │   ├── service/             # ChatService (MMKV CRUD)
│   │   ├── view-model/          # use-chat-vm.ts (Legend State observable)
│   │   ├── view/
│   │   │   └── chat-screen.tsx  # Main chat UI (needs ModelSelectorFooter integration)
│   │   └── components/
│   │       ├── chat-input.tsx
│   │       ├── message-bubble.tsx
│   │       ├── empty-chat.tsx
│   │       ├── generating-indicator.tsx
│   │       └── model-selector-footer.tsx  # Exists but NOT integrated
│   │
│   ├── history/
│   │   ├── view-model/          # use-history-vm.ts
│   │   ├── view/
│   │   │   └── history-screen.tsx
│   │   └── components/
│   │       ├── conversation-list.tsx
│   │       ├── conversation-item.tsx
│   │       └── empty-history.tsx
│   │
│   └── model-management/
│       ├── view-model/          # use-models-vm.ts
│       ├── view/
│       │   └── models-screen.tsx
│       └── components/
│           ├── model-catalog.tsx
│           ├── model-item.tsx
│           ├── download-progress.tsx
│           └── ram-warning.tsx
│
├── shared/
│   ├── ai/
│   │   ├── catalog/             # Static model catalog (3 Qwen models)
│   │   ├── manager/             # ModelManager service (download, load, unload, persist)
│   │   │   ├── model-manager.service.ts  # Main orchestrator
│   │   │   ├── download.ts      # Resumable download
│   │   │   ├── storage.ts       # MMKV persistence for model config
│   │   │   ├── validation.ts    # Disk space + file checks
│   │   │   ├── paths.ts         # Path resolution + legacy migration
│   │   │   └── ...
│   │   └── runtime/             # LocalAIRuntimeService (llama.rn wrapper)
│   │       ├── local-ai-runtime.service.ts
│   │       ├── model-file.ts
│   │       └── ...
│   └── utils/
│       ├── app-error.ts         # Result<T> pattern
│       └── performance-metrics.ts
│
├── components/ui/               # Reusable UI (Button, Text, Icon, Select, Skeleton)
├── context/themes/              # Theme provider + Legend State integration
├── lib/
│   ├── theme.ts                 # Navigation themes
│   └── utils.ts                 # cn() helper
│
└── tests/                       # NOT YET CREATED (jest config exists)
```

**Structure Decision**: Single project (Expo/React Native). A estrutura já existe e segue o padrão MVVM por feature conforme constituição. O trabalho foca em **integração e correções** ao invés de criar do zero.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                             | Why Needed                                  | Simpler Alternative Rejected Because                   |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| Cores hardcodeadas em chat-screen.tsx | Código legado antes do tema ser padronizado | N/A — será corrigido usando variáveis de tema          |
| Auto-load comentado no \_layout.tsx   | Feature incompleta (T046)                   | N/A — será descomentado e corrigido com paths corretos |
| ModelSelectorFooter não integrado     | Componente criado mas não usado             | N/A — será integrado na ChatScreen                     |

## Phase 0: Research

### Unknowns & Research Tasks

| Unknown                                  | Research Task                                                                                | Resolution                                                                                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Download não salva modelo no dispositivo | Investigar fluxo completo de download → verificar onde `setDownloadedModel` deve ser chamado | ✅ Resolvido: `downloadModel` não chamava `setDownloadedModel` após sucesso — já corrigido em commit anterior                                                   |
| Auto-load do modelo ativo no launch      | Verificar path correto do arquivo GGUF persistido vs path usado no `loadModel`               | **Resolved**: `getActiveModel()` retorna modelId, mas `loadModel` precisa do path completo. Usar `getDownloadedModels()` para resolver path → `file://${path}`  |
| ModelSelectorFooter integração           | Verificar props necessários e como conectar ao ViewModel                                     | **Resolved**: Componente já existe com props `onSelectModel`. Conectar ao `use-models-vm` via `downloadedModels.get()` e `loadModel()`                          |
| ChatInput component                      | Verificar se usa componentes UI do projeto ou TextInput nativo                               | **Resolved**: Usa `TextInput` nativo + `Button` do `components/ui/`. Cores de placeholder hardcodeadas — usar tema                                              |
| Persistência de conversas                | Verificar se MMKV está salvando corretamente                                                 | **Resolved**: `ChatService` usa `createMMKV({ id: "chat_conversations" })` — funciona corretamente. Bug reportado era no download de modelos, não nas conversas |

### Consolidated Research Findings

**Decision**: Corrigir `ModelManager.downloadModel()` para chamar `setDownloadedModel(fileName, result.uri)` após download bem-sucedido.
**Rationale**: O download baixa o arquivo mas não persiste o mapeamento modelId → path. Sem isso, `getDownloadedModels()` retorna vazio e o modelo não aparece como "Disponível".
**Alternatives considered**: Salvar em outro storage (SQLite), mas MMKV já é usado para config de modelos — manter consistência.

**Decision**: Auto-load no launch usará `getDownloadedModels()` para resolver path do modelo ativo.
**Rationale**: `getActiveModel()` retorna apenas o ID. O path completo está no mapa retornado por `getDownloadedModels()`. Concatenar com `file://` para passar ao `loadModel`.
**Alternatives considered**: Persistir path completo no `setActiveModel`, mas duplicaria informação. Resolver via mapa é mais limpo.

**Decision**: Integrar `ModelSelectorFooter` na `ChatScreen` abaixo do `FlatList`.
**Rationale**: Componente já existe e está pronto. Só precisa ser renderizado e conectado ao ViewModel.
**Alternatives considered**: Modal picker, mas footer é mais discoverable e menos intrusivo.

**Decision**: Substituir cores hardcodeadas por variáveis de tema em `chat-screen.tsx`.
**Rationale**: Constituição exige uso de sistema de design. Cores `#3b82f6` e `#ef4444` devem usar `bg-primary`, `text-destructive`, etc.
**Alternatives considered**: Manter hardcodeadas para "performance" — impacto insignificante com NativeWind.

**Decision**: Contexto de conversa = últimas 10 mensagens (5 trocas), truncamento automático ao exceder 4096 tokens.
**Rationale**: Definido na clarificação (Q1=A, Q2=A). Equilíbrio entre contexto útil e performance de RAM.
**Alternatives considered**: Toda a conversa (muito pesado), apenas última mensagem (perde contexto).

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](./data-model.md)

### Contracts

N/A — Projeto é app mobile 100% local. Não há APIs externas, contratos de serviço remoto ou interfaces públicas além dos componentes UI internos (que já estão tipados via TypeScript).

### Agent Context Update

See [quickstart.md](./quickstart.md)

---

## Implementation Scope

### What's Already Built ✅

| Component                                | Status                       | Notes                                                            |
| ---------------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| Chat Screen (6 UX states)                | ✅ Complete                  | `chat-screen.tsx` com FlatList, streaming, cancel, error display |
| ChatInput                                | ✅ Complete                  | Validação 10k chars, disabled states                             |
| MessageBubble                            | ✅ Complete                  | User/assistant/system styling                                    |
| EmptyChat                                | ✅ Complete                  | Placeholder quando sem mensagens                                 |
| GeneratingIndicator                      | ✅ Complete                  | Spinner + "Pensando..."                                          |
| Chat ViewModel (Legend State)            | ✅ Complete                  | observables, sendMessage, cancelGeneration, syncModelStatus      |
| Chat Service (MMKV)                      | ✅ Complete                  | CRUD conversas, append mensagens, índice                         |
| History Screen                           | ✅ Complete                  | Lista, rename/delete, pull-to-refresh                            |
| History ViewModel                        | ✅ Complete                  | loadConversations, loadFull, delete, rename                      |
| Models Screen                            | ✅ Complete                  | Catálogo, progresso, RAM warning                                 |
| Models ViewModel                         | ✅ Complete                  | browseModels, downloadModel, loadModel, unloadModel              |
| Model Catalog (static)                   | ✅ Complete                  | 3 modelos Qwen 2.5 GGUF                                          |
| ModelManager (download/load/unload)      | ✅ Complete (bug fix needed) | Download não persistia path — corrigido                          |
| LocalAIRuntimeService                    | ✅ Complete                  | llama.rn wrapper, streaming, timeout 60s                         |
| UI Components (Button, Text, Icon, etc.) | ✅ Complete                  | shadcn-style com CVA                                             |
| Theme System                             | ✅ Complete                  | Dark/light com NativeWind vars                                   |

### What Needs to Be Done 🔧

| Task                                      | Priority | Details                                                                              |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| **1. Corrigir download → persistência**   | P0       | `downloadModel` agora chama `setDownloadedModel` — validar fluxo completo            |
| **2. Habilitar auto-load no launch**      | P0       | Descomentar código em `_layout.tsx`, resolver path via `getDownloadedModels()`       |
| **3. Integrar ModelSelectorFooter**       | P1       | Adicionar na `ChatScreen`, conectar ao ViewModel                                     |
| **4. Corrigir cores hardcodeadas**        | P1       | Substituir `#3b82f6`, `#ef4444` por classes de tema                                  |
| **5. Implementar contexto de conversa**   | P1       | Enviar últimas 10 mensagens como contexto ao modelo                                  |
| **6. Implementar truncamento automático** | P2       | Quando conversa exceder 4096 tokens, truncar mensagens antigas                       |
| **7. Ajustar tela de Modelos**            | P2       | Melhorar UX de remoção (confirmação), status updates em tempo real                   |
| **8. Ajustar tela de Histórico**          | P2       | Navegação correta para Chat ao selecionar conversa                                   |
| **9. Ajustar tela de Chat**               | P2       | Mensagem inicial mais clara quando sem modelo, CTA para aba Modelos                  |
| **10. Criar testes**                      | P3       | Fora do escopo imediato — criar estrutura `tests/` e primeiros testes do ChatService |
