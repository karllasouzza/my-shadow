# Feature Specification: Local AI Chat Application

**Feature Branch**: `003-local-ai-chat-app`
**Created**: 10 de abril de 2026
**Status**: Draft
**Input**: User description: "Build an application to chat with local ai (primary screen, model loader selector with dowloaded models), with history chats (screen 2, chat title, timestamp and last message) and model management (screen 3, dowload, remove)"

## Clarifications

### Session 2026-04-10

- Q: Quantas mensagens anteriores devem ser incluídas como contexto ao gerar uma resposta? → A: Últimas 10 mensagens (5 trocas)
- Q: Como o sistema deve se comportar quando a conversa excede o limite de contexto do modelo? → A: Truncar mensagens mais antigas automaticamente

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Chat with Local AI Model (Priority: P1)

Como usuário, quero enviar mensagens para um modelo de IA rodando localmente no meu dispositivo e receber respostas em tempo real, para ter conversas privadas sem depender de serviços externos.

**Why this priority**: Esta é a funcionalidade central do aplicativo - sem capacidade de chat, o app não entrega valor algum. É o MVP absoluto.

**Independent Test**: Pode ser testado completamente carregando um modelo GGUF, enviando uma mensagem e verificando se uma resposta é gerada e exibida na tela. Entrega valor imediato de conversa local.

**Acceptance Scenarios**:

1. **Given** que um modelo de IA está carregado na memória, **When** o usuário digita uma mensagem e envia, **Then** a mensagem aparece na tela e uma resposta é gerada em streaming token-a-token
2. **Given** que nenhum modelo está carregado, **When** o usuário abre a tela de chat, **Then** uma mensagem orienta o usuário a ir para a aba de Modelos para carregar um modelo
3. **Given** que o modelo está gerando uma resposta, **When** o usuário espera mais de 30 segundos, **Then** uma opção de cancelar a geração é exibida
4. **Given** que há uma conversa em andamento, **When** o usuário envia múltiplas mensagens, **Then** todas as mensagens e respostas são exibidas em ordem cronológica com distinção clara entre usuário e IA

---

### User Story 2 - View and Manage Chat History (Priority: P2)

Como usuário, quero visualizar meu histórico de conversas com título, timestamp e última mensagem, para retomar conversas anteriores ou organizar meu histórico.

**Why this priority**: Histórico de conversas é essencial para produtividade - usuários precisam retomar conversas longas e organizar seu trabalho. Sem isso, cada sessão seria perdida.

**Independent Test**: Pode ser testado criando múltiplas conversas, verificando se aparecem na lista com título correto, timestamp formatado e preview da última mensagem, e navegando entre elas.

**Acceptance Scenarios**:

1. **Given** que o usuário teve múltiplas conversas, **When** abre a tela de Histórico, **Then** vê uma lista ordenada por mais recente com título, timestamp relativo (ex: "2h atrás") e preview da última mensagem
2. **Given** que há conversas no histórico, **When** o usuário toca em uma conversa, **Then** a conversa é carregada na tela de Chat com todas as mensagens anteriores
3. **Given** que há uma conversa no histórico, **When** o usuário faz long-press, **Then** opções de renomear e excluir a conversa são apresentadas
4. **Given** que o usuário renomeou uma conversa, **When** visualiza o histórico novamente, **Then** o título atualizado é exibido

---

### User Story 3 - Download and Manage AI Models (Priority: P3)

Como usuário, quero baixar, remover e selecionar modelos de IA para usar no chat, para escolher o modelo que melhor atende minhas necessidades de desempenho e qualidade.

**Why this priority**: Gerenciamento de modelos é pré-requisito para o chat funcionar, mas é uma funcionalidade de configuração. Usuários só interagem com isso ao configurar ou trocar modelos.

**Independent Test**: Pode ser testado baixando um modelo do catálogo, verificando progresso de download, e removendo-o. Entrega valor de gestão de recursos locais.

**Acceptance Scenarios**:

1. **Given** que há modelos disponíveis no catálogo, **When** o usuário inicia o download, **Then** uma barra de progresso é exibida e o modelo é salvo no dispositivo
2. **Given** que um modelo foi baixado, **When** o download termina, **Then** o status muda para "Disponível" e o modelo pode ser selecionado para uso
3. **Given** que há um modelo baixado no dispositivo, **When** o usuário decide removê-lo, **Then** uma confirmação é solicitada antes da exclusão do arquivo
4. **Given** que o dispositivo tem RAM insuficiente para um modelo, **When** o usuário tenta carregar o modelo, **Then** um warning é exibido informando sobre a limitação

---

### User Story 4 - Select and Switch AI Models (Priority: P2)

Como usuário, quero selecionar qual modelo baixado usar no chat e trocar entre modelos facilmente, para experimentar diferentes capacidades de IA sem perder minha conversa atual.

**Why this priority**: Seleção de modelo é essencial para usabilidade - usuários podem ter múltiplos modelos baixados e precisam trocar rapidamente entre eles.

**Independent Test**: Pode ser testado carregando um modelo, verificando que está pronto para chat, descarregando e carregando outro modelo diferente.

**Acceptance Scenarios**:

1. **Given** que há múltiplos modelos baixados, **When** o usuário abre a tela de Chat, **Then** um seletor exibe o modelo atualmente carregado e permite trocar
2. **Given** que o usuário seleciona um modelo diferente, **When** o modelo é carregado, **Then** o status muda para "Pronto" e o chat está disponível
3. **Given** que um modelo está sendo carregado, **When** o processo está em andamento, **Then** um indicador de carregamento é exibido bloqueando o chat até completar

---

### Edge Cases

- **O que acontece quando o download é interrompido por perda de conexão?** O download deve ser resumível quando a conexão retornar
- **Como o sistema lida com armazenamento insuficiente?** Deve exibir erro claro ao usuário antes de iniciar o download se não houver espaço
- **O que acontece quando o app é fechado durante geração de resposta?** A conversa em andamento deve ser salva e recuperável no histórico
- **Como o sistema lida com modelo corrompido?** Deve detectar e oferecer opção de re-download
- **O que acontece quando o usuário envia mensagem durante carregamento de modelo?** Deve informar que o modelo não está pronto e bloquear envio
- **Como o sistema gerencia múltiplas tentativas de load/unload de modelo?** Deve prevenir condições de race e estados inconsistentes
- **O que acontece quando a conversa excede o limite de contexto (4096 tokens)?** O sistema trunca automaticamente as mensagens mais antigas, mantendo as 10 mensagens mais recentes como contexto
- **Como o sistema preserva contexto entre turnos de conversa?** Inclui as últimas 10 mensagens (5 trocas usuário-IA) no prompt de inferência

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST permitir que usuários enviem mensagens de texto para o modelo de IA local e recebam respostas geradas em tempo real via streaming, utilizando as últimas 10 mensagens (5 trocas) como contexto de conversa
- **FR-001a**: Quando a conversa exceder o limite de contexto do modelo (n_ctx=4096 tokens), o sistema MUST truncar automaticamente as mensagens mais antigas para manter a inferência funcional
- **FR-002**: O sistema MUST exibir mensagens do usuário e da IA de forma visualmente distinta na tela de chat (balões diferenciados)
- **FR-003**: O sistema MUST persistir todas as conversas localmente para recuperação entre sessões do app
- **FR-004**: O sistema MUST gerar automaticamente um título para a conversa baseado na primeira mensagem enviada
- **FR-005**: O sistema MUST exibir na tela de Histórico: título da conversa, timestamp relativo formatado (ex: "2h atrás", "3d atrás") e preview da última mensagem
- **FR-006**: O sistema MUST permitir que usuários toquem em uma conversa no histórico para carregá-la na tela de Chat
- **FR-007**: O sistema MUST permitir que usuários renomeiem o título de uma conversa via long-press no histórico
- **FR-008**: O sistema MUST permitir que usuários excluam conversas do histórico via long-press com diálogo de confirmação
- **FR-009**: O sistema MUST exibir um catálogo de modelos de IA disponíveis para download com informações de tamanho e requisitos de RAM
- **FR-010**: O sistema MUST permitir download de modelos do catálogo com indicador de progresso em tempo real
- **FR-011**: O sistema MUST permitir que usuários removam modelos baixados do dispositivo com confirmação prévia
- **FR-012**: O sistema MUST validar espaço em disco disponível antes de iniciar um download (com buffer de 100MB)
- **FR-013**: O sistema MUST validar RAM total do dispositivo antes de carregar um modelo e exibir warning se insuficiente
- **FR-014**: O sistema MUST permitir seleção de qual modelo baixado carregar na memória para uso no chat
- **FR-015**: O sistema MUST persistir o modelo ativo entre sessões do app, tentando auto-carregá-lo no launch
- **FR-016**: O sistema MUST exibir seletor de modelo na tela de Chat mostrando modelo atualmente carregado
- **FR-017**: O sistema MUST permitir cancelamento de geração de resposta após 30 segundos
- **FR-018**: O sistema MUST validar mensagens de entrada limitando a 10.000 caracteres
- **FR-019**: O sistema MUST exibir 6 estados UX na tela de Chat: vazio, sem modelo, carregando modelo, gerando resposta, erro, conversa populada
- **FR-020**: O sistema MUST suportar pull-to-refresh na tela de Histórico para sincronizar estado
- **FR-021**: O sistema MUST salvar automaticamente a conversa a cada nova mensagem enviada ou recebida
- **FR-022**: O sistema MUST exibir mensagens de erro amigáveis em português para todas as falhas operacionais

