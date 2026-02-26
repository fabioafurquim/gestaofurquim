# 📊 Análise Completa do Sistema Gestão Furquim

## Sumário Executivo

Este documento apresenta uma análise detalhada do sistema de gestão para fisioterapia, identificando pontos fortes, áreas de melhoria e um plano de implementação para elevar o sistema ao padrão de mercado.

---

## 1. 🏗️ Arquitetura Atual

### Stack Tecnológica
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Next.js | 15.3.4 | Framework principal |
| React | 19.0.0 | UI Library |
| Prisma | 6.14.0 | ORM |
| PostgreSQL | - | Banco de dados |
| NextAuth | 5.0.0-beta | Autenticação |
| TailwindCSS | 4.x | Estilização |
| FullCalendar | 6.1.20 | Calendário |
| React Bootstrap | 2.10.10 | Componentes UI (legado) |

### Estrutura de Pastas
```
src/
├── app/                    # Páginas (App Router)
│   ├── api/               # API Routes
│   ├── contracts/         # Geração de contratos
│   ├── holidays/          # Feriados
│   ├── payment-control/   # Folha de pagamento
│   ├── payments/          # Pagamentos
│   ├── physiotherapists/  # Fisioterapeutas
│   ├── reports/           # Relatórios
│   ├── teams/             # Equipes
│   └── users/             # Usuários
├── components/            # Componentes reutilizáveis
├── lib/                   # Utilitários e integrações
└── types/                 # Tipos TypeScript
```

---

## 2. 📋 Funcionalidades Existentes

### 2.1 Gestão de Fisioterapeutas ✅
- Cadastro completo (dados pessoais, CREFITO, CPF, RG)
- Dados bancários (PIX, conta)
- Dados empresariais (PJ)
- Tipo de contrato (PJ, RPA, Sem Contrato)
- Status (Ativo/Inativo)

### 2.2 Gestão de Equipes ✅
- Cadastro de equipes/setores
- Configuração de vagas por período (manhã, intermediário, tarde, noite)
- Diferenciação dias úteis vs fins de semana/feriados
- Valor do plantão por equipe
- Relação many-to-many com fisioterapeutas

### 2.3 Gestão de Plantões ✅
- Calendário visual (FullCalendar)
- Criação/edição/exclusão de plantões
- Filtro por equipe
- Cores por período
- Controle de acesso (admin vs usuário)

### 2.4 Folha de Pagamento ✅
- Controle mensal
- Upload de RPA/NF
- Extração automática de dados do RPA (PDF)
- Upload de comprovante PIX
- Envio de e-mail com comprovantes
- Integração Google Drive

### 2.5 Contratos ✅
- Geração de contratos PJ
- Geração de contratos RPA
- Templates com docxtemplater

### 2.6 Relatórios ✅
- Relatório financeiro por mês
- Filtro por equipe e fisioterapeuta
- Breakdown por período

### 2.7 Integrações ✅
- Banco Inter (CNAB 240 para PIX)
- Google Drive (armazenamento)
- Gmail (envio de e-mails)

---

## 3. 🔴 Problemas Identificados

### 3.1 Design e UX

| Problema | Impacto | Prioridade |
|----------|---------|------------|
| **Mistura de bibliotecas UI** (Bootstrap + Tailwind) | Inconsistência visual, bundle maior | Alta |
| **Calendário básico** | Difícil visualização de múltiplas equipes | Alta |
| **Cores datadas** | Visual não moderno | Média |
| **Falta de feedback visual** | Usuário não sabe se ação foi executada | Alta |
| **Modais com Bootstrap** | Inconsistente com resto do sistema | Média |
| **Sidebar fixa** | Não responsiva em alguns casos | Baixa |

### 3.2 Funcionalidades

| Problema | Impacto | Prioridade |
|----------|---------|------------|
| **Fisioterapeuta em múltiplos setores** - valor diferente por setor não está implementado | Folha de pagamento incorreta | **Crítica** |
| **Falta de histórico de alterações** | Sem auditoria | Alta |
| **Sem notificações** | Usuário não é avisado de eventos | Média |
| **Relatórios limitados** | Falta exportação Excel/PDF | Média |
| **Sem dashboard resumo** | Falta visão geral rápida | Média |

