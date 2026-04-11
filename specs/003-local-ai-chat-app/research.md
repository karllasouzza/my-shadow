# Research: Local AI Chat Application

**Date**: 10 de abril de 2026
**Feature**: 003-local-ai-chat-app

---

## Decision 1: Download não persistia path do modelo

**Context**: O `ModelManager.downloadModel()` realizava o download do arquivo GGUF via `FileSystem.createDownloadResumable` com sucesso, mas não salvava o mapeamento `modelId → localPath` no MMKV. Isso fazia com que `getDownloadedModels()` retornasse `{}`, e o modelo nunca aparecia como "Disponível" na UI.

**Decision**: Adicionar chamada a `this.setDownloadedModel(fileName, result.uri)` imediatamente após download bem-sucedido, antes de retornar `ok(result.uri)`.

**Rationale**: O `setDownloadedModel` já existe e serializa corretamente um mapa `{ modelId: path }` como JSON no MMKV. Era apenas uma chamada faltante no fluxo de download.

**Alternatives considered**:
- Persistir path em arquivo separado no filesystem — mais complexo, sem benefício real
- Usar SQLite para registro de downloads — overkill para um mapa simples de chave-valor
- Persistir no `setActiveModel` — conflitaria com a lógica de modelo ativo vs modelos baixados

**Status**: ✅ **RESOLVIDO** — Correção aplicada em `shared/ai/model-manager.ts`

---

## Decision 2: Auto-load do modelo ativo no app launch

**Context**: O código de auto-load está comentado em `app/_layout.tsx` (T046). O problema é que `getActiveModel()` retorna apenas o `modelId` (string), mas `loadModel()` precisa do path completo do arquivo GGUF (`file:///var/.../models/model.gguf`).

**Decision**: Usar `getDownloadedModels()` para resolver o path a partir do modelId, então concatenar com `file://` se necessário e passar ao `loadModel()`.

**Fluxo corrigido**:
```typescript
const manager = getModelManager();
const activeModelId = manager.getActiveModel(); // ex: "qwen2.5-0.5b"
if (activeModelId) {
  const downloaded = manager.getDownloadedModels(); // { "qwen2.5-0.5b": "file:///var/.../model.gguf" }
  const modelPath = downloaded[activeModelId];
  if (modelPath) {
    await manager.loadModel(activeModelId, modelPath);
  }
}
```

**Rationale**: O `getDownloadedModels()` já retorna o mapa completo com paths absolutos. Não precisa persistir informação duplicada. O `setDownloadedModel` já salva o `result.uri` que é o path absoluto.

**Alternatives considered**:
- Persistir path completo no `setActiveModel` — duplicaria dado, risco de inconsistência
- Armazenar apenas filename e reconstruir path — frágil, quebra com migration de diretórios
- Usar SQLite como índice — overkill, MMKV já resolve

**Status**: ✅ **RESOLVIDO** — Implementar no `_layout.tsx` descomentando e corrigindo lógica

---

## Decision 3: Integração do ModelSelectorFooter na ChatScreen

**Context**: O componente `ModelSelectorFooter` existe em `features/chat/components/model-selector-footer.tsx` mas não é renderizado na `ChatScreen`.

**Decision**: Adicionar `<ModelSelectorFooter />` abaixo do `FlatList` (dentro do `KeyboardAvoidingView`), condicional quando há modelos baixados. Conectar ao ViewModel via `getDownloadedModels()` do `ModelManager`.

**Rationale**: O footer já existe e está tipado. Só precisa de integração na view e conexão com o estado de modelos baixados.

**Alternatives considered**:
- Modal picker — mais intrusivo, menos discoverable
- Header dropdown — conflita com design atual de tabs
- Botão flutuante (FAB) — menos óbvio que footer fixo

**Status**: ✅ **RESOLVIDO** — Implementar na `chat-screen.tsx`

---

## Decision 4: Cores hardcodeadas na ChatScreen

