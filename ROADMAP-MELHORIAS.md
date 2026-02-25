# 🚀 Roadmap de Melhorias - Gestão Furquim

> Documento de recomendações para evolução do sistema de gestão de fisioterapeutas.
> Objetivo: transformar a aplicação em uma solução genérica e escalável para qualquer empresa de fisioterapia.

---

## 📊 Análise do Estado Atual

### Módulos Existentes
| Módulo | Status | Observações |
|--------|--------|-------------|
| Gestão de Fisioterapeutas | ✅ Funcional | Cadastro completo com dados bancários |
| Gestão de Equipes | ✅ Funcional | Suporte a múltiplas equipes por fisioterapeuta |
| Calendário de Plantões | ✅ Funcional | FullCalendar com 4 períodos |
| Contratos (PJ/RPA) | ✅ Funcional | Geração de PDF |
| Relatórios Financeiros | ⚠️ Básico | Apenas visualização, sem exportação |
| Folha de Pagamento | ⚠️ Parcial | Upload manual de arquivos |
| Integração Google | ✅ Funcional | Drive + Gmail |
| Geração CNAB | ✅ Funcional | Banco Inter (PIX) |
| Notificações | ❌ Inexistente | - |
| Multi-tenancy | ❌ Inexistente | - |

### Pontos Fortes
- Arquitetura moderna (Next.js 14, Prisma, PostgreSQL)
- Integração com Google Drive/Gmail funcional
- Sistema de autenticação com roles (ADMIN/USER)
- Suporte a diferentes tipos de contrato (PJ/RPA)

### Pontos de Melhoria
- Muitos processos ainda manuais
- Falta de automação no cálculo de pagamentos
- Ausência de notificações
- Interface pode ser mais intuitiva
- Falta de dashboards analíticos

---

## 🔔 PRIORIDADE ALTA: Sistema de Notificações

### 1.1 Notificações de Plantão (Complexidade: Média)
**Objetivo:** Avisar fisioterapeutas sobre plantões do dia seguinte.

**Implementação:**
```
┌─────────────────────────────────────────────────────────┐
│  CRON JOB (diário às 18h)                               │
│  ├── Buscar plantões do dia seguinte                    │
│  ├── Agrupar por fisioterapeuta                         │
│  └── Enviar notificação (Email/WhatsApp/Push)           │
└─────────────────────────────────────────────────────────┘
```

**Tarefas:**
- [ ] Criar modelo `Notification` no Prisma
- [ ] Criar tabela de preferências de notificação por usuário
- [ ] Implementar job scheduler (node-cron ou Vercel Cron)
- [ ] Integrar com serviço de e-mail (já existe Gmail)
- [ ] Integrar com WhatsApp Business API (opcional)
- [ ] Criar página de configuração de notificações

**Schema sugerido:**
```prisma
model NotificationPreference {
  id                Int             @id @default(autoincrement())
  physiotherapistId Int             @unique
  physiotherapist   Physiotherapist @relation(fields: [physiotherapistId], references: [id])
  emailEnabled      Boolean         @default(true)
  whatsappEnabled   Boolean         @default(false)
  pushEnabled       Boolean         @default(false)
  reminderHours     Int             @default(18) // Hora do lembrete (18 = 18h)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
}

model NotificationLog {
  id                Int             @id @default(autoincrement())
  physiotherapistId Int
  type              NotificationType
  channel           NotificationChannel
  status            NotificationStatus
  message           String
  sentAt            DateTime?
  error             String?
  createdAt         DateTime        @default(now())
}

enum NotificationType {
  SHIFT_REMINDER      // Lembrete de plantão
  PAYMENT_RECEIVED    // Pagamento recebido
  DOCUMENT_READY      // Documento disponível
  SCHEDULE_CHANGE     // Alteração na escala
}

enum NotificationChannel {
  EMAIL
  WHATSAPP
  PUSH
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
}
```

### 1.2 Notificações de Pagamento (Complexidade: Baixa)
- Avisar quando o pagamento foi processado
- Avisar quando o comprovante está disponível
- Avisar sobre pendências de documentos (NF para PJ)