### 3.3 Integração Banco Inter

| Problema | Impacto | Prioridade |
|----------|---------|------------|
| **Apenas geração de CNAB** | Não há confirmação de pagamento | Alta |
| **Sem API direta** | Processo manual de upload | Média |
| **Falta de conciliação** | Não sabe se pagamento foi efetivado | Alta |

### 3.4 Técnicos

| Problema | Impacto | Prioridade |
|----------|---------|------------|
| **API /api/auth/me** não usa NextAuth | Conflito de autenticação | Resolvido ✅ |
| **Falta de testes** | Risco de regressão | Média |
| **Logs insuficientes** | Difícil debug em produção | Baixa |

---

## 4. 💡 Melhorias Propostas

### 4.1 🎨 Design System Moderno

**Objetivo:** Criar uma identidade visual consistente e moderna.

#### Paleta de Cores Proposta
```css
/* Cores Primárias */
--primary-50: #EEF2FF;
--primary-100: #E0E7FF;
--primary-500: #6366F1;  /* Indigo moderno */
--primary-600: #4F46E5;
--primary-700: #4338CA;

/* Cores de Sucesso */
--success-500: #10B981;  /* Emerald */

/* Cores de Alerta */
--warning-500: #F59E0B;  /* Amber */

/* Cores de Erro */
--error-500: #EF4444;    /* Red */

/* Neutros */
--gray-50: #F9FAFB;
--gray-100: #F3F4F6;
--gray-900: #111827;
```

#### Componentes a Implementar
1. **shadcn/ui** - Biblioteca de componentes moderna
2. **Lucide Icons** - Ícones consistentes (já instalado)
3. **Sonner** - Toasts/notificações (já instalado)
4. **Remover Bootstrap** - Unificar em Tailwind

### 4.2 📅 Dashboard de Plantões Melhorado

#### Opção A: FullCalendar Customizado (Recomendado)
- Manter FullCalendar mas com visual customizado
- Adicionar:
  - Vista de múltiplas equipes lado a lado
  - Drag & drop entre equipes
  - Tooltips com detalhes
  - Indicadores de vagas disponíveis
  - Legenda interativa

#### Opção B: Calendário Custom
- Construir calendário próprio com React
- Mais controle visual
- Maior esforço de desenvolvimento

**Recomendação:** Opção A - FullCalendar com tema customizado

### 4.3 💰 Valor Diferenciado por Setor

**Problema atual:** O valor do plantão está no `ShiftTeam`, mas um fisioterapeuta pode trabalhar em múltiplos setores com valores diferentes.

**Solução proposta:**

```prisma
// Adicionar ao schema.prisma
model PhysiotherapistTeam {
  id                Int             @id @default(autoincrement())
  physiotherapistId Int
  shiftTeamId       Int
  customShiftValue  Decimal?        @db.Decimal(10, 2)  // NOVO: valor customizado
  physiotherapist   Physiotherapist @relation(...)
  shiftTeam         ShiftTeam       @relation(...)
  
  @@unique([physiotherapistId, shiftTeamId])
}
```

**Lógica de cálculo:**
1. Se `PhysiotherapistTeam.customShiftValue` existe → usar esse valor
2. Senão → usar `ShiftTeam.shiftValue`

### 4.4 📊 Folha de Pagamento Detalhada

**Melhorias:**
1. **Breakdown por setor** - mostrar quantos plantões em cada setor
2. **Valor por setor** - mostrar valor unitário de cada setor
3. **Subtotais** - total por setor antes do total geral
4. **Exportação** - PDF e Excel
5. **Histórico** - comparativo com meses anteriores

