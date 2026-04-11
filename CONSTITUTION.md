# My Shadow - Project Constitution

## Princípios Fundamentais

Este documento define os princípios e padrões que regem o desenvolvimento do projeto **my-shadow**, um cliente de IA local que roda modelos LLM on-device via `llama.rn` com React Native/Expo.

---

## 1. Qualidade de Código

### 1.1 TypeScript Estrito
- **Sempre usar TypeScript estrito**: `strict: true`, `noImplicitAny: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
- **Nunca usar `any`**: Use `unknown` quando o tipo for realmente desconhecido, ou defina tipos específicos
- **Tipar todas as interfaces públicas**: Funções exportadas, props de componentes, e APIs devem ter tipos explícitos

### 1.2 Arquitetura MVVM por Feature
```
features/
  <feature-name>/
    model/          # Entidades e tipos de dados
    service/        # Lógica de negócio e casos de uso
    view/           # Telas e views
    view-model/     # ViewModels com Legend State
    components/     # Componentes específicos da feature
```

### 1.3 Separação de Responsabilidades
- **Models**: Apenas tipos/interfaces, sem lógica de negócio
- **Services**: Casos de uso puros, sem estado de UI
- **ViewModels**: Estado reativo com Legend State (`observable()`)
- **Views**: Apenas apresentação, toda lógica no ViewModel

### 1.4 Padrões de Código
- **Usar path aliases**: `@/` para imports absolutos (ex: `@/shared/ai/model-manager`)
- **Componentes UI**: Usar `@rn-primitives` + `class-variance-authority` para variantes
- **Estilização**: NativeWind (Tailwind) com sistema de cores HSL via CSS variables
- **Nomenclatura**: 
  - Componentes: `PascalCase` (ex: `ChatScreen.tsx`)
  - Funções/variáveis: `camelCase` (ex: `getModelManager()`)
  - Constantes: `UPPER_SNAKE_CASE` (ex: `ACTIVE_MODEL_KEY`)
  - Tipos/Interfaces: `PascalCase` (ex: `DownloadState`)

### 1.5 Validação e Tratamento de Erros
- **Sempre usar `Result<T>` pattern**: Retornos devem ser `ok(value)` ou `err(error)`
- **Validar inputs com Zod**: Schema validation em todas as entradas de usuário
- **Mensagens de erro em português**: UX consistente para usuários brasileiros

---

## 2. Padrões de Testes

### 2.1 Estratégia de Testes
- **Framework**: Jest + Testing Library React Native
- **Localização**: `tests/` na raiz ou `**/tests/**/*.spec.ts` por feature
- **Naming**: `<nome-do-arquivo>.spec.ts` ou `<nome-do-arquivo>.test.ts`

### 2.2 Cobertura Mínima
- **Services**: 100% de cobertura - toda lógica de negócio deve ser testada
- **ViewModels**: 90%+ de cobertura - estado e ações principais
- **Utils/helpers**: 100% de cobertura
- **Components UI**: Testes de snapshot + interações principais
- **Views/Screens**: Testes de integração (renderização + navegação)

### 2.3 Padrões de Escrita de Testes
```typescript
import { render, screen, fireEvent } from '@testing-library/react-native';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('NomeDoService', () => {
  describe('nomeDoMetodo', () => {
    it('deve fazer X quando Y', () => {
      // Arrange
      // Act
      // Assert
    });

    it('deve retornar erro quando Z', () => {
      // Test edge cases e error paths
    });
  });
});
```

### 2.4 Mocks Obrigatórios
Mockar sempre em testes:
- `llama.rn`: Mock do runtime de IA
- `expo-file-system/legacy`: Mock do sistema de arquivos
- `@react-native-rag/op-sqlite`: Mock do banco de dados
- `react-native-mmkv`: Mock do storage

### 2.5 Regras de Execução
- **Rodar testes antes de cada commit**: `bun test`
- **Tests devem passar em CI/CD**: Workflow EAS deve incluir step de testes
- **Não committar testes quebrados**: Bloquear merge se testes falharem

---

## 3. Consistência de UX

### 3.1 Sistema de Design
- **Usar componentes do `components/ui/`**: Button, Text, Icon, Select, Skeleton, etc.
- **Seguir padrão shadcn**: Componentes headless com variantes via CVA
- **Nunca hardcodear cores**: Usar variáveis do tema (`background`, `foreground`, `primary`, etc.)

### 3.2 Temas e Cores
```typescript
// SEMPRE usar via theme
import { useTheme } from '@/context/themes';
const { theme } = useTheme();

// Nos componentes JSX:
className="bg-primary text-primary-foreground"