### 1.3 Notificações de Alteração de Escala (Complexidade: Baixa)
- Avisar quando um plantão é adicionado/removido
- Avisar sobre trocas de plantão

---

## 💰 PRIORIDADE ALTA: Automação da Folha de Pagamento

### 2.1 Cálculo Automático de Valores (Complexidade: Alta)

**Fluxo Proposto:**
```
┌─────────────────────────────────────────────────────────────────┐
│  1. GERAR FOLHA DO MÊS                                          │
│     └── Buscar todos os plantões do mês                         │
│         └── Agrupar por fisioterapeuta                          │
│             └── Calcular valor bruto (plantões × valor)         │
│                 └── Aplicar descontos (INSS, ISS, IRRF)         │
│                     └── Gerar valor líquido                     │
├─────────────────────────────────────────────────────────────────┤
│  2. CONFERÊNCIA VISUAL                                          │
│     └── Exibir tabela com todos os valores calculados           │
│         └── Permitir ajustes manuais (bônus, descontos extra)   │
│             └── Aprovar folha                                   │
├─────────────────────────────────────────────────────────────────┤
│  3. PROCESSAMENTO                                               │
│     └── Gerar arquivo CNAB para pagamento em lote               │
│         └── Gerar RPA/NF automaticamente                        │
│             └── Fazer upload para Google Drive                  │
│                 └── Enviar e-mails com comprovantes             │
└─────────────────────────────────────────────────────────────────┘
```

**Tarefas:**
- [ ] Criar API `/api/payment-control/[month]/generate` que calcula automaticamente
- [ ] Implementar regras de cálculo de impostos (INSS, ISS, IRRF)
- [ ] Criar tabela de alíquotas configurável
- [ ] Adicionar campo de "valor adicional" por registro (bônus, ajustes)
- [ ] Criar tela de conferência com edição inline
- [ ] Implementar botão "Aprovar e Processar" que faz tudo de uma vez

**Schema adicional:**
```prisma
model TaxConfiguration {
  id          Int      @id @default(autoincrement())
  name        String   // Ex: "INSS 2024", "ISS Curitiba"
  type        TaxType
  percentage  Decimal  @db.Decimal(5, 2)
  minValue    Decimal? @db.Decimal(10, 2) // Valor mínimo para aplicar
  maxValue    Decimal? @db.Decimal(10, 2) // Teto
  validFrom   DateTime
  validUntil  DateTime?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum TaxType {
  INSS
  ISS
  IRRF
}
```

### 2.2 Integração Bancária Avançada (Complexidade: Alta)

**Funcionalidades:**
- [ ] Suporte a múltiplos bancos (Inter, Itaú, Bradesco, etc.)
- [ ] Importação de extrato para conciliação automática
- [ ] Confirmação automática de pagamentos via webhook
- [ ] Dashboard de status de pagamentos em tempo real

### 2.3 Geração Automática de Documentos (Complexidade: Média)

**Para RPA:**
- [ ] Gerar RPA automaticamente com dados do sistema
- [ ] Preencher valores calculados
- [ ] Assinar digitalmente (opcional)

**Para PJ:**
- [ ] Integrar com sistemas de NF-e (Nota Fiscal Eletrônica)
- [ ] Solicitar NF automaticamente ao fisioterapeuta
- [ ] Validar NF recebida

---

## 📈 PRIORIDADE MÉDIA: Relatórios Avançados

### 3.1 Dashboard Analítico (Complexidade: Média)

**Métricas sugeridas:**
- Total de plantões por período (dia/semana/mês/ano)
- Custo total com folha de pagamento
- Distribuição de plantões por equipe
- Fisioterapeutas mais ativos
- Tendência de custos ao longo do tempo
- Comparativo mês a mês

**Visualizações:**
- Gráficos de linha (evolução temporal)
- Gráficos de pizza (distribuição)
- Gráficos de barras (comparativos)
- Cards com KPIs principais

