# Data Model: Local AI Chat Application

**Date**: 10 de abril de 2026
**Feature**: 003-local-ai-chat-app

---

## Entidades Principais

### 1. ChatConversation

Representa uma conversa completa entre usuário e IA.

**Persistência**: MMKV (key: `chat:conversations:{id}`)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | UUID único da conversa |
| `title` | `string` | Título auto-gerado (primeira mensagem) ou personalizado |
| `messages` | `ChatMessage[]` | Lista ordenada de mensagens |
| `createdAt` | `number` | Timestamp de criação (ms) |
| `updatedAt` | `number` | Timestamp da última atualização (ms) |
| `modelId` | `string \| null` | ID do modelo usado (para referência futura) |

**Regras de Validação**:
- `title`: mínimo 1 char, máximo 100 chars
- `messages`: pelo menos 1 mensagem para conversa ser válida
- `updatedAt`: sempre >= `createdAt`
- `updatedAt`: atualizado a cada nova mensagem (enviada ou recebida)

**Auto-geração de título**: Na primeira mensagem, gerar título truncando a mensagem para 50 chars + "..." se exceder.

**State Transitions**:
```
[Criada] → [Primeira mensagem enviada] → title auto-gerado
[Ativa] → [Nova mensagem] → updatedAt atualizado
[Ativa] → [Renomeada] → title atualizado
[Ativa] → [Excluída] → removida do MMKV e do índice
```

---

### 2. ChatMessage

Mensagem individual dentro de uma conversa.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `role` | `'user' \| 'assistant' \| 'system'` | Papel da mensagem |
| `content` | `string` | Texto da mensagem |
| `timestamp` | `number` | Timestamp de envio (ms) |
| `tokenCount` | `number \| null` | Estimativa de tokens (opcional, para controle de contexto) |

**Regras de Validação**:
- `content`: mínimo 1 char, máximo 10.000 chars (para mensagens de usuário)
- `role`: deve ser um dos 3 valores válidos
- Mensagens de `system`: usadas para prompt inicial (não editável pelo usuário)
- Mensagens de `assistant`: geradas via streaming, persistidas ao completar

---

### 3. ChatConversationIndex

Índice de todas as conversas para listagem rápida no Histórico.

**Persistência**: MMKV (key: `chat:conversation:index`)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `{conversationId}` | `IndexEntry` | Entry por conversa |

**IndexEntry**:
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | ID da conversa |
| `title` | `string` | Título |
| `updatedAt` | `number` | Última atualização |
| `lastMessagePreview` | `string` | Preview da última mensagem (truncado a 80 chars) |

**Ordenação**: Lista ordenada por `updatedAt` decrescente (mais recente primeiro).

---

### 4. AIModel (ModelCatalogEntry)

Modelo de IA disponível no catálogo estático.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | Identificador único (ex: `qwen2.5-0.5b`) |
| `name` | `string` | Nome exibido na UI (ex: "Qwen 2.5 0.5B") |
| `description` | `string` | Descrição curta do modelo |
| `fileSizeBytes` | `number` | Tamanho do arquivo GGUF em bytes |
| `downloadUrl` | `string` | URL completa para download (HuggingFace) |
| `estimatedRamMB` | `number` | RAM estimada necessária para carregar (MB) |
| `params` | `string` | Contagem de parâmetros (ex: "0.5B") |

**Catálogo atual** (em `shared/ai/catalog/data.ts`):
- `qwen2.5-0.5b` — 300MB, ~1GB RAM
- `qwen2.5-1.5b` — 900MB, ~2GB RAM
- `qwen2.5-3b` — 1.8GB, ~4GB RAM

---

### 5. DownloadedModel (Persistência)

Registro de modelo baixado no dispositivo.

**Persistência**: MMKV (key: `model:downloaded`, valor: JSON string)

**Formato**:
```json
{
  "qwen2.5-0.5b": "file:///var/mobile/.../models/qwen2.5-0.5b.gguf",
  "qwen2.5-1.5b": "file:///var/mobile/.../models/qwen2.5-1.5b.gguf"
}
```

| Campo (key) | Tipo | Descrição |
|-------------|------|-----------|
| `{modelId}` | `string` | Path absoluto do arquivo GGUF (URI) |

---

### 6. ModelStatus (UI State)

Estado de um modelo na UI de gerenciamento.

| Valor | Descrição |
|-------|-----------|
| `not-downloaded` | Modelo não baixado — ação disponível: "Baixar" |
| `downloading` | Download em andamento — exibir barra de progresso |
| `downloaded` | Modelo baixado, pronto para carregar — ação: "Carregar" |
| `loaded` | Modelo carregado na memória — ação: "Em uso", "Descarregar" |
| `failed` | Falha no download ou load — ação: "Retry" |

---

### 7. DownloadState

Estado de um download em andamento.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `active` | `boolean` | Se download está ativo |
| `progress` | `number` | Progresso percentual (0-100) |
| `cancelled` | `boolean` | Se foi cancelado pelo usuário |
| `resumable` | `DownloadResumable \| null` | Referência ao objeto resumível do FileSystem |

---

## Relacionamentos

```
ChatConversation 1 ─── N ChatMessage
  └─ messages[] ──────→ [role, content, timestamp, tokenCount]

ChatConversationIndex N ─── 1 ChatConversation
  └─ id ──────────────→ ChatConversation.id

AIModel 1 ─── 0..1 DownloadedModel
  └─ id ──────────────→ key no mapa model:downloaded

AIModel 1 ─── 1 ModelStatus (runtime)
  └─ id ──────────────→ status derivado do estado local
```

---

## Regras de Contexto de Conversa

### Limite de Contexto

- **n_ctx máximo**: 4096 tokens (configurado no `llama.rn`)
- **Mensagens como contexto**: Últimas 10 mensagens (5 trocas usuário-IA)
- **Reserva para resposta**: 512 tokens reservados para resposta do modelo
- **Contexto efetivo para input**: ~3584 tokens disponíveis

### Truncamento Automático

Quando a soma de tokens das últimas 10 mensagens excede ~3584 tokens:
1. Contar tokens de trás para frente (mais recente → mais antigo)
2. Incluir mensagens até atingir limite
3. Descartar mensagens mais antigas silenciosamente
4. Manter system prompt sempre como primeira mensagem

### Formato do Prompt para Inferência

```
<|system|>
{system_prompt}
<|user|>
{user_message_1}
<|assistant|>
{assistant_response_1}
...
<|user|>
{user_message_atual}
```

---

## Validações de Storage

### Disk Space (antes do download)

- Verificar espaço livre via `FileSystem.getInfoAsync()`
- Requisito: `fileSizeBytes + 100MB` de buffer
- Se insuficiente: retornar erro `STORAGE_ERROR` com mensagem clara

### RAM (antes do load)

- Verificar RAM total via `DeviceInfo.getTotalMemory()`
- Requisito: `estimatedRamMB` do modelo
- Se insuficiente: exibir warning mas permitir carregamento (usuário decide)

### MMKV Limits

- MMKV suporta até ~1MB por instância (suficiente para 50 conversas)
- Conversas grandes (>100 mensagens): considerar paginar ou arquivar
- `model:downloaded`: mapa pequeno (3-10 entries), sem risco de overflow
