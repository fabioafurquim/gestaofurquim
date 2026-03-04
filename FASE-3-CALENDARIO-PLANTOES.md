# 📅 FASE 3: Sistema de Calendário de Plantões - Análise e Melhorias

## 📋 Sumário Executivo

Este documento apresenta uma análise completa do sistema de calendário de plantões, identificando o estado atual, propondo melhorias visuais, novas funcionalidades de negócio e um sistema completo de troca de plantões com portal do fisioterapeuta.

**Objetivo:** Transformar o calendário de plantões no coração do sistema, com foco em:
- ✅ Manter todas as regras atuais funcionando
- 🎨 Melhorar visual e UX (mantendo FullCalendar)
- 🔄 Implementar sistema de trocas de plantões
- 👤 Criar portal self-service para fisioterapeutas
- 📱 Otimizar experiência mobile

---

## 1️⃣ ESTADO ATUAL - O QUE JÁ FUNCIONA

### ✅ Funcionalidades Implementadas

**Gestão de Plantões:**
- ✅ Calendário visual com FullCalendar
- ✅ Criação de plantões por data/período/fisioterapeuta
- ✅ Edição e exclusão de plantões
- ✅ Drag & drop para mover plantões entre datas
- ✅ Filtro por equipe
- ✅ Cores por período (Manhã/Intermediário/Tarde/Noite)
- ✅ Estatísticas mensais por período
- ✅ Legenda visual

**Regras de Negócio Atuais:**
- ✅ Controle de vagas por período (dias úteis vs fins de semana/feriados)
- ✅ Fisioterapeuta pode estar em múltiplas equipes
- ✅ Valor customizado por fisioterapeuta/equipe
- ✅ Validação de duplicidade (mesmo fisio, mesma data/período)
- ✅ Controle de acesso (ADMIN vs USER)
- ✅ USER só vê e gerencia seus próprios plantões

**Pontos Fortes:**
- 🟢 FullCalendar é robusto e confiável
- 🟢 Interface limpa com shadcn/ui
- 🟢 Responsivo (funciona em mobile)
- 🟢 Drag & drop funcional
- 🟢 Validações de negócio bem implementadas

---

## 2️⃣ OPORTUNIDADES DE MELHORIA

### 🎨 A. Melhorias Visuais (Mantendo FullCalendar)

#### A1. Tema Customizado do FullCalendar
**Problema:** Visual padrão do FullCalendar é genérico

**Solução:**
```css
/* Customizar cores e espaçamentos */
.fc-theme-standard {
  --fc-border-color: #e5e7eb;
  --fc-button-bg-color: #4F46E5;
  --fc-button-border-color: #4F46E5;
  --fc-button-hover-bg-color: #4338CA;
  --fc-button-active-bg-color: #3730A3;
}

/* Eventos mais modernos */
.fc-event {
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 13px;
  font-weight: 500;
  border: none !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* Hover mais suave */
.fc-event:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0,0,0,0.15);
  transition: all 0.2s;
}
```

#### A2. Indicadores de Vagas Disponíveis
**Problema:** Não é visível quantas vagas restam por período

**Solução:** Adicionar badges no cabeçalho de cada dia
```tsx
// Exemplo visual no calendário:
// Seg 03/03
// 🔵 2/4  🟣 1/2  🟢 3/3  🔴 1/2
```

#### A3. Tooltips Informativos
**Problema:** Falta informação ao passar mouse sobre evento

**Solução:**
```tsx
eventContent={(arg) => (
  <div className="fc-event-main" title={`
    ${arg.event.title}
    ${arg.event.extendedProps.period}
    Valor: R$ ${arg.event.extendedProps.shiftValue}
    Equipe: ${arg.event.extendedProps.teamName}
  `}>
    {arg.event.title}
  </div>
)}
```

#### A4. Vista Multi-Equipe (Lado a Lado)
**Problema:** Só vê uma equipe por vez

**Solução:** Criar abas ou grid com múltiplos calendários compactos
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  {selectedTeams.map(team => (
    <MiniCalendar key={team.id} team={team} />
  ))}
</div>
```

#### A5. Dashboard de Resumo (Cards no Topo)
**Problema:** Falta visão geral rápida

**Solução:**
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
  <Card>
    <CardHeader>
      <CardTitle>Plantões Hoje</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-3xl font-bold">12</p>
    </CardContent>
  </Card>
  
  <Card>
    <CardHeader>
      <CardTitle>Vagas Abertas</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-3xl font-bold text-amber-600">5</p>
    </CardContent>
  </Card>
  
  <Card>
    <CardHeader>
      <CardTitle>Este Mês</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-3xl font-bold">87</p>
    </CardContent>
  </Card>
  
  <Card>
    <CardHeader>
      <CardTitle>Trocas Pendentes</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-3xl font-bold text-blue-600">3</p>
    </CardContent>
  </Card>
</div>
```

