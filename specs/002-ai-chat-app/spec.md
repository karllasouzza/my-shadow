# Feature Specification: AI Chat App Restructure

**Feature Branch**: `002-ai-chat-app`
**Created**: 2026-04-09
**Status**: Draft
**Input**: User description: "Transformar app em chat AI com telas de histórico e chat, modelo selecionado/baixado na tela de chat (llama.rn local)"

## Clarifications

### Session 2026-04-09

- Q: How much of the existing Reflection behavior should be preserved inside the Chat screen vs. replaced with standard chat UX? → A: Reflection is fully removed. Chat screen is a clean-slate implementation with no inherited reflection logic (guided questions, RAG, tone guard all removed).
- Q: How should the user navigate between Chat and History screens? → A: Stack navigation — Chat is the primary root screen. History is accessed via stack push (e.g., tapping a button in the chat header). Back navigation returns to the active conversation.

### Session 2026-04-09 (Architecture)

- Q: Ownership boundary between shared/ai/ and feature services? → A: (B) shared/ai/ owns inference + full model lifecycle (download, verify, load, generate). features/chat/service/ keeps only MMKV conversation CRUD. shared/ai/ is the single owner of all AI operations.
- Q: Component placement strategy? → A: (A) Co-locate components inside each feature module — features/chat/components/, features/history/components/, features/model-management/components/. Root components/ removed for feature-specific UI; only cross-cutting design tokens remain.
- Q: Model manager location? → A: (A) model-manager.ts moves to shared/ai/model-manager.ts. It is the single source of truth for the model lifecycle (download → verify → load). Features import from shared/ai/, never manage models directly.
- Clarification: Separate model selection/download into its own feature module (features/model-management/) with its own screen, VM, and components. Onboarding feature fully removed — no files, no imports, no dependencies remain.
- Clarification: Audit entire project for unused/deprecated files, imports, and dependencies after restructuring. Clean bundle must have zero dangling references to removed features.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Start a New Chat Conversation (Priority: P1)

O usuário abre o app e vê a tela principal de chat. Seleciona um modelo local (baixa se necessário), digita uma mensagem e recebe uma resposta da IA rodando localmente no dispositivo. Nenhuma dados sai do dispositivo.

**Why this priority**: É o fluxo principal do produto — sem conversa funcional, o app não entrega valor.

**Independent Test**: Pode ser testado abrindo a tela de chat, carregando um modelo local e enviando uma mensagem — a resposta da IA deve aparecer na tela.

**Acceptance Scenarios**:

1. **Given** modelo local já baixado e carregado, **When** usuário digita mensagem e envia, **Then** resposta da IA aparece progressivamente na tela (streaming)
2. **Given** nenhum modelo baixado, **When** usuário abre tela de chat, **Then** interface de seleção/download de modelo é exibida antes do campo de input
3. **Given** usuário enviou mensagem, **When** IA está gerando resposta, **Then** indicador de progresso é exibido e usuário pode cancelar geração

---

### User Story 2 — Manage AI Models (Priority: P1)

O usuário acessa a tela de Gerenciamento de Modelos (via botão no header do Chat), onde pode ver o catálogo de modelos GGUF, baixar novos modelos, carregar um modelo na memória, e trocar entre modelos baixados. O modelo selecionado persiste entre sessões.

**Why this priority**: Sem modelo carregado, o chat não funciona. O gerenciamento deve ser acessível mas não bloquear a conversa quando um modelo já está carregado.

**Independent Test**: Pode ser testado abrindo a tela de modelos, selecionando um do catálogo, fazendo download, carregando na memória — e verificando que o chat reconhece o modelo ativo.

**Acceptance Scenarios**:

1. **Given** nenhum modelo baixado, **When** usuário abre Gerenciamento de Modelos, **Then** catálogo é exibido com botão de download e indicador de tamanho/RAM
2. **Given** download completo, **When** usuário seleciona modelo, **Then** modelo é carregado na memória e badge de "carregado" é exibido
3. **Given** múltiplos modelos baixados, **When** usuário abre gerenciador, **Then** lista de modelos baixados é exibida com opção de carregar/descarregar cada um
4. **Given** modelo já carregado, **When** usuário volta ao Chat, **Then** badge no header mostra nome do modelo ativo e input está habilitado

---

### User Story 3 - View and Resume Chat History (Priority: P2)

O usuário navega da tela de Chat para o Histórico (via botão no header), acessa conversas anteriores, visualiza o conteúdo e pode retomar qualquer conversa existente. Ao selecionar uma conversa, o app retorna à tela de Chat com aquela conversa carregada.

**Why this priority**: Permite continuidade de conversas e reuso de contexto — valor significativo mas não bloqueante para MVP.

**Independent Test**: Pode ser testado criando uma conversa, navegando para histórico, selecionando conversa anterior e verificando que mensagens são exibidas corretamente na tela de Chat.