**Bibliotecas sugeridas:**
- Recharts ou Chart.js para gráficos
- React-table para tabelas avançadas

### 3.2 Exportação de Relatórios (Complexidade: Baixa)

- [ ] Exportar para Excel (.xlsx)
- [ ] Exportar para PDF
- [ ] Exportar para CSV
- [ ] Agendamento de relatórios por e-mail

### 3.3 Relatório de Horas Trabalhadas (Complexidade: Baixa)

- Total de horas por fisioterapeuta
- Horas extras (se aplicável)
- Histórico de presença

---

## 🎨 PRIORIDADE MÉDIA: Melhorias de UX/UI

### 4.1 Redesign do Dashboard Principal (Complexidade: Média)

**Proposta:**
```
┌─────────────────────────────────────────────────────────────────┐
│  DASHBOARD                                                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │Plantões │ │  Folha  │ │Pendên-  │ │  Custo  │               │
│  │  Hoje   │ │ do Mês  │ │  cias   │ │  Total  │               │
│  │   12    │ │R$45.000 │ │    3    │ │R$52.000 │               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐ ┌─────────────────────────┐       │
│  │    CALENDÁRIO RESUMIDO  │ │   AÇÕES RÁPIDAS         │       │
│  │    [Mini calendário]    │ │   • Gerar Folha         │       │
│  │                         │ │   • Ver Pendências      │       │
│  │                         │ │   • Adicionar Plantão   │       │
│  └─────────────────────────┘ └─────────────────────────┘       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐       │
│  │              GRÁFICO DE CUSTOS (6 meses)            │       │
│  │    ▄▄▄                                              │       │
│  │   ▄███▄    ▄▄▄                                      │       │
│  │  ▄█████▄  ▄███▄   ▄▄▄    ▄▄▄    ▄▄▄    ▄▄▄         │       │
│  │  Jul  Ago  Set   Out   Nov   Dez                    │       │
│  └─────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Melhorias no Calendário de Plantões (Complexidade: Baixa)

- [ ] Visualização por semana mais compacta
- [ ] Drag-and-drop para mover plantões
- [ ] Filtros rápidos por período
- [ ] Legenda de cores mais visível
- [ ] Indicador de conflitos (mesmo fisioterapeuta em dois lugares)

### 4.3 Modo Escuro (Complexidade: Baixa)

- [ ] Implementar tema escuro
- [ ] Salvar preferência do usuário
- [ ] Detectar preferência do sistema

### 4.4 Responsividade Mobile (Complexidade: Média)

- [ ] Otimizar calendário para mobile
- [ ] Menu hambúrguer funcional
- [ ] Touch-friendly para todas as ações

### 4.5 Acessibilidade (Complexidade: Baixa)

- [ ] Suporte a leitores de tela
- [ ] Navegação por teclado
- [ ] Contraste adequado
- [ ] Labels em todos os campos

---

## 🏢 PRIORIDADE BAIXA: Multi-tenancy (Escalabilidade)

### 5.1 Suporte a Múltiplas Empresas (Complexidade: Alta)

**Objetivo:** Permitir que o sistema seja usado por várias empresas de fisioterapia.

**Arquitetura:**
```
┌─────────────────────────────────────────────────────────────────┐
│                        TENANT (Empresa)                         │
├─────────────────────────────────────────────────────────────────┤
│  • Configurações próprias                                       │
│  • Usuários próprios                                            │
│  • Fisioterapeutas próprios                                     │
│  • Equipes próprias                                             │
│  • Dados financeiros isolados                                   │
│  • Integrações próprias (Google, Banco)                         │
└─────────────────────────────────────────────────────────────────┘
```

**Schema:**
```prisma
model Tenant {
  id              Int      @id @default(autoincrement())
  name            String
  slug            String   @unique // URL: empresa.gestaofurquim.com
  cnpj            String?
  logo            String?
  primaryColor    String?  @default("#1a5276")
  plan            PlanType @default(FREE)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relações
  users           User[]
  physiotherapists Physiotherapist[]
  teams           ShiftTeam[]
  // ... todas as outras entidades
}