---

### 🔄 B. Sistema de Troca de Plantões

#### B1. Nova Tabela no Schema
```prisma
model ShiftSwapRequest {
  id                    Int             @id @default(autoincrement())
  shiftId               Int             // Plantão que quer trocar
  requesterId           Int             // Quem está pedindo a troca
  targetPhysioId        Int?            // Para quem está oferecendo (null = aberto para todos)
  status                SwapStatus      @default(PENDING)
  reason                String?         // Motivo da troca
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt
  respondedAt           DateTime?
  responderId           Int?            // Quem aceitou a troca
  
  shift                 Shift           @relation(fields: [shiftId], references: [id])
  requester             Physiotherapist @relation("SwapRequester", fields: [requesterId], references: [id])
  targetPhysio          Physiotherapist? @relation("SwapTarget", fields: [targetPhysioId], references: [id])
  responder             Physiotherapist? @relation("SwapResponder", fields: [responderId], references: [id])
}

enum SwapStatus {
  PENDING       // Aguardando resposta
  ACCEPTED      // Aceito
  REJECTED      // Rejeitado
  CANCELLED     // Cancelado pelo solicitante
  EXPIRED       // Expirado (após X dias)
}
```

#### B2. Fluxo de Troca

**Cenário 1: Troca Direta (para fisioterapeuta específico)**
1. Fisio A tem plantão dia 10/03 - Manhã
2. Fisio A solicita troca com Fisio B
3. Fisio B recebe notificação
4. Fisio B aceita → Sistema troca automaticamente
5. Ambos recebem confirmação

**Cenário 2: Troca Aberta (para qualquer um da equipe)**
1. Fisio A tem plantão dia 10/03 - Manhã
2. Fisio A publica troca aberta
3. Todos da equipe veem no "Mural de Trocas"
4. Primeiro que aceitar → troca efetivada

**Cenário 3: Troca Dupla (swap de plantões)**
1. Fisio A tem plantão dia 10/03 - Manhã
2. Fisio B tem plantão dia 15/03 - Tarde
3. Fisio A propõe trocar os dois plantões
4. Fisio B aceita → Sistema troca ambos

#### B3. Interface de Trocas

**No Calendário:**
```tsx
// Botão no evento
<button onClick={() => requestSwap(shift)}>
  🔄 Solicitar Troca
</button>

// Badge visual no evento
{shift.hasSwapRequest && (
  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
    🔄
  </span>
)}
```

**Mural de Trocas (Nova Página):**
```tsx
<div className="space-y-4">
  <h2>Trocas Disponíveis</h2>
  
  {swapRequests.map(swap => (
    <Card key={swap.id}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <p className="font-medium">{swap.requester.name}</p>
            <p className="text-sm text-gray-500">
              {formatDate(swap.shift.date)} - {swap.shift.period}
            </p>
            <p className="text-sm text-gray-500">
              Equipe: {swap.shift.shiftTeam.name}
            </p>
          </div>
          <Badge variant={swap.targetPhysioId ? "default" : "secondary"}>
            {swap.targetPhysioId ? "Troca Direta" : "Troca Aberta"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {swap.reason && (
          <p className="text-sm mb-4">Motivo: {swap.reason}</p>
        )}
        
        {canAcceptSwap(swap) && (
          <Button onClick={() => acceptSwap(swap.id)}>
            Aceitar Troca
          </Button>
        )}
      </CardContent>
    </Card>
  ))}
</div>
```

---

### 👤 C. Portal do Fisioterapeuta (Self-Service)

#### C1. Dashboard do Fisioterapeuta
```tsx
// Rota: /fisioterapeuta/dashboard

<div className="space-y-6">
  {/* Resumo Pessoal */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <Card>
      <CardHeader>
        <CardTitle>Meus Plantões Este Mês</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{myShiftsCount}</p>
        <p className="text-sm text-gray-500">
          Valor estimado: R$ {estimatedValue}
        </p>
      </CardContent>
    </Card>
    
    <Card>
      <CardHeader>
        <CardTitle>Próximo Plantão</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-medium">{nextShift.date}</p>
        <p className="text-sm text-gray-500">
          {nextShift.team} - {nextShift.period}
        </p>
      </CardContent>
    </Card>
    
    <Card>
      <CardHeader>
        <CardTitle>Trocas Pendentes</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-amber-600">
          {pendingSwaps}
        </p>
      </CardContent>
    </Card>
  </div>
  
  {/* Calendário Pessoal */}
  <Card>
    <CardHeader>
      <CardTitle>Meu Calendário</CardTitle>
    </CardHeader>
    <CardContent>
      <FullCalendar
        events={myShiftsOnly}
        // Configurações simplificadas
      />
    </CardContent>
  </Card>
  
  {/* Ações Rápidas */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <Card>
      <CardHeader>
        <CardTitle>Solicitar Plantão Extra</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>Ver Vagas Disponíveis</Button>
      </CardContent>
    </Card>
    
    <Card>
      <CardHeader>
        <CardTitle>Minhas Trocas</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>Gerenciar Trocas</Button>
      </CardContent>
    </Card>
  </div>
</div>
```