**Exemplo de layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ FISIOTERAPEUTA: João Silva                                  │
├─────────────────────────────────────────────────────────────┤
│ Setor          │ Plantões │ Valor Unit. │ Subtotal         │
├────────────────┼──────────┼─────────────┼──────────────────┤
│ UTI Adulto     │ 10       │ R$ 150,00   │ R$ 1.500,00      │
│ UTI Neonatal   │ 5        │ R$ 180,00   │ R$ 900,00        │
│ Emergência     │ 3        │ R$ 120,00   │ R$ 360,00        │
├────────────────┼──────────┼─────────────┼──────────────────┤
│ TOTAL          │ 18       │             │ R$ 2.760,00      │
│ Adicional      │          │             │ R$ 200,00        │
│ TOTAL BRUTO    │          │             │ R$ 2.960,00      │
└─────────────────────────────────────────────────────────────┘
```

### 4.5 🏦 Integração Banco Inter Melhorada

**Fase 1: Melhorias no CNAB**
- Validação de dados antes de gerar
- Preview do arquivo antes de download
- Histórico de arquivos gerados

**Fase 2: API Direta (Futuro)**
- Integração com API PIX do Inter
- Pagamento direto pelo sistema
- Webhook para confirmação
- Conciliação automática

### 4.6 🔔 Sistema de Notificações

**Tipos de notificação:**
1. **Plantão próximo** - lembrete 24h antes
2. **Pagamento processado** - quando folha é fechada
3. **Documento pendente** - RPA/NF não enviado
4. **Vaga disponível** - quando plantão é cancelado

**Canais:**
- In-app (toast/badge)
- E-mail
- Push notification (PWA)

### 4.7 📱 PWA (Progressive Web App)

**Benefícios:**
- Instalável no celular
- Funciona offline (cache)
- Push notifications
- Experiência nativa

---

## 5. 🗓️ Plano de Implementação

### Fase 1: Fundação (2-3 semanas)
**Objetivo:** Preparar base para melhorias

| Tarefa | Estimativa | Prioridade |
|--------|------------|------------|
| Remover Bootstrap, unificar em Tailwind | 3 dias | Alta |
| Implementar shadcn/ui | 2 dias | Alta |
| Criar Design System (cores, tipografia) | 2 dias | Alta |
| Refatorar componentes existentes | 5 dias | Alta |
| Implementar sistema de toasts (Sonner) | 1 dia | Média |

### Fase 2: Valor por Setor (1-2 semanas)
**Objetivo:** Resolver problema crítico de valores

| Tarefa | Estimativa | Prioridade |
|--------|------------|------------|
| Migração do banco (customShiftValue) | 1 dia | Crítica |
| Atualizar cadastro de fisioterapeuta | 2 dias | Crítica |
| Atualizar cálculo de folha de pagamento | 2 dias | Crítica |
| Atualizar relatórios | 2 dias | Alta |
| Testes e validação | 2 dias | Alta |

### Fase 3: Dashboard de Plantões (2-3 semanas)
**Objetivo:** Melhorar UX do calendário

| Tarefa | Estimativa | Prioridade |
|--------|------------|------------|
| Redesign do calendário (tema) | 3 dias | Alta |
| Vista multi-equipe | 3 dias | Alta |
| Indicadores de vagas | 2 dias | Média |
| Drag & drop melhorado | 2 dias | Média |
| Tooltips e detalhes | 1 dia | Baixa |
| Dashboard resumo (cards) | 2 dias | Média |

### Fase 4: Folha de Pagamento (2 semanas)
**Objetivo:** Detalhamento e exportação

| Tarefa | Estimativa | Prioridade |
|--------|------------|------------|
| Layout detalhado por setor | 3 dias | Alta |
| Exportação PDF | 2 dias | Alta |
| Exportação Excel | 2 dias | Média |
| Histórico/comparativo | 2 dias | Baixa |

### Fase 5: Integrações (2-3 semanas)
**Objetivo:** Melhorar fluxo de pagamento

| Tarefa | Estimativa | Prioridade |
|--------|------------|------------|
| Validação CNAB | 2 dias | Alta |
| Preview antes de gerar | 1 dia | Média |
| Histórico de arquivos | 2 dias | Média |
| Pesquisa API Inter | 3 dias | Baixa |
| Implementação API (se viável) | 5 dias | Baixa |

### Fase 6: Extras (Contínuo)
**Objetivo:** Polimento e features adicionais

| Tarefa | Estimativa | Prioridade |
|--------|------------|------------|
| Sistema de notificações | 5 dias | Média |
| PWA | 3 dias | Baixa |
| Testes automatizados | Contínuo | Média |
| Documentação | Contínuo | Baixa |

---

## 6. 📐 Mockups Conceituais

### 6.1 Nova Dashboard

```
┌──────────────────────────────────────────────────────────────────────┐
│  🏠 Dashboard                                           👤 Admin ▼  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│  │ 📅 Plantões │ │ 👥 Fisios   │ │ 💰 A Pagar  │ │ ⚠️ Pendentes│    │
│  │    Hoje     │ │   Ativos    │ │  Este Mês   │ │  Documentos │    │
│  │     12      │ │     24      │ │ R$ 45.000   │ │      5      │    │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Calendário de Plantões                    [Equipe ▼] [+]   │    │
│  │  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐               │    │
│  │  │ Seg │ Ter │ Qua │ Qui │ Sex │ Sáb │ Dom │               │    │
│  │  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤               │    │
│  │  │ 🔵  │ 🔵  │ 🔵  │ 🔵  │ 🔵  │ 🟢  │ 🟢  │               │    │
│  │  │ 🟣  │ 🟣  │     │ 🟣  │ 🟣  │ 🔴  │ 🔴  │               │    │
│  │  │ 🟢  │ 🟢  │ 🟢  │ 🟢  │ 🟢  │     │     │               │    │
│  │  │ 🔴  │ 🔴  │ 🔴  │ 🔴  │ 🔴  │     │     │               │    │
│  │  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘               │    │
│  │                                                             │    │
│  │  Legenda: 🔵 Manhã  🟣 Intermediário  🟢 Tarde  🔴 Noite   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 Vista Multi-Equipe

