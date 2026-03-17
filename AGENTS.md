---
trigger: always_on
---
# Regras e Configurações do Projeto - Sistema de Gestão de Plantões Furquim

## 🌐 Idioma
- **SEMPRE responder em Português do Brasil (pt-BR)**
- Comentários de código em português
- Mensagens de commit em português
- Documentação em português

## 🏗️ Arquitetura e Tecnologias

### Stack Principal
- **Framework:** Next.js 14+ (App Router)
- **Linguagem:** TypeScript
- **Autenticação:** NextAuth.js v5 (Auth.js)
- **Banco de Dados:** PostgreSQL
- **ORM:** Prisma
- **Estilização:** TailwindCSS
- **Calendário:** FullCalendar
- **Validação:** Zod
- **Gerenciamento de Estado:** React Hooks (useState, useEffect, useSession)

### Decisões Técnicas Importantes
- ✅ **NextAuth.js** é a solução de autenticação escolhida (não usar sistema antigo de auth-token)
- ✅ Sessões gerenciadas via JWT pelo NextAuth
- ✅ Usar `auth()` do NextAuth para verificar autenticação em rotas de API
- ✅ Usar `useSession()` do NextAuth em componentes client-side
- ✅ Prisma para todas as operações de banco de dados
- ✅ Salt rounds do bcrypt: **12** (SALT_ROUNDS = 12)

## 🔐 Regras de Autenticação e Segurança

### Senha Padrão
- **Senha padrão para novos usuários:** `furquim`
- **Senha padrão para reset:** `furquim`
- Função: `generateDefaultPassword()` em `src/lib/auth.ts`

### Troca de Senha Obrigatória
- Usuários com `mustChangePassword = true` ou `isFirstLogin = true` devem trocar senha
- Redirecionamento automático para `/change-password` após login
- Flags atualizadas automaticamente após troca de senha bem-sucedida
- Validação: senha mínima de 6 caracteres

### Tipos de Usuário (Roles)
1. **ADMIN (Administrador)**
   - Acesso completo ao sistema
   - Pode gerenciar usuários, contratos, pagamentos, relatórios
   - Pode vincular fisioterapeuta (opcional)

2. **MANAGER (Gestor)**
   - Acesso restrito: Dashboard, Plantões, Fisioterapeutas, Equipes, Feriados
   - Pode vincular fisioterapeuta (opcional)
   - Não tem acesso a: Usuários, Contratos, Pagamentos, Relatórios, Manutenção

3. **USER (Usuário)**
   - Acesso básico: Dashboard e Plantões
   - **OBRIGATÓRIO** vincular a um fisioterapeuta

### Conversão de Tipos
- `session.user.id` vem como **string** do NextAuth
- **SEMPRE converter para number** antes de usar com Prisma:
  ```typescript
  const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id;
  ```

## 💼 Regras de Negócio

### Plantões
- Plantões organizados por equipes (ShiftTeam)
- Vagas separadas por dia útil (weekday) e fim de semana (weekend)
- Períodos: Manhã, Tarde, Noite, Intermediário
- Campos antigos (`morningSlots`, `afternoonSlots`, etc.) mantidos por compatibilidade mas zerados
- Usar sempre os novos campos: `weekdayMorningSlots`, `weekendMorningSlots`, etc.

### Fisioterapeutas
- Podem ter múltiplos usuários vinculados (relação one-to-many)
- ADMIN e MANAGER podem vincular fisioterapeuta (opcional)
- USER deve obrigatoriamente vincular fisioterapeuta

### Contratos e Pagamentos
- Contratos vinculados a fisioterapeutas
- Valores calculados automaticamente baseado em plantões
- Sistema de folha de pagamento integrado

### Feriados
- Feriados afetam cálculo de vagas (dia útil vs fim de semana)
- Configuráveis por data

## 🗄️ Ambientes

### Desenvolvimento (Local)
- **SO:** Windows
- **Servidor:** localhost:3000
- **Banco de Dados:** PostgreSQL rodando em localhost:5432
- **Credenciais DB:**
  - Host: localhost
  - Port: 5432
  - Database: plantaofisio
  - User: postgres
  - Password: Fmm20615
- **Variáveis de Ambiente:** `.env` e `.env.local`
- **DATABASE_URL:** `postgresql://postgres:Fmm20615@localhost:5432/plantaofisio`

