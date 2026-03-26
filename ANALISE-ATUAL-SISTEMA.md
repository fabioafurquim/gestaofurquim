# Analise Atual do Sistema - PlantaoFisio

**Data da analise:** 26/03/2026

## Resumo executivo

O sistema ja passou da fase de prototipo. Hoje ele tem base funcional solida para operacao real do piloto, com autenticacao por NextAuth em boa parte do fluxo, calendario de plantoes maduro, trocas, historico de valores, notificacoes por Telegram, relatorios, contratos, controle mensal de pagamento, backup e auditoria.

O principal ponto agora nao e "criar mais modulos", e sim evoluir de um sistema operacionalmente funcional para um sistema mais inteligente, previsivel e menos manual. Na pratica, o maior ganho de mercado vem de:

1. recorrencia de plantoes com previsao e geracao controlada
2. regras configuraveis de carga de trabalho com alertas e bloqueios
3. consolidacao do motor financeiro para usar sempre historico real
4. unificacao final da autenticacao e endurecimento de qualidade tecnica

Se eu tivesse que resumir em uma frase: o produto esta pronto para entrar na fase de "escala assistida por regras", que e onde ele ganha valor competitivo de verdade.

## O que o sistema ja faz bem hoje

### Operacao de escala

- calendario mensal robusto com FullCalendar
- criacao, edicao, exclusao e drag and drop de plantoes
- vagas por equipe, periodo e tipo de dia
- descricoes de vagas/coberturas por slot
- mural de trocas com fluxo de aceite e aprovacao
- dashboard gerencial e dashboard do fisioterapeuta
- exportacao mensal da escala em PDF

### Regras e seguranca de negocio

- validacao de overbooking por vaga/slot
- bloqueio de exclusao de equipe ou fisioterapeuta com plantoes futuros
- historico de preco por equipe e por vinculo fisioterapeuta-equipe
- logs de exclusao de plantao
- logs de acesso
- backup manual e automatico com Google Drive

### Operacao administrativa

- cadastro de fisioterapeutas, equipes, usuarios e feriados
- contratos PJ/RPA
- notificacoes via Telegram
- controle mensal de pagamentos
- relatorio financeiro com exportacao

### Saude tecnica observada

- `npm run build` executou com sucesso em 26/03/2026
- o schema Prisma esta bem mais maduro do que os documentos antigos sugeriam
- existe bastante funcionalidade ja entregue que estava aparecendo como "futuro" nos documentos antigos

## Oportunidades prioritarias de melhoria

### Prioridade 1 - Plantoes recorrentes

Esse e o ganho mais claro de produtividade agora. Hoje a escala ainda depende muito de repeticao manual para padroes conhecidos, e isso custa tempo da gestao e aumenta risco de erro.

**Objetivo do MVP**

- permitir criar padroes fixos do tipo "toda segunda de manha na equipe X para o fisioterapeuta Y"
- gerar plantoes futuros com preview antes de confirmar
- respeitar slot, feriado, conflito e duplicidade
- editar apenas o futuro sem reescrever historico

**Escopo recomendado do MVP**

- recorrencia semanal
- 1 ou mais dias da semana
- data inicial e data final
- equipe, periodo e vaga/cobertura
- fisioterapeuta fixo
- politica para feriado/fim de semana: manter ou pular
- politica de conflito: pular e registrar ou bloquear geracao

**Modelo sugerido**

```prisma
model RecurringShiftTemplate {
  id                  Int       @id @default(autoincrement())
  name                String
  physiotherapistId   Int
  shiftTeamId         Int
  shiftTeamSlotId     Int
  period              ShiftPeriod
  weekdays            Int[]     // 0..6
  intervalWeeks       Int       @default(1)
  startDate           DateTime  @db.Date
  endDate             DateTime? @db.Date
  holidayPolicy       HolidayPolicy @default(SKIP)
  conflictPolicy      ConflictPolicy @default(SKIP_AND_LOG)
  active              Boolean   @default(true)
  lastGeneratedUntil  DateTime? @db.Date
  createdByUserId     Int?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

enum HolidayPolicy {
  SKIP
  KEEP
}

enum ConflictPolicy {
  SKIP_AND_LOG
  BLOCK_GENERATION
}
```

**Boas regras para nao gerar dor futura**

- nunca alterar plantao passado a partir da recorrencia
- permitir "editar somente este plantao" e "editar o padrao daqui para frente"
- guardar log de geracao com itens criados, pulados e motivos
- tornar a geracao idempotente para evitar duplicidade
- gerar por janela, por exemplo proximos 60 ou 90 dias

