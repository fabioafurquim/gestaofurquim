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
- **Credenciais DB:** Configuradas via variável de ambiente no Coolify
  - DATABASE_URL: `postgresql://postgres:eLE1NPit1YQKnVU1o2QTABzxPZ46v9iAHyTlXWNwUxv6CCco1sFi5nOeCVSEHhKp@jk4ss8ssocc4owows0csw4kg:5432/plantaofisio`
  - Host interno: jk4ss8ssocc4owows0csw4kg
  - Port: 5432
  - Database: plantaofisio
  - User: postgres
- **Deploy:** Automático via Coolify ao fazer push para GitHub
- **Container Docker:** Gerenciado pelo Coolify
- **Estratégia real de deploy no Coolify:** Nixpacks
- **Build verificado em produção:** `npm ci` + `npm run build`
- **Comando de runtime verificado em produção:** `npm run start`
- **Dockerfile:** `Dockerfile.vps` existe no repositório, mas **não está sendo usado** no deploy atual do Coolify

## 🚀 Processo de Deploy

### Quem Faz Deploy
- **Usuário** é responsável por fazer o deploy
- **Cascade** pode auxiliar e também pode acessar via SSH se necessário

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
5. Coolify detecta push e faz deploy automático via **Nixpacks**
6. Após o deploy, aplicar migrations de produção manualmente se houver mudanças no Prisma:
   ```bash
   npx prisma migrate deploy
   ```
7. Aguardar build e deploy (alguns minutos)
8. Verificar em https://fisio.furquim.cloud

### Comandos Importantes
- **Dev local:** `npm run dev`
- **Build:** `npm run build`
- **Prisma Studio:** `npx prisma studio`
- **Migrations:** `npx prisma migrate dev`
- **Migrations em produção:** `npx prisma migrate deploy`
- **Reset DB (cuidado!):** `npx prisma migrate reset`

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
- ❌ Não commitar arquivos `.env` ou `.env.local`
- ❌ Não fazer deploy sem testar localmente
- ❌ Não deletar migrations do Prisma
- ❌ Não usar sistema antigo de auth-token (usar NextAuth)
- ❌ Não esquecer de converter `session.user.id` para number

### Sempre Fazer
- ✅ Testar localmente antes de fazer push
- ✅ Fazer backup do banco antes de migrations grandes
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
- **Validação de Estrutura:** Ao criar novas queries ou debugar relações no Prisma, consulte o schema real do banco via MCP para confirmar os tipos de dados (lembrando sempre da regra de conversão de ID String para Number).

### 🐙 Git MCP (Controle de Versão)
- **Contexto de Alterações:** Antes de sugerir grandes refatorações, use o Git para ler o histórico recente de commits e entender o contexto das últimas mudanças.
- **Auxílio no Deploy:** Ao preparar para o push que vai para o Coolify, use o Git MCP para analisar o `diff` das alterações locais e me sugerir uma mensagem de commit precisa, lógica e **SEMPRE em português**.

### 🧠 Memory MCP (Memória)
- **Registro Proativo:** Sempre que tomarmos uma nova decisão arquitetural importante, atualizarmos os tipos de permissão (Roles) ou resolvermos um bug complexo do NextAuth, use a ferramenta de Memória para registrar a solução permanentemente.
- **Contexto de Negócio:** Mantenha as regras de negócio de "Plantões", "Equipes" e "Pagamentos" atualizadas na memória para garantir a continuidade perfeita do projeto entre as sessões.

### 🧩 Sequential Think MCP (Raciocínio Sequencial)
- **Planejamento Obrigatório:** Para implementações de alta complexidade (ex: cálculo de folha de pagamento, lógica de feriados, grandes refatorações de UI com Tailwind), acione OBRIGATORIAMENTE o raciocínio sequencial para criar um plano passo a passo estruturado ANTES de começar a escrever o código.
- **Debug Estruturado:** Ao debugar falhas complexas de estado no React ou erros 401 na API, use o pensamento sequencial para isolar a causa raiz de forma lógica e metódica.

**Última atualização:** 05/03/2026
**Versão:** 1.0
**Mantido por:** Fábio Furquim