enum PlanType {
  FREE
  BASIC
  PROFESSIONAL
  ENTERPRISE
}
```

### 5.2 Planos e Limites (Complexidade: Média)

| Recurso | Free | Basic | Pro | Enterprise |
|---------|------|-------|-----|------------|
| Fisioterapeutas | 5 | 20 | 100 | Ilimitado |
| Equipes | 2 | 5 | 20 | Ilimitado |
| Usuários Admin | 1 | 3 | 10 | Ilimitado |
| Armazenamento | 1GB | 10GB | 50GB | Ilimitado |
| Notificações | Email | Email+WhatsApp | Todos | Todos |
| Suporte | Comunidade | Email | Prioritário | Dedicado |

---

## 🔧 PRIORIDADE BAIXA: Integrações Adicionais

### 6.1 Integração com WhatsApp Business (Complexidade: Média)

- Notificações de plantão
- Confirmação de presença
- Envio de comprovantes
- Chatbot para consultas

### 6.2 Integração com Calendário (Complexidade: Baixa)

- Sincronizar plantões com Google Calendar
- Sincronizar com Outlook
- Arquivo .ics para download

### 6.3 API Pública (Complexidade: Média)

- Documentação OpenAPI/Swagger
- Autenticação via API Key
- Rate limiting
- Webhooks para eventos

### 6.4 Integração com Sistemas de Ponto (Complexidade: Alta)

- Importar registros de ponto
- Validar presença em plantões
- Calcular horas extras automaticamente

---

## 🛡️ Melhorias de Segurança e Infraestrutura

### 7.1 Segurança (Complexidade: Variada)

- [ ] Implementar 2FA (Two-Factor Authentication)
- [ ] Logs de auditoria (quem fez o quê e quando)
- [ ] Política de senhas mais rígida
- [ ] Sessões com expiração configurável
- [ ] Backup automático do banco de dados

### 7.2 Performance (Complexidade: Média)

- [ ] Implementar cache (Redis)
- [ ] Otimizar queries do Prisma
- [ ] Lazy loading de componentes
- [ ] Compressão de imagens

### 7.3 Monitoramento (Complexidade: Baixa)

- [ ] Integrar com Sentry (erros)
- [ ] Integrar com Analytics
- [ ] Health checks
- [ ] Alertas de downtime

---

## 📅 Cronograma Sugerido

### Fase 1 - Fundação (1-2 meses)
1. Sistema de Notificações básico (email)
2. Cálculo automático da folha de pagamento
3. Melhorias no dashboard

### Fase 2 - Automação (2-3 meses)
1. Processamento em lote de pagamentos
2. Geração automática de documentos
3. Relatórios avançados com exportação

### Fase 3 - Experiência (1-2 meses)
1. Redesign do calendário
2. Modo escuro
3. Melhorias de responsividade

### Fase 4 - Escala (3-6 meses)
1. Multi-tenancy
2. Planos e billing
3. API pública

---

## 💡 Ideias Adicionais

### Portal do Fisioterapeuta
- Área exclusiva para o fisioterapeuta ver seus plantões
- Histórico de pagamentos
- Download de documentos
- Solicitação de trocas de plantão

### Marketplace de Plantões
- Fisioterapeutas podem oferecer/pegar plantões extras
- Sistema de matching automático
- Aprovação pelo admin

### App Mobile Nativo
- React Native ou Flutter
- Notificações push nativas
- Acesso offline ao calendário

### Inteligência Artificial
- Sugestão automática de escala
- Previsão de custos
- Detecção de anomalias em pagamentos

---

## 📝 Notas Finais

Este documento deve ser revisado periodicamente conforme o sistema evolui. As prioridades podem mudar baseadas em:

- Feedback dos usuários
- Necessidades do negócio
- Recursos disponíveis
- Oportunidades de mercado

**Última atualização:** Dezembro 2024

---

*Documento gerado para o projeto Gestão Furquim - Sistema de Gestão de Fisioterapeutas*