**Fluxo recomendado**

1. gestor cria um padrao recorrente
2. sistema mostra preview das ocorrencias
3. sistema valida conflitos de vaga, duplicidade e regras de carga
4. gestor confirma
5. sistema cria os plantoes e registra o resultado

### Prioridade 2 - Alertas configuraveis de carga de trabalho

Esse e o complemento natural da recorrencia. Sem regras de carga, a recorrencia acelera a criacao, mas pode acelerar tambem o erro.

Minha recomendacao aqui e separar claramente:

- `alerta`: sistema avisa, mas deixa continuar
- `bloqueio`: sistema impede ou exige override justificado

**Metricas que valem entrar primeiro**

1. maximo de dias consecutivos
2. maximo de plantoes em 7 dias
3. maximo de plantoes noturnos em 7 dias
4. maximo de fins de semana no mes
5. minimo de horas de descanso entre plantoes

**Melhor desenho para ficar personalizavel sem virar bagunca**

Em vez de gravar poucos campos soltos em `SystemSettings`, eu recomendo trabalhar com politica + regras.

```prisma
model SchedulingPolicy {
  id                  Int      @id @default(autoincrement())
  name                String
  scope               PolicyScope
  shiftTeamId         Int?
  physiotherapistId   Int?
  active              Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  rules               SchedulingRule[]
}

model SchedulingRule {
  id                  Int      @id @default(autoincrement())
  policyId            Int
  metric              SchedulingMetric
  windowDays          Int?
  warningThreshold    Int?
  blockingThreshold   Int?
  minRestHours        Int?
  active              Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

enum PolicyScope {
  GLOBAL
  TEAM
  PHYSIOTHERAPIST
}

enum SchedulingMetric {
  CONSECUTIVE_DAYS
  SHIFTS_IN_WINDOW
  NIGHT_SHIFTS_IN_WINDOW
  WEEKEND_SHIFTS_IN_MONTH
  MIN_REST_HOURS
}
```

**Como isso funcionaria na pratica**

- existe uma politica global padrao
- se uma equipe precisa de regra mais rigida, ela ganha politica propria
- se um fisioterapeuta precisa de excecao, recebe override proprio

**Exemplos reais**

- alerta com 4 dias seguidos, bloqueio com 5
- alerta com 6 plantoes em 7 dias, bloqueio com 7
- alerta com 2 noites em 5 dias, bloqueio com 3
- bloqueio com menos de 12h entre um plantao e outro

**UX recomendada**

Ao criar, mover ou gerar plantoes, o sistema deve mostrar um painel de validacao:

- verde: sem risco
- amarelo: regra ultrapassando limite de alerta
- vermelho: regra ultrapassando bloqueio

Se o usuario for `ADMIN` ou `MANAGER`, voce pode permitir override com justificativa, gravando auditoria.

**Onde isso entrega valor de verdade**

- evita sobrecarga silenciosa
- protege o piloto de erro operacional
- cria argumento comercial forte: "o sistema ajuda a manter distribuicao segura e equilibrada"

### Prioridade 3 - Disponibilidade e bloqueio de datas

Antes de sofisticar sugestao inteligente, vale adicionar uma camada simples de disponibilidade:

- ferias
- indisponibilidade temporaria
- bloqueio por periodo

Isso conversa muito bem com recorrencia e carga. Sem isso, a gestao continua corrigindo escala "na mao" depois.

### Prioridade 4 - Motor financeiro unico e confiavel

Hoje o projeto ja tem um caminho correto para calculo com historico de precos em [`src/lib/payment-calculator.ts`](./src/lib/payment-calculator.ts), mas ele ainda nao e a fonte unica da verdade.

Os maiores ganhos aqui sao:

- usar o mesmo motor para relatorio, folha, CNAB e conferencia
- parar de depender de valor atual do cadastro para fechar mes passado
- reduzir divergencia entre relatorio e pagamento

### Prioridade 5 - Fechamento da arquitetura de autenticacao

O projeto ainda carrega uma camada legada de autenticacao por cookie `auth-token` ao mesmo tempo em que o fluxo principal ja usa NextAuth/Auth.js. Isso e um risco de manutencao, de comportamento inconsistente e de seguranca.

Minha recomendacao e finalizar a migracao e deixar apenas um caminho oficial.

## Riscos tecnicos observados no estado atual

### 1. Autenticacao duplicada

O `middleware` ainda trabalha com cookie legado `auth-token` em vez de usar somente NextAuth, enquanto varias rotas novas ja usam `auth()` e `useSession()`.