```
┌──────────────────────────────────────────────────────────────────────┐
│  Plantões - Fevereiro 2026                    [< Mês >] [Semana]    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                   │
│  │ UTI Adulto          │  │ UTI Neonatal        │                   │
│  │ Vagas: 4/4 ✅       │  │ Vagas: 3/4 ⚠️       │                   │
│  ├─────────────────────┤  ├─────────────────────┤                   │
│  │ 🔵 João Silva       │  │ 🔵 Maria Santos     │                   │
│  │ 🔵 Pedro Costa      │  │ 🔵 Ana Lima         │                   │
│  │ 🟢 Carlos Souza     │  │ 🟢 Paulo Oliveira   │                   │
│  │ 🔴 Fernanda Reis    │  │ 🔴 [VAGA]           │                   │
│  └─────────────────────┘  └─────────────────────┘                   │
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                   │
│  │ Emergência          │  │ Enfermaria          │                   │
│  │ Vagas: 2/2 ✅       │  │ Vagas: 1/2 ⚠️       │                   │
│  ├─────────────────────┤  ├─────────────────────┤                   │
│  │ 🔵 Lucas Mendes     │  │ 🔵 Juliana Alves    │                   │
│  │ 🔴 Beatriz Rocha    │  │ 🔴 [VAGA]           │                   │
│  └─────────────────────┘  └─────────────────────┘                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. 🎯 Métricas de Sucesso

| Métrica | Atual | Meta |
|---------|-------|------|
| Tempo para criar plantão | ~30s | <10s |
| Tempo para gerar folha | ~5min | <1min |
| Erros de cálculo | Desconhecido | 0 |
| Satisfação do usuário | - | >4.5/5 |
| Tempo de carregamento | ~3s | <1s |

---

## 8. 🚀 Próximos Passos

1. **Aprovar este plano** - revisar prioridades
2. **Definir escopo da Fase 1** - quais itens primeiro
3. **Criar branch de desenvolvimento** - `feature/redesign-v2`
4. **Iniciar implementação** - seguir cronograma

---

## 9. ❓ Perguntas para Decisão

1. **Calendário:** Manter FullCalendar ou construir custom?
2. **Cores:** Aprovar paleta proposta ou sugerir alternativas?
3. **Prioridade:** Começar por design ou por valor por setor?
4. **API Inter:** Investir tempo em integração direta?
5. **PWA:** É prioridade ter app instalável?

---

*Documento gerado em: 26/02/2026*
*Versão: 1.0*