### Key Entities

- **Chat Conversation**: Representa uma conversa completa, com identificador único, título (auto-gerado ou personalizado), lista de mensagens, timestamp de criação e última atualização, limite de contexto de 4096 tokens
- **Chat Message**: Mensagem individual dentro de uma conversa, com conteúdo textual, papel (usuário ou assistente), timestamp de envio, token count estimado
- **AI Model**: Modelo de IA do catálogo, com identificador, nome, tamanho do arquivo em bytes, URL de download, requisitos estimados de RAM, status local (não baixado, baixando, baixado, carregado, falha)
- **Download State**: Estado de um download em andamento, com progresso percentual, capacidade de cancelamento e suporte a retomada

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Usuários podem iniciar uma conversa com modelo carregado e enviar primeira mensagem em até 10 segundos após abrir o app (com modelo já em memória)
- **SC-002**: Respostas da IA começam a aparecer em streaming em até 5 segundos após envio da mensagem para modelos até 3B parâmetros
- **SC-003**: O app mantém 55+ FPS durante geração de respostas em streaming e rolagem de conversas
- **SC-004**: Usuários podem completar download, carregamento e envio de primeira mensagem em até 3 minutos para modelos até 2GB em conexão Wi-Fi
- **SC-005**: 95% dos usuários conseguem realizar fluxo completo: baixar modelo → carregar → enviar mensagem → receber resposta → visualizar no histórico sem erros
- **SC-006**: Conversas são persistidas com 100% de integridade - nenhuma mensagem é perdida entre sessões do app
- **SC-007**: Downloads resumíveis recuperam 100% após interrupção de conexão sem recomeçar do zero
- **SC-008**: Usuários encontram e carregam uma conversa específica no histórico em até 10 segundos para até 50 conversas salvas

## Assumptions

- Usuários possuem dispositivos com pelo menos 4GB de RAM total para rodar modelos de IA locais
- Modelos de IA são distribuídos em formato GGUF compatível com `llama.rn`
- Usuários têm conexão de internet estável para downloads iniciais de modelos (Wi-Fi recomendado)
- Cada modelo GGUF varia de 300MB a 4GB dependendo do tamanho de parâmetros
- O app roda em iOS e Android via Expo com New Architecture habilitada
- Não há necessidade de autenticação ou contas de usuário - app é 100% local
- Catálogo de modelos é estático e embarcado no código (não há servidor remoto de catálogo)
- Usuários são responsáveis por gerenciar espaço de armazenamento em seus dispositivos
- Conversas não são sincronizadas entre dispositivos - cada dispositivo tem seu histórico independente
- Modelos de IA são usados puramente offline após download - nenhuma chamada de rede externa é feita durante inferência