**Context**: `chat-screen.tsx` tem cores hardcodeadas (`#3b82f6` para tabBar, `#ef4444` para botão de cancelar), violando a constituição do projeto.

**Decision**: Substituir todas as cores hardcodeadas por classes NativeWind do tema:
- `#3b82f6` (azul) → usar `hsl(var(--primary))` ou classe `bg-primary`
- `#ef4444` (vermelho) → usar `hsl(var(--destructive))` ou classe `text-destructive`
- `#6B7280` (cinza) → usar `hsl(var(--muted-foreground))`

**Rationale**: O sistema de tema já está configurado com variáveis CSS no `global.css`. Usá-las garante consistência e suporte a dark mode automático.

**Status**: ✅ **RESOLVIDO** — Corrigir em `chat-screen.tsx` e `_layout.tsx`

---

## Decision 5: Contexto de conversa na inferência

**Context**: O `sendMessage` atual envia apenas a mensagem do usuário ao modelo, sem incluir o histórico como contexto. Para conversas coerentes, o modelo precisa das mensagens anteriores.

**Decision**: Enviar as **últimas 10 mensagens** (5 trocas usuário-IA) como contexto formatado no prompt. Quando a conversa exceder o limite de 4096 tokens do modelo, truncar automaticamente as mensagens mais antigas.

**Formato do prompt**:
```
<|system|>
Você é um assistente útil e amigável.
<|user|>
{mensagem_usuario_1}
<|assistant|>
{resposta_ia_1}
...
<|user|>
{mensagem_usuario_atual}
```

**Rationale**: 10 mensagens é equilíbrio entre contexto útil e consumo de RAM. Modelos 0.5B-3B precisam de contexto limitado para caber em n_ctx=4096.

**Alternatives considered**:
- Toda a conversa — excede 4096 tokens facilmente, crash em dispositivos com pouca RAM
- Apenas última mensagem — IA perde contexto, respostas incoerentes
- Contagem dinâmica baseada no tamanho das mensagens — complexidade adicional sem benefício claro

**Status**: ✅ **RESOLVIDO** — Implementar no `ChatService.generateResponse()` ou no ViewModel

---

## Decision 6: Persistência de modelos baixados

**Context**: O formato de persistência no MMKV usa a key `model:downloaded` com valor JSON: `{ "modelId": "file:///var/mobile/.../models/model.gguf" }`.

**Decision**: Manter este formato. É simples, eficiente (single get/set), e compatível com a migração de paths legacy já implementada em `shared/ai/manager/paths.ts`.

**Status**: ✅ **RESOLVIDO** — Formato já correto, apenas garantir que `setDownloadedModel` seja chamado

---

## Decision 7: Best practices para download resumível

**Context**: `expo-file-system/legacy` oferece `createDownloadResumable` com callback de progresso e `cancelAsync()`.

**Decision**: Usar padrão já implementado no `ModelManager`:
- Progresso via callback `(downloadProgress) => onProgress?.(percent)`
- Cancelamento via `cancelAsync()` + flag `cancelled`
- Cleanup de arquivo `.part` em caso de falha/cancelamento
- Validação de espaço em disco antes do download (buffer 100MB)

**Status**: ✅ **RESOLVIDO** — Implementação já robusta, apenas garantir persistência pós-download

---

## Summary

Todos os NEEDS CLARIFICATION do Phase 0 foram resolvidos. As decisões acima informam o design em `data-model.md` e as tarefas em `tasks.md`.

**Principais findings**:
1. Bug de download era falta de chamada a `setDownloadedModel` — corrigido
2. Auto-load requer resolver path via `getDownloadedModels()` — implementar
3. ModelSelectorFooter já existe — apenas integrar
4. Cores hardcodeadas violam constituição — corrigir com tema
5. Contexto de conversa = 10 msgs, truncamento em 4096 tokens — implementar no prompt
