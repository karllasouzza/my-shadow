# Guia de Testes

## Testes Unitários

### Rodar
```bash
bun test:unit
```

### Estrutura
```
tests/unit/shared/
├── device.test.ts
├── manager.test.ts
├── model-paths.test.ts
├── model-validator.test.ts
└── text-generation/
    ├── config.test.ts
    ├── config-builder.test.ts
    ├── runtime.test.ts
    ├── oom-detection.test.ts
    └── think-tag-parser.test.ts
```

### Adicionar Novo Teste

1. Criar arquivo `*.test.ts`
2. Importar módulo a ser testado
3. Escrever testes usando `describe` e `it`
4. Rodar `bun test:unit`

## Testes de Integração

### Rodar
```bash
bun test:integration
```

### Estrutura
```
tests/integration/
├── model-download.test.ts
├── model-loading.test.ts
└── generation-flow.test.ts
```

## Testes E2E (Maestro)

### Rodar
```bash
maestro test .maestro/
```

### Estrutura
```
.maestro/
├── 01-model-management/
├── 02-model-loading/
├── 03-generation/
├── 04-error-handling/
└── 05-performance/
```

### Criar Novo Teste

1. Criar arquivo `*.yml`
2. Definir `name` e `appId`
3. Adicionar steps usando `tapOn`, `inputText`, etc.
4. Rodar `maestro test <arquivo>`

## Cobertura

### Verificar Cobertura
```bash
bun test --coverage
```

### Meta
- Cobertura mínima: 80%
- Cobertura alvo: 90%

## Comandos Úteis

```bash
# Rodar todos os testes
bun test

# Rodar teste específico
bun test tests/unit/shared/text-generation/runtime.test.ts

# Rodar com watch
bun test --watch

# Rodar com verbose
bun test --verbose
```
