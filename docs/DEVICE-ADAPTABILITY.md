# Adaptabilidade do Dispositivo

## Sistema de Profiles

O sistema classifica dispositivos em três tiers:

### High Tier
- RAM: 8GB+
- CPU: 6+ cores
- GPU: Sim (iOS Metal)
- Config: n_ctx=4096, thinking habilitado
- Limite: 2 modelos concorrentes, maxContextWindow=8192

### Mid Tier
- RAM: 4-8GB
- CPU: 4+ cores
- Config: n_ctx=2048, thinking desabilitado
- Limite: 1 modelo concorrente, maxContextWindow=4096

### Low Tier
- RAM: <4GB
- CPU: <4 cores
- Config: n_ctx=1024, recursos reduzidos
- Limite: 1 modelo concorrente, maxContextWindow=2048

## Configurações por Tier

| Config        | Low  | Mid  | High |
|---------------|------|------|------|
| n_ctx         | 1024 | 2048 | 4096 |
| n_batch       | 128  | 256  | 512  |
| n_threads     | 2    | 4    | 8    |
| n_gpu_layers  | 0    | 99   | 99   |
| thinking      | ❌   | ❌   | ✅   |
| flashAttention| ❌   | ✅   | ✅   |

## Detecção de CPU

O sistema detecta cores da CPU baseado na memória total:

### iOS
- 8GB+ RAM → 6 cores
- 4GB+ RAM → 4 cores
- <4GB RAM → 2 cores

### Android
- 8GB+ RAM → 8 cores
- 6GB+ RAM → 6 cores
- 4GB+ RAM → 4 cores
- <4GB RAM → 2 cores

## Buffer de Memória

O buffer dinâmico ajusta-se baseado na pressão de memória:

| Pressão | Multiplicador |
|---------|---------------|
| low     | 0.8           |
| medium  | 1.0           |
| high    | 1.3           |

Base do buffer:
- 8GB+ RAM → 0.8GB
- 6GB+ RAM → 1.0GB
- <6GB RAM → 1.5GB

## Como Adicionar Novo Tier

1. Definir thresholds em `calculateDeviceTier()`
2. Adicionar configurações em `getRecommendedConfig()`
3. Adicionar limites em `getDeviceLimits()`
4. Atualizar documentação