#### C2. Funcionalidades do Portal

**Visualização:**
- ✅ Ver apenas seus plantões
- ✅ Calendário pessoal
- ✅ Histórico de plantões
- ✅ Relatório de horas/valores

**Ações:**
- ✅ Solicitar troca de plantão
- ✅ Aceitar/rejeitar trocas
- ✅ Candidatar-se a vagas abertas
- ✅ Ver plantões disponíveis para pegar

**Notificações:**
- 🔔 Lembrete 24h antes do plantão
- 🔔 Nova solicitação de troca
- 🔔 Troca aceita/rejeitada
- 🔔 Nova vaga disponível na sua equipe

---

### 📱 D. Melhorias Mobile

#### D1. Layout Responsivo Otimizado
```tsx
// Vista mobile compacta
<div className="md:hidden">
  {/* Lista ao invés de calendário completo */}
  <div className="space-y-2">
    {shiftsGroupedByDate.map(day => (
      <Card key={day.date}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {formatDate(day.date)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {day.shifts.map(shift => (
              <div key={shift.id} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: periodColor[shift.period] }}
                />
                <span>{shift.physiotherapist.name}</span>
                <span className="text-gray-500">{shift.period}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
</div>
```

#### D2. Gestos Touch
- Swipe para navegar entre meses
- Long press para criar plantão
- Pull to refresh

---

## 3️⃣ NOVAS REGRAS DE NEGÓCIO PROPOSTAS

### 🎯 Regras Inteligentes

**R1. Distribuição Equilibrada**
- Sistema sugere fisioterapeutas com menos plantões no mês
- Alerta se alguém está com carga muito alta/baixa

**R2. Preferências de Horário**
- Fisioterapeuta pode marcar preferências (ex: "Prefiro manhã")
- Sistema considera ao sugerir plantões

**R3. Bloqueio de Datas**
- Fisioterapeuta pode bloquear datas (férias, compromissos)
- Sistema não permite alocação nessas datas

**R4. Plantões Recorrentes**
- Criar padrão (ex: "Toda segunda-feira - Manhã")
- Sistema cria automaticamente para o mês

**R5. Limite de Plantões Consecutivos**
- Configurar máximo de dias seguidos
- Alerta ao tentar alocar além do limite

**R6. Tempo Mínimo Entre Plantões**
- Ex: Mínimo 12h entre plantões
- Validação ao criar/mover plantão

---

## 4️⃣ PLANO DE IMPLEMENTAÇÃO

### 🚀 Fase 3A: Melhorias Visuais (1-2 semanas)

**Prioridade: ALTA**

| Tarefa | Estimativa | Complexidade |
|--------|------------|--------------|
| Tema customizado FullCalendar | 2 dias | Baixa |
| Indicadores de vagas | 2 dias | Média |
| Tooltips informativos | 1 dia | Baixa |
| Dashboard com cards de resumo | 2 dias | Média |
| Melhorias mobile (lista compacta) | 2 dias | Média |
| **TOTAL** | **9 dias** | |

**Resultado esperado:** Calendário visualmente moderno e informativo

---

### 🔄 Fase 3B: Sistema de Trocas (2-3 semanas)

**Prioridade: ALTA**

| Tarefa | Estimativa | Complexidade |
|--------|------------|--------------|
| Criar schema `ShiftSwapRequest` | 1 dia | Baixa |
| API de solicitação de troca | 2 dias | Média |
| API de aceitar/rejeitar troca | 2 dias | Média |
| Interface "Mural de Trocas" | 3 dias | Média |
| Botão de troca no calendário | 1 dia | Baixa |
| Notificações de troca | 2 dias | Média |
| Testes e validações | 2 dias | Média |
| **TOTAL** | **13 dias** | |

**Resultado esperado:** Sistema completo de trocas funcionando

---

### 👤 Fase 3C: Portal do Fisioterapeuta (2 semanas)

**Prioridade: MÉDIA**