**Acceptance Scenarios**:

1. **Given** conversas anteriores existem, **When** usuário abre Histórico via botão no header do Chat, **Then** lista de conversas é exibida ordenada por data mais recente
2. **Given** usuário seleciona conversa do histórico, **When** conversa abre, **Then** app retorna à tela de Chat com todas as mensagens anteriores exibidas e usuário pode continuar enviando mensagens
3. **Given** nenhuma conversa existe, **When** usuário abre tela de Histórico, **Then** estado vazio amigável é exibido com call-to-action para iniciar nova conversa

---

### User Story 4 - Manage Chat Conversations (Priority: P3)

O usuário pode renomear, excluir e organizar conversas do histórico.

**Why this priority**: Melhora a experiência de uso a longo prazo, mas não é necessário para o primeiro uso do app.

**Independent Test**: Pode ser testado criando uma conversa, renomeando e excluindo — verificando que ações persistem corretamente.

**Acceptance Scenarios**:

1. **Given** conversa existe no histórico, **When** usuário renomeia conversa, **Then** novo título é persistido e exibido na lista
2. **Given** conversa existe no histórico, **When** usuário exclui conversa, **Then** conversa é removida permanentemente com confirmação prévia
3. **Given** usuário confirma exclusão, **When** conversa é deletada, **Then** todas as mensagens e contexto associado são removidos do dispositivo

---

### User Story 5 - Privacy-First Local Processing (Priority: P1)

Todas as conversas e processamento de IA ocorrem localmente no dispositivo. Nenhum dado de conversa é enviado para servidores externos.

**Why this priority**: Diferencial competitivo e promessa central de privacidade do produto.

**Independent Test**: Pode ser testado verificando que nenhuma requisição de rede é feita durante geração de respostas e que dados de conversa persistem apenas em storage local.

**Acceptance Scenarios**:

1. **Given** app está em uso, **When** usuário envia mensagem, **Then** nenhuma requisição de rede externa é feita para geração de resposta
2. **Given** conversa é criada, **When** dados são persistidos, **Then** armazenamento é exclusivamente local (MMKV/SQLite) sem sincronização cloud

---

### Testing Strategy _(mandatory)_

- **Unit tests**: Testar view-models de chat, model-management, message-parsing e chat-history repository com mocks do motor de inferência local
- **Integration tests**: Testar fluxo completo de download-model → load-model → generate-completion → save-chat com mocks de native modules
- **End-to-end tests**: Simular fluxo de usuário: abrir app → navegar para modelos → baixar modelo → carregar → enviar mensagem → verificar resposta → salvar no histórico
- **Regression tests**: Garantir que remoção de reflection, review e onboarding é limpa — features/ e shared/ não têm imports residuais

### Edge Cases

- Modelo falha ao carregar após download completo (corrompido) — app deve permitir retry ou seleção de outro modelo
- Usuário envia mensagem enquanto modelo ainda está carregando — input deve estar bloqueado com indicador de estado
- Histórico de chat cresce indefinidamente — app deve suportar pelo menos 1000 conversas sem degradação perceptível
- Dispositivo com pouca RAM para modelo selecionado — app deve avisar usuário antes de carregar modelo incompatível
- Usuário fecha app durante geração de resposta — conversa parcial deve ser salva e recuperável

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O app MUST exibir a tela de Chat como tela raiz principal, com acesso ao Histórico de Chat via navegação em stack (botão no header do chat).
- **FR-002**: A tela de Chat MUST permitir envio de mensagens de texto e exibição de respostas da IA com streaming progressivo
- **FR-003**: O app MUST permitir navegação à tela de Gerenciamento de Modelos via botão no header do Chat (stack push/pop).
- **FR-004**: A tela de Gerenciamento de Modelos MUST exibir catálogo de modelos GGUF com download, progresso, e status de carregamento.
- **FR-005**: O app MUST carregar modelo GGUF baixado em memória via shared/ai (model lifecycle) antes de permitir envio de mensagens no Chat.
- **FR-006**: O app MUST persistir conversas localmente com título, timestamp e lista de mensagens (role + content) — responsabilidade de features/chat/service/, não de shared/ai/.
- **FR-007**: O Histórico de Chat MUST listar conversas ordenadas por timestamp decrescente
- **FR-008**: O app MUST permitir retomar conversa do histórico, exibindo mensagens anteriores e permitindo continuidade
- **FR-009**: O app MUST permitir renomear título de conversa no histórico
- **FR-010**: O app MUST permitir excluir conversa do histórico com confirmação prévia
- **FR-011**: O app MUST exibir estado vazio amigável quando nenhuma conversa existe no histórico
- **FR-012**: O Chat MUST exibir indicador de modelo carregado (badge no header) e bloquear input enquanto nenhum modelo está pronto.
- **FR-013**: O app MUST permitir cancelar geração de resposta em andamento
- **FR-014**: O Gerenciamento de Modelos MUST validar espaço em disco disponível antes de iniciar download de modelo.
- **FR-015**: O Gerenciamento de Modelos MUST informar usuário se RAM do dispositivo é insuficiente para modelo selecionado antes de carregar.
- **FR-016**: O modelo ativo (carregado) MUST persistir entre sessões — ao reabrir o app, o último modelo carregado é restaurado automaticamente.