Arquivos centrais:

- `middleware.ts`
- `src/auth.ts`
- `src/auth.config.ts`
- `src/lib/auth.ts`

**Impacto**

- regras de acesso espalhadas em duas arquiteturas
- maior risco de comportamento inconsistente
- manutencao mais cara

### 2. Build esta pulando typecheck e lint

Em [`next.config.ts`](./next.config.ts) o build esta configurado para ignorar ESLint e erros de TypeScript.

**Impacto**

- regressao pode entrar em producao sem ser barrada
- a aparente estabilidade pode esconder erro estrutural

**Observacao**

- `npm run build` passou em 26/03/2026
- `npx tsc --noEmit` isolado depende dos artefatos em `.next/types`, entao hoje ele nao funciona bem como gate independente

### 3. Relatorio financeiro ainda usa valor atual, nao o historico consolidado

O endpoint [`src/app/api/reports/financial-data/route.ts`](./src/app/api/reports/financial-data/route.ts) ainda calcula com base no valor atual do vinculo/equipe, em vez de usar o motor historico ja existente.

**Impacto**

- risco de relatorio retroativo diferente da folha real
- quebra de confiabilidade justamente onde o piloto mais precisa de seguranca

### 4. Fluxo de pagamentos ainda usa `hourValue` do fisioterapeuta

O endpoint [`src/app/api/payments/[month]/route.ts`](./src/app/api/payments/[month]/route.ts) ainda calcula `totalShiftValue` por contagem de plantoes x `hourValue`, ignorando historico por equipe e valor customizado por vinculo.

**Impacto**

- risco financeiro direto
- divergencia entre plantao real e pagamento
- fragilidade maior quando houver fisioterapeuta em mais de uma equipe

### 5. Atualizacao de vinculos do fisioterapeuta apaga e recria relacoes

Em [`src/app/api/physiotherapists/[id]/route.ts`](./src/app/api/physiotherapists/[id]/route.ts), ao atualizar `teamIds`, o sistema faz `deleteMany` e recria os vinculos.

**Impacto**

- pode apagar historico de preco customizado daquele vinculo
- nao protege bem a remocao de equipe quando ha plantoes futuros
- dificulta auditoria

Minha recomendacao aqui e migrar para diff de vinculos: adiciona, atualiza e remove pontualmente, com validacao antes de remover.

## O que eu nao priorizaria agora

Apesar de aparecer bastante em roadmaps antigos, eu nao colocaria no topo neste momento:

- multi-tenancy
- app mobile nativo
- IA de sugestao automatica completa
- vista multi-equipe muito sofisticada
- integracao bancaria profunda antes de consolidar o motor financeiro interno

Esses itens podem fazer sentido depois, mas o piloto atual ganha muito mais com previsibilidade operacional do que com expansao de superficie.

## Roadmap recomendado

### Curto prazo

1. unificar autenticacao e remover camada legado
2. transformar o motor financeiro historico na fonte unica da verdade
3. trocar o update de vinculo de fisioterapeuta para estrategia de diff com preservacao de historico
4. publicar este documento como referencia unica de analise

### Medio prazo

1. entregar MVP de plantoes recorrentes com preview e log
2. entregar politicas de carga com alerta e bloqueio
3. adicionar bloqueio de datas e indisponibilidade
4. criar painel simples de carga por fisioterapeuta

### Depois disso

1. digest diario de risco de escala para gestao
2. sugestao assistida de alocacao
3. melhorias de notificacao por canal e preferencia

## Sequencia de implementacao que eu recomendo

Se voce quiser atacar o que mais agrega valor com menor risco, eu seguiria nesta ordem:

1. consolidar autenticacao e calculo financeiro
2. construir plantoes recorrentes
3. construir alertas de carga configuraveis
4. adicionar indisponibilidade/bloqueio de datas

Essa ordem evita criar automacao por cima de bases ainda inconsistentes.

## Visao final de produto

Para o sistema virar ferramenta de ponta nesse nicho, o diferencial nao e apenas "ter calendario". O diferencial e operar com quatro pilares:

1. **Escala estruturada:** vagas, cobertura, recorrencia e feriados bem modelados
2. **Escala segura:** bloqueios, alertas, descanso minimo e distribuicao equilibrada
3. **Escala auditavel:** historico de valores, logs, justificativas e rastreabilidade
4. **Escala produtiva:** menos digitacao repetitiva e mais automacao controlada

O projeto ja esta forte no primeiro e no terceiro pilar. O salto de mercado agora esta no segundo e no quarto.
