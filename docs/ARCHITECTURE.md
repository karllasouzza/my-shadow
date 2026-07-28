# Arquitetura do Módulo Shared AI

## Visão Geral
O módulo shared AI é responsável pelo gerenciamento de modelos, carregamento e geração de texto.

## Componentes Principais

### Device Manager (`device.ts`)
- Detecta especificações do dispositivo
- Classifica tier (low/mid/high)
- Fornece configurações recomendadas
- Monitora pressão de memória

### Model Manager (`manager.ts`)
- Gerencia downloads de modelos
- Cache de modelos baixados
- Verificação de existência
- Removeção de modelos

### AI Runtime (`runtime.ts`)
- Carrega e descarrega modelos
- Gera texto via streaming
- Gerencia estado do modelo
- Fila de carregamento para evitar race conditions
- Recuperação de OOM (Out of Memory)

### Config Builder (`config-builder.ts`)
- Cria configurações baseadas no dispositivo
- Valida configurações
- Aplica overrides

### Model Validator (`model-validator.ts`)
- Valida modelo antes de carregar
- Verifica memória disponível
- Retorna warnings para modelos grandes

### Loading Progress (`loading-progress.ts`)
- Rastreia progresso de carregamento
- Notifica listeners sobre mudanças de estágio

### Model Paths (`model-paths.ts`)
- Centraliza construção de paths
- Fornece utilitários para verificar existência

## Fluxo de Dados

1. **Detecção do Dispositivo**
   - `detectDevice()` → `DeviceProfile`

2. **Download do Modelo**
   - `downloadModelById()` → `Result<string>`

3. **Carregamento do Modelo**
   - `loadModel()` → `ModelLoadResult`

4. **Geração de Texto**
   - `streamCompletion()` → `Result<CompletionOutput>`

## Diagrama de Componentes

```
┌─────────────────────────────────────────────────┐
│                  UI Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │ModelSelector│  │ ChatScreen  │  │ModelsScreen│ │
│  └──────┬──────┘  └──────┬──────┘  └────┬────┘ │
└─────────┼────────────────┼──────────────┼───────┘
          │                │              │
          ▼                ▼              ▼
┌─────────────────────────────────────────────────┐
│              View Model Layer                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │useModelManager│ │  useChat    │  │useModels│ │
│  └──────┬──────┘  └──────┬──────┘  └────┬────┘ │
└─────────┼────────────────┼──────────────┼───────┘
          │                │              │
          ▼                ▼              ▼
┌─────────────────────────────────────────────────┐
│              Shared AI Layer                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │model-loader │  │  runtime    │  │ manager │ │
│  └──────┬──────┘  └──────┬──────┘  └────┬────┘ │
└─────────┼────────────────┼──────────────┼───────┘
          │                │              │
          ▼                ▼              ▼
┌─────────────────────────────────────────────────┐
│              Device Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │   device    │  │config-builder│ │model-paths│ │
│  └─────────────┘  └─────────────┘  └─────────┘ │
└─────────────────────────────────────────────────┘
```
