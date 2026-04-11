# Quickstart: Local AI Chat Application

**Date**: 10 de abril de 2026
**Feature**: 003-local-ai-chat-app

---

## Setup do Ambiente

### Pré-requisitos

- **Node.js** 20+ (recomendado 22+)
- **Bun** (package manager do projeto)
- **Expo CLI** (instalado via dependências)
- **Xcode** (para iOS) ou **Android SDK** (para Android)
- Dispositivo físico recomendado (simulador pode ser lento para inferência IA)

### Instalação

```bash
# Instalar dependências
bun install

# Verificar instalação
bun run ci
```

### Rodar o App

```bash
# Desenvolvimento (metro bundler)
bun run start

# iOS (requer macOS + Xcode)
bun run ios

# Android
bun run android

# Web (fallback, sem suporte a llama.rn)
bun run web
```

### Build para Dispositivo

```bash
# Build de desenvolvimento (dev client)
npx expo run:ios --variant Debug
npx expo run:android --variant Debug

# Ou usar EAS Build para cloud build
npx eas build --platform ios --profile development
npx eas build --platform android --profile development
```

---

## Estrutura do Projeto

### Arquitetura

O projeto segue **MVVM por feature** com **Legend State** para gerenciamento de estado reativo:

```
features/<feature-name>/
├── model/           # Tipos e interfaces (entidades)
├── service/         # Lógica de negócio pura (sem estado UI)
├── view-model/      # Observables Legend State + actions
├── view/            # Telas/screens (Expo Router)
└── components/      # Componentes específicos da feature
```

### Camadas de IA

```
shared/ai/
├── catalog/         # Catálogo estático de modelos (3 Qwen GGUF)
├── manager/         # ModelManager: download, load, unload, persist
├── runtime/         # LocalAIRuntimeService: wrapper do llama.rn
└── model-manager.ts # Re-export do service principal
```

### Padrões de Código

- **TypeScript estrito**: `strict: true`, sem `any`
- **Erros**: Padrão `Result<T>` com `ok(value)` / `err(error)`
- **Estado**: Legend State `observable()` + `observer()` para reatividade
- **Estilo**: NativeWind (Tailwind) com variáveis de tema HSL
- **Componentes UI**: `@rn-primitives` + `class-variance-authority`

---

## Fluxos Principais

### 1. Download de Modelo

```
User taps "Baixar" → use-models-vm.downloadModel()
  → ModelManager.downloadModel(url, path, onProgress)
    → FileSystem.createDownloadResumable()
    → Progress callbacks → vm.downloadProgress
    → On success: setDownloadedModel(id, uri) ← PERSISTE
    → Return ok(uri)
  → vm refreshes catalog status → "Disponível"
```

### 2. Carregar Modelo

```
User taps "Carregar" → use-models-vm.loadModel()
  → ModelManager.hasEnoughRam() → warning if insufficient
  → ModelManager.loadModel(id, path)
    → LocalAIRuntimeService.loadModel(id, filePath)
      → initLlama({ model: filePath, n_ctx: 4096, use_mlock: true })
  → ModelManager.setActiveModel(id) ← PERSIST
  → vm syncModelStatus() → "Em uso"
```

### 3. Enviar Mensagem

```
User types + send → use-chat-vm.sendMessage(text)
  → Validate text length (≤ 10,000 chars)
  → Create ChatMessage(role: 'user')
  → Append to currentConversation
  → Build context prompt (last 10 messages)
  → LocalAIRuntimeService.generateCompletion(prompt, onToken)
    → Streaming token-by-token → vm.streamingText
  → On complete: append assistant message
  → Save conversation to MMKV
```

### 4. Auto-load no Launch

```
App starts → _layout.tsx
  → getModelManager().getActiveModel() → modelId
  → getModelManager().getDownloadedModels() → { id: path }
  → If active model exists in downloaded map:
    → getModelManager().loadModel(id, path)
    → → initLlama() → model ready for chat
```

---

## Testes

```bash
# Rodar todos os testes
bun test

# Watch mode
bun test:watch

# Com coverage (quando testes existirem)
bun test --coverage
```

**Nota**: A estrutura de `tests/` ainda não foi criada. Configuração do Jest já existe com mocks para `llama.rn`, `expo-file-system`, e `op-sqlite`.

---

## Linting e Typecheck

```bash
# Lint
bun lint

# Typecheck (via TypeScript)
npx tsc --noEmit
```

---

## Recursos Úteis

- **CONSTITUTION.md**: Princípios e padrões do projeto na raiz
- **specs/003-local-ai-chat-app/spec.md**: Especificação completa
- **specs/003-local-ai-chat-app/research.md**: Decisões técnicas
- **specs/003-local-ai-chat-app/data-model.md**: Modelos de dados