### Code Quality Requirements _(mandatory)_

- **CQ-001**: Changes MUST pass linting and static type checks in CI.
- **CQ-002**: New logic MUST reuse existing shared abstractions where feasible, or document why a new abstraction is required.
- **CQ-003**: Feature complexity risks MUST be documented with mitigation steps before implementation.

### UX Consistency Requirements _(mandatory for user-facing changes)_

- **UX-001**: User-facing changes MUST use established design tokens, spacing, typography, and shared UI primitives from the project's design system.
- **UX-002**: Each affected flow MUST define loading, empty, success, and error states — specifically: Chat screen (no model loaded, generating response, error), History screen (no conversations, loading list, empty state), Model Management screen (no models downloaded, downloading, loading model, download failed, RAM warning).
- **UX-003**: Accessibility expectations (labels, readable contrast, input feedback) MUST be specified for chat input, message bubbles, model selector, download progress indicator, and history navigation button in chat header.

### Performance Requirements _(mandatory)_

- **PF-001**: Primeira resposta de IA DEVE começar a ser exibida (primeiro token) em até 5 segundos após envio da mensagem com modelo 0.5B carregado
- **PF-002**: Streaming de tokens DEVE exibir novo token na tela em até 200ms após geração (percepção de fluidez)
- **PF-003**: Lista de histórico DEVE renderizar 100 conversas em menos de 500ms
- **PF-004**: Validação de performance será feita via profiling em dispositivo com 4GB RAM usando modelo 0.5B quantizado
- **PF-005**: Se performance de geração exceder 30 segundos para resposta completa, app deve oferecer opção de cancelar e exibir aviso de dispositivo pode não suportar modelo

### Key Entities _(include if feature involves data)_

- **ChatConversation**: Representa uma conversa completa com a IA. Possui título (auto-gerado ou customizado), timestamp de criação, timestamp da última mensagem, lista ordenada de mensagens e referência ao modelo utilizado.
- **ChatMessage**: Mensagem individual dentro de uma conversa. Possui role (user, assistant, system), conteúdo textual e timestamp de criação.
- **ModelConfiguration**: Catálogo de modelos GGUF disponíveis para download. Contém id, nome exibido, URL de download, tamanho do arquivo, RAM estimada e status de download (pending, downloading, completed, failed).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Usuário pode iniciar uma conversa e receber primeira resposta da IA em menos de 30 segundos (incluindo tempo de carregamento do modelo) a partir da abertura do app
- **SC-002**: Usuário pode completar download e carregamento de um modelo 0.5B em menos de 3 minutos em conexão 4G estável
- **SC-003**: 95% das respostas de IA iniciam streaming de tokens em até 5 segundos após envio da mensagem
- **SC-004**: Lista de histórico de chat renderiza em menos de 500ms com até 100 conversas
- **SC-005**: Usuário consegue realizar fluxo completo (abrir app → selecionar modelo → enviar mensagem → receber resposta) sem erros em 90% das tentativas
- **SC-006**: 0 lint/type errors introduced e review findings resolved before merge
- **SC-007**: All required new tests fail-before-pass and run in CI
- **SC-008**: Critical interaction p95 (tempo para primeiro token) remains under 5 seconds em dispositivo de referência

## Assumptions

- Usuários possuem conectividade de internet para download inicial de modelos GGUF (~350MB para modelo 0.5B)
- Dispositivos alvo possuem mínimo de 4GB de RAM para suportar inferência local
- Funcionalidades existentes de reflection, review e onboarding serão completamente removidas — nenhuma lógica será reaproveitada. O app terá Chat, Gerenciamento de Modelos e Histórico.
- Modelo padrão recomendado é Qwen 2.5 0.5B por equilíbrio entre tamanho e qualidade
- Persistência de conversas será feita via storage local do dispositivo (MMKV) — sem sincronização cloud
- **shared/ai/** é o owner único de toda lógica de IA: inferência (llama.rn wrapper), ciclo de vida do modelo (download → verify → load), e geração de texto. **features/chat/service/** cuida apenas de CRUD de conversas no MMKV.
- Componentes UI são co-localizados em cada feature module (features/chat/components/, features/history/components/, features/model-management/components/). Root components/ é removido para UI específica de feature.
- A feature de Gerenciamento de Modelos é um módulo separado (features/model-management/) com sua própria screen, view-model, e components — acessado via stack navigation a partir do header do Chat.
- Não há necessidade de autenticação ou contas de usuário para uso do app