| Tarefa | Estimativa | Complexidade |
|--------|------------|--------------|
| Dashboard pessoal | 3 dias | Média |
| Calendário pessoal filtrado | 2 dias | Baixa |
| Página "Minhas Trocas" | 2 dias | Média |
| Página "Vagas Disponíveis" | 2 dias | Média |
| Sistema de notificações | 3 dias | Alta |
| **TOTAL** | **12 dias** | |

**Resultado esperado:** Fisioterapeutas gerenciam seus plantões

---

### 🎯 Fase 3D: Regras Inteligentes (1-2 semanas)

**Prioridade: BAIXA**

| Tarefa | Estimativa | Complexidade |
|--------|------------|--------------|
| Bloqueio de datas | 2 dias | Média |
| Preferências de horário | 2 dias | Média |
| Distribuição equilibrada | 3 dias | Alta |
| Plantões recorrentes | 3 dias | Alta |
| Validações de limites | 2 dias | Média |
| **TOTAL** | **12 dias** | |

**Resultado esperado:** Sistema inteligente e preventivo

---

### 📱 Fase 3E: Vista Multi-Equipe (1 semana)

**Prioridade: BAIXA**

| Tarefa | Estimativa | Complexidade |
|--------|------------|--------------|
| Layout grid multi-calendário | 3 dias | Média |
| Sincronização entre calendários | 2 dias | Média |
| Filtros e seleção de equipes | 2 dias | Baixa |
| **TOTAL** | **7 dias** | |

---

## 5️⃣ CRONOGRAMA RECOMENDADO

```
Semana 1-2:   Fase 3A - Melhorias Visuais ✨
Semana 3-5:   Fase 3B - Sistema de Trocas 🔄
Semana 6-7:   Fase 3C - Portal do Fisioterapeuta 👤
Semana 8-9:   Fase 3D - Regras Inteligentes 🎯
Semana 10:    Fase 3E - Vista Multi-Equipe 📊
```

**Total estimado: 10 semanas (2,5 meses)**

---

## 6️⃣ DECISÕES NECESSÁRIAS

### ❓ Perguntas para Você

1. **Prioridade:** Qual fase começar primeiro?
   - [x] 3A - Melhorias Visuais (rápido, impacto visual)
   - [ ] 3B - Sistema de Trocas (funcionalidade nova, alto valor)
   - [ ] 3C - Portal do Fisioterapeuta (empoderamento dos usuários)

2. **Sistema de Trocas:** Qual cenário é mais importante?
   - [ ] Troca Direta (entre dois fisioterapeutas específicos)
   - [ ] Troca Aberta (qualquer um pode aceitar)
   - [ ] Ambos

3. **Notificações:** Quais canais implementar?
   - [ ] In-app (toasts/badges)
   - [ ] E-mail
   - [ ] Push notifications (PWA)
   - [ ] WhatsApp (futuro)

4. **Mobile:** Prioridade?
   - [ ] Alta - Muitos usam pelo celular
   - [ ] Média - Desktop é principal
   - [ ] Baixa - Pode esperar

5. **Vista Multi-Equipe:** Necessário?
   - [ ] Sim - Importante ver várias equipes
   - [ ] Não - Uma por vez está bom

---

## 7️⃣ PRÓXIMOS PASSOS

**Recomendação:** Começar pela **Fase 3A (Melhorias Visuais)**

**Motivos:**
- ✅ Rápido (1-2 semanas)
- ✅ Baixo risco (não mexe em regras de negócio)
- ✅ Alto impacto visual
- ✅ Melhora UX imediatamente
- ✅ Prepara terreno para fases seguintes

**Depois:** **Fase 3B (Sistema de Trocas)**
- ✅ Alto valor de negócio
- ✅ Funcionalidade mais pedida
- ✅ Diferencial competitivo

---

## 8️⃣ RESUMO EXECUTIVO

### O que temos hoje:
- ✅ Calendário funcional e robusto
- ✅ Regras de negócio bem implementadas
- ✅ Interface limpa com shadcn/ui

### O que vamos ganhar:
- 🎨 Visual moderno e informativo
- 🔄 Sistema completo de trocas
- 👤 Portal self-service para fisioterapeutas
- 🎯 Regras inteligentes de distribuição
- 📱 Experiência mobile otimizada
- 📊 Vista multi-equipe

### Impacto esperado:
- ⬆️ Satisfação dos fisioterapeutas
- ⬇️ Trabalho manual de gestão
- ⬆️ Autonomia dos usuários
- ⬇️ Erros de alocação
- ⬆️ Eficiência operacional

---

*Documento criado em: 04/03/2026*
*Versão: 1.0*