### Produção
- **Servidor:** VPS com Coolify
- **Acesso SSH:** `ssh root@187.77.57.122`
- **Autenticação SSH:** acesso direto como `root`, sem senha interativa no fluxo atual
- **URL:** https://fisio.furquim.cloud
- **Aplicações no servidor:** `plantaofisio` e `smartpark`
- **Banco de Dados:** PostgreSQL compartilhado do Coolify (container Docker)
- **Credenciais DB:** configuradas via variável de ambiente no Coolify
  - DATABASE_URL: `postgresql://postgres:eLE1NPit1YQKnVU1o2QTABzxPZ46v9iAHyTlXWNwUxv6CCco1sFi5nOeCVSEHhKp@jk4ss8ssocc4owows0csw4kg:5432/plantaofisio`
  - Host interno: `jk4ss8ssocc4owows0csw4kg`
  - Port: `5432`
  - Database: `plantaofisio`
  - User: `postgres`
- **Deploy:** automático via Coolify ao fazer push para GitHub
- **Container Docker:** gerenciado pelo Coolify
- **Estratégia real de deploy no Coolify:** `Nixpacks`
- **Build verificado em produção:** `npm ci` + `npm run build`
- **Comando de runtime verificado em produção:** `npm run start`
- **Arquivo de configuração do Nixpacks no projeto:** `nixpacks.toml`
- **Pacote extra necessário no runtime:** `postgresql-client` para permitir `pg_dump` no backup manual e no cron
- **Dockerfile:** `Dockerfile.vps` existe no repositório, mas **não está sendo usado** no deploy atual do Coolify
- **Bug conhecido do Coolify neste projeto:** após alguns deploys o domínio customizado volta para o padrão `sslip.io`
- **Script de correção de domínio no servidor:** `/root/fix-domain-after-deploy.sh`
- **Uso do script quando o domínio voltar incorreto:**
  ```bash
  ssh root@187.77.57.122 "/root/fix-domain-after-deploy.sh"
  ```
- **Objetivo do script:** regravar o `docker-compose.yaml` da aplicação com `fisio.furquim.cloud`, restaurar labels HTTPS e subir novamente o compose

## 🚀 Processo de Deploy

### Quem Faz Deploy
- **Usuário** é responsável por fazer o deploy
- **Codex** pode auxiliar e também pode acessar via SSH se necessário

### Fluxo de Deploy
1. Fazer alterações no código local
2. Testar localmente (`npm run dev`)
3. Commit das alterações:
   ```bash
   git add .
   git commit -m "descrição das alterações"
   ```
4. Push para GitHub:
   ```bash
   git push origin main
   ```
5. Coolify detecta o push e faz deploy automático via **Nixpacks**
6. Se o Coolify voltar o domínio para `sslip.io`, executar no servidor:
   ```bash
   ssh root@187.77.57.122 "/root/fix-domain-after-deploy.sh"
   ```
7. Se houver mudanças no Prisma, aplicar migrations de produção manualmente
8. Aguardar build e deploy
9. Verificar em https://fisio.furquim.cloud

### Migrations em Produção
- **Nunca** confiar que o deploy do Coolify executou `prisma migrate deploy` automaticamente
- **Sempre** executar a migration manualmente via SSH no container atual da aplicação
- Para evitar erros de escape no PowerShell, primeiro descobrir o nome do container atual da app:
  ```bash
  ssh root@187.77.57.122 "docker ps --format '{{.Names}}' | grep g48wk8goo88g8k8cw4cs484g | head -n 1"
  ```
- Depois executar a migration dentro do container retornado:
  ```bash
  ssh root@187.77.57.122 "docker exec NOME_DO_CONTAINER sh -lc 'cd /app && npx prisma migrate deploy'"
  ```
- Exemplo real que funcionou:
  ```bash
  ssh root@187.77.57.122 "docker exec g48wk8goo88g8k8cw4cs484g-131038304011 sh -lc 'cd /app && npx prisma migrate deploy'"
  ```
- Para confirmar no PostgreSQL compartilhado do Coolify se a migration entrou:
  ```bash
  ssh root@187.77.57.122 "docker exec jk4ss8ssocc4owows0csw4kg psql -U postgres -d plantaofisio -Atqc 'SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC NULLS LAST LIMIT 10;'"
  ```
- **Nunca** usar `prisma migrate reset` em produção
- **Nunca** rodar comandos destrutivos no banco de produção sem avisar o usuário antes

