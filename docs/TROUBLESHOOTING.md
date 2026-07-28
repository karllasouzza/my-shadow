# Troubleshooting

## Problemas Comuns

### Modelo não carrega
**Causa:** Memória insuficiente
**Solução:** Usar modelo menor ou fechar outros apps

### Erro de download
**Causa:** Conexão com a internet
**Solução:** Verificar conexão e tentar novamente

### App crasha ao gerar
**Causa:** OOM (Out of Memory)
**Solução:** Usar modelo menor ou reduzir n_ctx

### Performance lenta
**Causa:** Dispositivo de baixa performance
**Solução:** Usar modelo quantizado (q4_0)

### Erro BUSY ao carregar modelo
**Causa:** Modelo já está sendo carregado
**Solução:** Aguardar carregamento atual terminar

### Contexto permanentemente reduzido
**Causa:** OOM recovery sem recuperação
**Solução:** O sistema agora recupera automaticamente via `recoverFromOOMDegradation()`

## Debug

### Logs
O app gera logs detalhados. Para ver:
- Android: `adb logcat | grep "INFERENCE"`
- iOS: Console do Xcode

### Métricas
O app coleta métricas de performance:
- TTFT (Time to First Token)
- Tokens por segundo
- Uso de memória

### Códigos de Erro

| Código | Significado |
|--------|-------------|
| NOT_READY | Nenhum modelo carregado |
| EMPTY | Resposta vazia do modelo |
| INSUFFICIENT_MEMORY | Memória insuficiente |
| GENERATION_FAILED | Falha na geração |
| VALIDATION_ERROR | Configuração inválida |
| BUSY | Modelo já está sendo carregado |
| ABORTED | Geração cancelada |
| STORAGE_ERROR | Erro de armazenamento |
| NOT_FOUND | Modelo não encontrado |

## Status do Sistema

### Device Profile
O sistema classifica automaticamente o dispositivo:
- `high`: 8GB+ RAM, 6+ cores, GPU
- `mid`: 4-8GB RAM, 4+ cores
- `low`: <4GB RAM

### Memory Pressure
Monitora pressão de memória:
- `low`: Média >4GB, mínimo >2GB
- `medium`: Média 2-4GB ou mínimo 1-2GB
- `high`: Média <2GB ou mínimo <1GB