// NOÃO hardcodear:
className="bg-blue-500 text-white" // ❌
```

### 3.3 Feedback ao Usuário
- **Loading states**: Usar `Skeleton` components ou spinners consistentes
- **Erros**: Usar `sonner-native` para toasts com mensagens em português
- **Success**: Confirmar ações com feedback visual imediato
- **Estados vazios**: Sempre mostrar mensagem + CTA quando não há dados

### 3.4 Acessibilidade
- **Labels acessíveis**: Todo elemento interativo deve ter `accessibilityLabel`
- **Contraste mínimo**: 4.5:1 para texto normal, 3:1 para texto grande
- **Navegação por teclado**: Suportar tab navigation quando aplicável
- **Screen readers**: Testar com VoiceOver (iOS) e TalkBack (Android)

### 3.5 Animações e Transições
- **Usar `react-native-reanimated`**: Para animações performáticas na UI thread
- **Duração padrão**: 200ms para transições simples, 300ms para modais
- **Respeitar preferências do usuário**: Desabilitar animações se `reduce motion` estiver ativo

### 3.6 Responsividade
- **Suportar múltiplos tamanhos**: Testar em phones e tablets
- **Usar unidades relativas**: `%`, `flex`, em vez de valores fixos quando possível
- **Breakpoints**: Seguir padrões do Tailwind (`sm:`, `md:`, `lg:`)

---

## 4. Requisitos de Performance

### 4.1 Carregamento de Modelos IA
- **Verificar RAM disponível**: Usar `DeviceInfo.getTotalMemory()` antes de carregar modelo
- **Modelos > 70% da RAM total**: Mostrar warning ao usuário
- **Download resumível**: Usar `FileSystem.createDownloadResumable` sempre
- **Persistir modelos baixados**: Salvar paths no MMKV para não re-download

### 4.2 Renderização de UI
- **Usar `observer()` do Legend State**: Para reatividade granular e evitar re-renders desnecessários
- **FlatList virtualizada**: Para listas longas (histórico, mensagens)
- **Memoizar componentes pesados**: `React.memo()` quando props não mudam frequentemente
- **Evitar inline functions em renders**: Definir handlers fora do JSX ou usar `useCallback`

### 4.3 Estado e Storage
- **Legend State + MMKV**: Para estado persistente entre sessões
- **Não bloquear thread principal**: Operações de I/O devem ser async
- **Lazy loading**: Carregar dados sob demanda, não tudo no startup
- **Debounced inputs**: Para buscas e filtros (300ms delay mínimo)

### 4.4 Inferência IA
- **Streaming de resposta**: Usar geração token-a-token para feedback imediato
- **Não bloquear UI durante inferência**: Manter app responsivo enquanto modelo gera texto
- **Cancelar geração**: Permitir ao usuário parar a geração a qualquer momento
- **Timeouts**: Definir tempo máximo de inferência (ex: 60s) para evitar hangs

### 4.5 Métricas de Performance (Targets)
| Métrica | Target |
|---------|--------|
| **Time to Interactive (TTI)** | < 2s no cold start |
| **FPS mínimo** | 55fps (nunca abaixo de 50) |
| **Memória RAM (app baseline)** | < 150MB sem modelo carregado |
| **Model load time** | < 5s para modelos até 2GB |
| **First token latency** | < 1s após iniciar geração |
| **App size (install)** | < 100MB (sem modelos) |

### 4.6 Otimizações de Build
- **Hermes habilitado**: Sempre usar Hermes como engine JS
- **New Architecture**: Habilitada (`newArchEnabled: true`)
- **Tree shaking**: Remover código não usado no build de produção
- **Proguard/R8**: Habilitar no Android para minificação
- **Asset compression**: Otimizar imagens e ícones

---

## 5. Governança e Evolução

### 5.1 Code Reviews
- **Todo PR precisa de 1 review mínimo**: Antes de merge
- **Checklist de review**:
  - [ ] Testes passam
  - [ ] Lint passa (`bun lint`)
  - [ ] TypeScript compila sem erros
  - [ ] Cobertura de testes mantida ou melhorada
  - [ ] UX consistente com design system
  - [ ] Performance não degradada

### 5.2 Commits
- **Mensagens claras e concisas**: Focar no "porquê" e não no "o quê"
- **Conventional Commits (recomendado)**: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- **Commits atômicos**: Uma mudança por commit
- **Idioma**: Português para mensagens (padrão do time)

### 5.3 Branching Strategy
- **Main branch**: Sempre em estado deployável
- **Feature branches**: `feature/<nome-da-feature>`
- **Bugfix branches**: `fix/<descricao-do-bug>`
- **Releases**: `release/<version>` para staging

### 5.4 CI/CD (EAS Workflows)
- **On push to main**: Rodar lint + typecheck + tests
- **On PR**: Build de preview + tests
- **On release**: Build para produção + deploy

---

## 6. Anti-Patterns (NÃO FAZER)

❌ **NUNCA** hardcodear strings de erro ou mensagens de UI (usar i18n ou constantes)  
❌ **NUNCA** bypassar validações de tipo com `as any` ou `// @ts-ignore`  
❌ **NUNCA** committar código com testes falhando  
❌ **NUNCA** usar `useEffect` para lógica que pode ser síncrona ou no ViewModel  
❌ **NUNCA** fazer chamadas de rede na thread principal  
❌ **NUNCA** armazenar dados sensíveis sem criptografia (usar `expo-secure-store`)  
❌ **NUNCA** ignorar erros silenciosamente (sempre logar ou reportar)  
❌ **NUNCA** duplicar lógica de negócio entre features (extrair para `shared/`)  

---

## Revisão e Manutenção

Esta constituição deve ser revisada:
- **A cada 3 meses**: Para refletir mudanças em requisitos ou ferramentas
- **Quando houver mudança de escopo significativa**: Novas features, plataformas, etc.
- **Quando o time identificar dores**: Patterns que não estão funcionando

**Última revisão**: 10 de abril de 2026

---

## Apêndice: Links Úteis

- **Expo Docs**: https://docs.expo.dev
- **Legend State**: https://legendapp.com/open-source/state/v3/
- **NativeWind**: https://www.nativewind.dev
- **llama.rn**: https://github.com/mybigday/llama.rn
- **React Native Performance**: https://reactnative.dev/docs/performance
- **Testing Library RN**: https://callstack.github.io/react-native-testing-library/