### Comandos Importantes
- **Dev local:** `npm run dev`
- **Build:** `npm run build`
- **Prisma Studio:** `npx prisma studio`
- **Migrations local:** `npx prisma migrate dev`
- **Migrations em produção:** `npx prisma migrate deploy`
- **Reset DB (cuidado extremo):** `npx prisma migrate reset`

### Backup em Produção
- **Estratégia oficial de backup:** dump real do PostgreSQL com `pg_dump`, não JSON parcial
- **Rota manual para baixar backup:** `POST /api/maintenance/create-dump`
- **Rota manual para enviar ao Google Drive:** `POST /api/maintenance/upload-backup`
- **Rota de cron para backup automático no Drive:** `GET /api/cron/database-backup`
- **Proteção da rota de cron:** header `Authorization: Bearer ${CRON_SECRET}`
- **Estrutura de pastas no Google Drive para backups:** `Backups Plantaofisio / ANO / ANO-MES`
- **Formato do arquivo gerado:** `.dump` (`pg_dump --format=custom`)
- **Nunca** tratar o backup JSON antigo como estratégia principal de recuperação

### Google Drive em Produção
- **Nunca** commitar `google-credentials.json` ou `google-token.json`
- **Preferir** configurar credenciais e token no Coolify via variáveis de ambiente
- Variáveis aceitas para credenciais:
  - `GOOGLE_CREDENTIALS_JSON`
  - `GOOGLE_CREDENTIALS_JSON_BASE64`
  - ou `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- Variáveis aceitas para token:
  - `GOOGLE_TOKEN_JSON`
  - `GOOGLE_TOKEN_JSON_BASE64`
- Os arquivos locais `google-credentials.json` e `google-token.json` continuam funcionando apenas como fallback para desenvolvimento/local
- Se optar por autenticar uma vez e persistir no Coolify, copiar o conteúdo final do token OAuth para `GOOGLE_TOKEN_JSON`

### Cron no Coolify para Backup
- Exemplo de endpoint:
  ```bash
  GET https://fisio.furquim.cloud/api/cron/database-backup
  ```
- Header obrigatório:
  ```bash
  Authorization: Bearer SEU_CRON_SECRET
  ```
- Frequência recomendada inicial: 1 vez por dia fora do horário comercial
- Sempre validar manualmente o primeiro backup no Google Drive depois de configurar o cron

## 📁 Estrutura do Projeto

### Diretórios Principais
- `/src/app` - Rotas e páginas (App Router)
- `/src/app/api` - API Routes
- `/src/components` - Componentes React
- `/src/lib` - Utilitários e helpers
- `/prisma` - Schema e migrations do Prisma
- `/public` - Arquivos estáticos

### Arquivos Importantes
- `src/auth.ts` - Configuração do NextAuth
- `src/auth.config.ts` - Callbacks e providers do NextAuth
- `src/lib/auth.ts` - Funções de autenticação (hashPassword, verifyPassword, etc.)
- `src/lib/prisma.ts` - Cliente Prisma
- `prisma/schema.prisma` - Schema do banco de dados
- `.env` - Variáveis de ambiente (produção)
- `.env.local` - Variáveis de ambiente (desenvolvimento)

## 🎨 Padrões de Código

### Componentes
- Usar `'use client'` para componentes client-side
- Preferir Server Components quando possível
- TypeScript strict mode
- Interfaces para props

### API Routes
- Sempre validar autenticação com `auth()` do NextAuth
- Usar Zod para validação de dados
- Retornar JSON com status HTTP apropriado
- Tratar erros adequadamente

### Prisma
- Sempre usar transações para operações múltiplas
- Incluir relações necessárias com `include`
- Usar `select` para otimizar queries
- Converter IDs de string para number quando necessário

### Estilização
- TailwindCSS para todos os estilos
- Cores principais: indigo (sidebar), blue (botões), gray (backgrounds)
- Responsivo: mobile-first
- Usar classes utilitárias do Tailwind

## ⚠️ Cuidados e Avisos

### Nunca Fazer
- ❌ Não usar `prisma migrate reset` em produção
- ❌ Não apagar, truncar, resetar ou recriar o banco de produção sem avisar explicitamente o usuário antes
- ❌ Não executar `drop schema`, `drop table`, `truncate`, seeds destrutivos ou limpezas em massa em produção sem confirmação prévia
- ❌ Não assumir que os dados de produção podem ser recriados depois; há piloto em andamento com fisioterapeutas e plantões reais
- ❌ Não commitar arquivos `.env` ou `.env.local`
- ❌ Não commitar `google-credentials.json` ou `google-token.json`
- ❌ Não fazer deploy sem testar localmente
- ❌ Não deletar migrations do Prisma
- ❌ Não usar sistema antigo de auth-token (usar NextAuth)
- ❌ Não esquecer de converter `session.user.id` para number

### Sempre Fazer
- ✅ Testar localmente antes de fazer push
- ✅ Fazer backup do banco antes de migrations grandes
- ✅ Preferir backup automático diário no Google Drive e backup manual antes de mudanças sensíveis
- ✅ Em produção, aplicar migrations manualmente no container atual da app e validar em `_prisma_migrations`
- ✅ Se o domínio quebrar após deploy no Coolify, rodar `/root/fix-domain-after-deploy.sh`
- ✅ Usar `auth()` do NextAuth em API routes
- ✅ Validar dados com Zod
- ✅ Converter tipos corretamente (string → number)
- ✅ Verificar permissões de usuário (role-based)

## 🔧 Troubleshooting Comum

### Erro: "Invalid value provided. Expected Int, provided String"
- **Causa:** `session.user.id` é string, Prisma espera number
- **Solução:** Converter com `parseInt(session.user.id)`

### Erro: "Não autenticado" em rotas protegidas
- **Causa:** Sessão NextAuth não encontrada
- **Solução:** Verificar se `auth()` está sendo chamado corretamente

### Loop de redirecionamento login → change-password → login
- **Causa:** Callback `authorized` do NextAuth bloqueando `/change-password`
- **Solução:** Adicionar exceção para `/change-password` no callback

### Erro 401 em `/api/auth/me`
- **Causa:** Tentando usar API antiga de autenticação
- **Solução:** Usar `useSession()` do NextAuth ao invés de fetch para `/api/auth/me`

## 📝 Usuário Padrão (Admin)

### Credenciais Iniciais
- **Email:** admin@furquim.cloud
- **Senha:** admin123
- **Role:** ADMIN
- Criado via script de setup inicial

## 🎯 Funcionalidades Implementadas

### Autenticação
- ✅ Login com NextAuth
- ✅ Logout
- ✅ Troca de senha obrigatória no primeiro login
- ✅ Reset de senha por admin
- ✅ Senha padrão "furquim"

### Gestão de Usuários
- ✅ CRUD de usuários
- ✅ 3 níveis de acesso (ADMIN, MANAGER, USER)
- ✅ Vinculação com fisioterapeutas
- ✅ Reset de senha

### Plantões
- ✅ Calendário visual com FullCalendar
- ✅ Drag and drop de plantões
- ✅ Vagas por período e tipo de dia
- ✅ Filtro por equipe
- ✅ Dashboard com estatísticas

### Cadastros
- ✅ Fisioterapeutas
- ✅ Equipes de plantão
- ✅ Feriados
- ✅ Contratos
- ✅ Pagamentos

### Relatórios
- ✅ Relatório financeiro
- ✅ Folha de pagamento
- ✅ Exportação de dados

## 🔄 Histórico de Decisões Técnicas

### Por que NextAuth?
- Solução madura e bem mantida
- Integração nativa com Next.js
- Suporte a múltiplos providers
- Gerenciamento automático de sessões
- Melhor que sistema custom de auth-token

### Por que Prisma?
- Type-safety com TypeScript
- Migrations automáticas
- Cliente intuitivo
- Suporte excelente ao PostgreSQL
- Prisma Studio para debug

### Por que FullCalendar?
- Biblioteca robusta para calendários
- Suporte a drag and drop
- Customizável
- Boa documentação
- Funciona bem com React

## 📚 Recursos e Documentação

- Next.js: https://nextjs.org/docs
- NextAuth: https://authjs.dev
- Prisma: https://www.prisma.io/docs
- TailwindCSS: https://tailwindcss.com/docs
- FullCalendar: https://fullcalendar.io/docs

## 🤖 Comportamento da IA e Uso de Ferramentas (MCPs)

### 🐘 PostgreSQL MCP (Banco de Dados Local)
- **Investigação de Bugs de Dados:** Quando eu relatar um problema como "um plantão não está aparecendo" ou "o usuário não consegue logar", use o MCP do Postgres para consultar ativamente o banco em `localhost` e verificar como os dados estão salvos ANTES de sugerir mudanças no código.
- **Validação de Estrutura:** Ao criar novas queries ou debugar relações no Prisma, consulte o schema real do banco via MCP para confirmar os tipos de dados.

### 🐙 Git MCP (Controle de Versão)
- **Contexto de Alterações:** Antes de sugerir grandes refatorações, use o Git para ler o histórico recente de commits e entender o contexto das últimas mudanças.
- **Auxílio no Deploy:** Ao preparar para o push que vai para o Coolify, use o Git para analisar o `diff` das alterações locais e sugerir uma mensagem de commit precisa, lógica e **sempre em português**.

### 🧠 Memory MCP (Memória)
- **Registro Proativo:** Sempre que tomarmos uma nova decisão arquitetural importante, atualizarmos os tipos de permissão (Roles) ou resolvermos um bug complexo do NextAuth, registrar a solução permanentemente.
- **Contexto de Negócio:** Manter as regras de negócio de Plantões, Equipes e Pagamentos atualizadas para garantir continuidade entre sessões.

### 🧩 Sequential Think MCP (Raciocínio Sequencial)
- **Planejamento Obrigatório:** Para implementações de alta complexidade (ex: cálculo de folha de pagamento, lógica de feriados, grandes refatorações de UI com Tailwind), criar um plano passo a passo estruturado antes de escrever código.
- **Debug Estruturado:** Ao debugar falhas complexas de estado no React ou erros 401 na API, usar pensamento sequencial para isolar a causa raiz de forma lógica e metódica.

**Última atualização:** 17/03/2026
**Versão:** 1.1
**Mantido por:** Fábio Furquim

## Skills
A skill is a set of local instructions to follow that is stored in a `SKILL.md` file. Below is the list of skills that can be used. Each entry includes a name, description, and file path so you can open the source for full instructions when using a specific skill.
### Available skills
- openai-docs: Use when the user asks how to build with OpenAI products or APIs and needs up-to-date official documentation with citations, help choosing the latest model for a use case, or explicit GPT-5.4 upgrade and prompt-upgrade guidance; prioritize OpenAI docs MCP tools, use bundled references only as helper context, and restrict any fallback browsing to official OpenAI domains. (file: C:/Users/fabiof/.codex/skills/.system/openai-docs/SKILL.md)
- skill-creator: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Codex's capabilities with specialized knowledge, workflows, or tool integrations. (file: C:/Users/fabiof/.codex/skills/.system/skill-creator/SKILL.md)
- skill-installer: Install Codex skills into $CODEX_HOME/skills from a curated list or a GitHub repo path. Use when a user asks to list installable skills, install a curated skill, or install a skill from another repo (including private repos). (file: C:/Users/fabiof/.codex/skills/.system/skill-installer/SKILL.md)
### How to use skills
- Discovery: The list above is the skills available in this session (name + description + file path). Skill bodies live on disk at the listed paths.
- Trigger rules: If the user names a skill (with `$SkillName` or plain text) OR the task clearly matches a skill's description shown above, you must use that skill for that turn. Multiple mentions mean use them all. Do not carry skills across turns unless re-mentioned.
- Missing/blocked: If a named skill isn't in the list or the path can't be read, say so briefly and continue with the best fallback.
- How to use a skill (progressive disclosure):
  1) After deciding to use a skill, open its `SKILL.md`. Read only enough to follow the workflow.
  2) When `SKILL.md` references relative paths (e.g., `scripts/foo.py`), resolve them relative to the skill directory listed above first, and only consider other paths if needed.
  3) If `SKILL.md` points to extra folders such as `references/`, load only the specific files needed for the request; don't bulk-load everything.
  4) If `scripts/` exist, prefer running or patching them instead of retyping large code blocks.
  5) If `assets/` or templates exist, reuse them instead of recreating from scratch.
- Coordination and sequencing:
  - If multiple skills apply, choose the minimal set that covers the request and state the order you'll use them.
  - Announce which skill(s) you're using and why (one short line). If you skip an obvious skill, say why.
- Context hygiene:
  - Keep context small: summarize long sections instead of pasting them; only load extra files when needed.
  - Avoid deep reference-chasing: prefer opening only files directly linked from `SKILL.md` unless you're blocked.
  - When variants exist (frameworks, providers, domains), pick only the relevant reference file(s) and note that choice.
- Safety and fallback: If a skill can't be applied cleanly (missing files, unclear instructions), state the issue, pick the next-best approach, and continue.
