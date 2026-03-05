# 🔮 FASES 3D e 3E: Funcionalidades Futuras

## 📋 Visão Geral

Estas são as próximas fases do sistema de calendário de plantões, focadas em **inteligência** e **visualização avançada**.

---

# 🎯 FASE 3D: Regras Inteligentes

## 📊 Status: **NÃO INICIADA (0%)**
**Prioridade:** MÉDIA  
**Tempo Estimado:** 1-2 semanas (12 dias)  
**Complexidade:** MÉDIA-ALTA

---

## 🎯 Objetivo

Transformar o sistema de plantões em uma ferramenta **inteligente e preventiva**, que:
- Sugere automaticamente os melhores fisioterapeutas
- Previne erros de alocação
- Distribui carga de trabalho de forma equilibrada
- Respeita preferências e restrições individuais

---

## 📦 Funcionalidades Detalhadas

### **D1. Bloqueio de Datas (Férias/Compromissos)**
**Tempo:** 2 dias | **Complexidade:** Média

#### **Schema Prisma:**
```prisma
model PhysiotherapistBlockedDate {
  id                Int             @id @default(autoincrement())
  physiotherapistId Int
  startDate         DateTime        @db.Date
  endDate           DateTime        @db.Date
  reason            String?         // "Férias", "Compromisso pessoal", etc.
  type              BlockType       @default(FULL_DAY)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  physiotherapist   Physiotherapist @relation(fields: [physiotherapistId], references: [id], onDelete: Cascade)
}

enum BlockType {
  FULL_DAY          // Dia inteiro bloqueado
  MORNING           // Apenas manhã
  AFTERNOON         // Apenas tarde
  NIGHT             // Apenas noite
}
```

#### **Funcionalidades:**
- ✅ Fisioterapeuta marca datas indisponíveis
- ✅ Sistema impede alocação automática nessas datas
- ✅ Alerta visual no calendário (dia com ícone 🚫)
- ✅ ADMIN pode sobrescrever bloqueio (com confirmação)
- ✅ Histórico de bloqueios

#### **Interface:**
```tsx
// Página: /physiotherapists/[id]/blocked-dates
<Calendar
  onSelectRange={(start, end) => {
    setBlockedRange({ start, end });
    setShowBlockModal(true);
  }}
  blockedDates={blockedDates}
  highlightBlocked={true}
/>

<Dialog>
  <DialogTitle>Bloquear Datas</DialogTitle>
  <Select label="Tipo">
    <option value="FULL_DAY">Dia Inteiro</option>
    <option value="MORNING">Apenas Manhã</option>
    <option value="AFTERNOON">Apenas Tarde</option>
    <option value="NIGHT">Apenas Noite</option>
  </Select>
  <Input label="Motivo" placeholder="Ex: Férias, Consulta médica" />
  <Button>Bloquear</Button>
</Dialog>
```

#### **Validação na Criação de Plantão:**
```typescript
// src/app/api/shifts/route.ts
const blockedDate = await prisma.physiotherapistBlockedDate.findFirst({
  where: {
    physiotherapistId: data.physiotherapistId,
    startDate: { lte: data.date },
    endDate: { gte: data.date },
    OR: [
      { type: 'FULL_DAY' },
      { type: data.period } // Se for bloqueio parcial
    ]
  }
});

if (blockedDate) {
  return NextResponse.json({
    error: `Fisioterapeuta indisponível nesta data (${blockedDate.reason})`
  }, { status: 400 });
}
```

---

### **D2. Preferências de Horário**
**Tempo:** 2 dias | **Complexidade:** Média

#### **Schema Prisma:**
```prisma
model PhysiotherapistPreference {
  id                Int             @id @default(autoincrement())
  physiotherapistId Int             @unique
  preferredPeriods  ShiftPeriod[]   // ["MORNING", "AFTERNOON"]
  avoidPeriods      ShiftPeriod[]   // ["NIGHT"]
  maxShiftsPerWeek  Int?            @default(5)
  maxShiftsPerMonth Int?            @default(20)
  preferredTeams    Int[]           // IDs das equipes preferidas
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  physiotherapist   Physiotherapist @relation(fields: [physiotherapistId], references: [id], onDelete: Cascade)
}
```

#### **Funcionalidades:**
- ✅ Fisioterapeuta define períodos preferidos
- ✅ Sistema sugere fisioterapeutas compatíveis ao criar plantão
- ✅ Alerta se alocar em período não preferido
- ✅ Limite de plantões por semana/mês
- ✅ Dashboard mostra % de plantões em períodos preferidos

#### **Interface de Sugestão:**
```tsx
// Ao criar plantão, mostrar lista ordenada
<Select label="Fisioterapeuta">
  <optgroup label="✅ Preferência Alta">
    <option>João Silva (Prefere Manhã) - 8 plantões este mês</option>
  </optgroup>
  <optgroup label="⚠️ Preferência Média">
    <option>Maria Santos (Neutro) - 12 plantões este mês</option>
  </optgroup>
  <optgroup label="❌ Evita Este Período">
    <option>Pedro Costa (Evita Manhã) - 15 plantões este mês</option>
  </optgroup>
</Select>
```

---

### **D3. Distribuição Equilibrada**
**Tempo:** 3 dias | **Complexidade:** Alta

#### **Algoritmo de Sugestão:**
```typescript
// src/lib/shift-suggestions.ts
export async function suggestPhysiotherapists(params: {
  date: Date;
  period: ShiftPeriod;
  teamId: number;
}) {
  const { date, period, teamId } = params;
  
  // 1. Buscar fisioterapeutas da equipe
  const physios = await getTeamPhysiotherapists(teamId);
  
  // 2. Calcular score para cada um
  const scored = await Promise.all(physios.map(async (physio) => {
    let score = 100;
    
    // Penalizar se já tem muitos plantões no mês
    const monthShifts = await getMonthShiftsCount(physio.id, date);
    score -= monthShifts * 2;
    
    // Bonificar se tem poucos plantões
    if (monthShifts < 10) score += 20;
    
    // Bonificar se período é preferido
    const prefs = await getPreferences(physio.id);
    if (prefs?.preferredPeriods.includes(period)) score += 30;
    if (prefs?.avoidPeriods.includes(period)) score -= 40;
    
    // Penalizar se está bloqueado
    const blocked = await isBlocked(physio.id, date, period);
    if (blocked) score = -1000;
    
    // Penalizar se já trabalhou ontem (evitar dias consecutivos)
    const workedYesterday = await workedOnDate(physio.id, subDays(date, 1));
    if (workedYesterday) score -= 15;
    
    return { physio, score, monthShifts };
  }));
  
  // 3. Ordenar por score (maior = melhor)
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);
}
```

#### **Interface:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Sugestões Inteligentes</CardTitle>
  </CardHeader>
  <CardContent>
    {suggestions.map((s, i) => (
      <div key={s.physio.id} className={`p-3 rounded ${i === 0 ? 'bg-green-50 border-green-300' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{s.physio.name}</p>
            <p className="text-sm text-gray-600">
              {s.monthShifts} plantões este mês
              {s.score > 80 && ' • ⭐ Melhor opção'}
            </p>
          </div>
          <Button size="sm" onClick={() => selectPhysio(s.physio.id)}>
            Selecionar
          </Button>
        </div>
      </div>
    ))}
  </CardContent>
</Card>
```

---

### **D4. Plantões Recorrentes**
**Tempo:** 3 dias | **Complexidade:** Alta

#### **Schema Prisma:**
```prisma
model RecurringShiftPattern {
  id                Int             @id @default(autoincrement())
  physiotherapistId Int
  shiftTeamId       Int
  dayOfWeek         Int             // 0 = Domingo, 1 = Segunda, etc.
  period            ShiftPeriod
  startDate         DateTime        @db.Date
  endDate           DateTime?       @db.Date // null = indefinido
  active            Boolean         @default(true)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  physiotherapist   Physiotherapist @relation(fields: [physiotherapistId], references: [id], onDelete: Cascade)
  shiftTeam         ShiftTeam       @relation(fields: [shiftTeamId], references: [id], onDelete: Cascade)
}
```

#### **Funcionalidades:**
- ✅ Criar padrão: "Toda segunda-feira - Manhã - Equipe A"
- ✅ Sistema gera plantões automaticamente para o mês
- ✅ Pode pausar/reativar padrão
- ✅ Pode definir data de término
- ✅ Respeita bloqueios e feriados

#### **Geração Automática:**
```typescript
// Cron job ou botão manual
export async function generateRecurringShifts(month: Date) {
  const patterns = await prisma.recurringShiftPattern.findMany({
    where: { active: true }
  });
  
  for (const pattern of patterns) {
    const daysInMonth = getDaysInMonth(month);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      
      // Verificar se é o dia da semana correto
      if (date.getDay() !== pattern.dayOfWeek) continue;
      
      // Verificar se já existe plantão
      const exists = await prisma.shift.findFirst({
        where: {
          date,
          period: pattern.period,
          physiotherapistId: pattern.physiotherapistId
        }
      });
      
      if (exists) continue;
      
      // Criar plantão
      await prisma.shift.create({
        data: {
          date,
          period: pattern.period,
          physiotherapistId: pattern.physiotherapistId,
          shiftTeamId: pattern.shiftTeamId
        }
      });
    }
  }
}
```

---

### **D5. Validações de Limites**
**Tempo:** 2 dias | **Complexidade:** Média

#### **Regras Implementadas:**
```typescript
// 1. Máximo de plantões consecutivos
const MAX_CONSECUTIVE_DAYS = 5;

async function validateConsecutiveDays(physioId: number, date: Date) {
  const consecutiveDays = await getConsecutiveDaysCount(physioId, date);
  if (consecutiveDays >= MAX_CONSECUTIVE_DAYS) {
    throw new Error(`Limite de ${MAX_CONSECUTIVE_DAYS} dias consecutivos atingido`);
  }
}

// 2. Tempo mínimo entre plantões
const MIN_HOURS_BETWEEN_SHIFTS = 12;

async function validateTimeBetweenShifts(physioId: number, date: Date, period: ShiftPeriod) {
  const lastShift = await getLastShift(physioId, date);
  if (!lastShift) return;
  
  const hoursBetween = calculateHoursBetween(lastShift, { date, period });
  if (hoursBetween < MIN_HOURS_BETWEEN_SHIFTS) {
    throw new Error(`Mínimo de ${MIN_HOURS_BETWEEN_SHIFTS}h entre plantões`);
  }
}

// 3. Máximo de plantões por semana
async function validateWeeklyLimit(physioId: number, date: Date) {
  const prefs = await getPreferences(physioId);
  if (!prefs?.maxShiftsPerWeek) return;
  
  const weekShifts = await getWeekShiftsCount(physioId, date);
  if (weekShifts >= prefs.maxShiftsPerWeek) {
    throw new Error(`Limite de ${prefs.maxShiftsPerWeek} plantões por semana atingido`);
  }
}
```

---

## 📊 Resumo Fase 3D

| Funcionalidade | Tempo | Complexidade | Valor de Negócio |
|----------------|-------|--------------|------------------|
| D1. Bloqueio de Datas | 2 dias | Média | ⭐⭐⭐⭐⭐ Alto |
| D2. Preferências | 2 dias | Média | ⭐⭐⭐⭐ Médio-Alto |
| D3. Distribuição Equilibrada | 3 dias | Alta | ⭐⭐⭐⭐⭐ Alto |
| D4. Plantões Recorrentes | 3 dias | Alta | ⭐⭐⭐⭐ Médio-Alto |
| D5. Validações de Limites | 2 dias | Média | ⭐⭐⭐ Médio |
| **TOTAL** | **12 dias** | | |

---

# 📊 FASE 3E: Vista Multi-Equipe

## 📊 Status: **NÃO INICIADA (0%)**
**Prioridade:** BAIXA  
**Tempo Estimado:** 1 semana (7 dias)  
**Complexidade:** MÉDIA

---

## 🎯 Objetivo

Permitir que gestores visualizem **múltiplas equipes simultaneamente**, facilitando:
- Comparação de carga de trabalho entre equipes
- Identificação rápida de vagas em todas as equipes
- Planejamento estratégico multi-equipe

---

## 📦 Funcionalidades Detalhadas

### **E1. Layout Grid Multi-Calendário**
**Tempo:** 3 dias | **Complexidade:** Média

#### **Interface:**
```tsx
// Página: /shifts (com toggle multi-equipe)
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <h1>Calendário de Plantões</h1>
    <Switch
      checked={multiTeamView}
      onCheckedChange={setMultiTeamView}
      label="Vista Multi-Equipe"
    />
  </div>
  
  {multiTeamView ? (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {selectedTeams.map(team => (
        <Card key={team.id}>
          <CardHeader>
            <CardTitle className="text-sm">{team.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniCalendar
              teamId={team.id}
              height={400}
              compact={true}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  ) : (
    <FullCalendar {...standardProps} />
  )}
</div>
```

#### **Componente MiniCalendar:**
```tsx
export function MiniCalendar({ teamId, height, compact }: Props) {
  return (
    <FullCalendar
      plugins={[dayGridPlugin]}
      initialView="dayGridMonth"
      height={height}
      headerToolbar={{
        left: 'prev',
        center: 'title',
        right: 'next'
      }}
      events={teamEvents}
      eventDisplay="block"
      dayMaxEvents={compact ? 2 : 4}
      moreLinkText={(n) => `+${n}`}
    />
  );
}
```

---

### **E2. Sincronização Entre Calendários**
**Tempo:** 2 dias | **Complexidade:** Média

#### **Funcionalidades:**
- ✅ Todos os calendários navegam para o mesmo mês
- ✅ Hover em um evento destaca eventos relacionados em outros calendários
- ✅ Clique em evento abre modal unificado
- ✅ Drag & drop entre calendários (mover fisio de equipe)

#### **Implementação:**
```typescript
const [currentMonth, setCurrentMonth] = useState(new Date());

// Sincronizar todos os calendários
useEffect(() => {
  calendarRefs.forEach(ref => {
    ref.current?.getApi().gotoDate(currentMonth);
  });
}, [currentMonth]);

// Destacar eventos relacionados
const handleEventHover = (eventId: string) => {
  setHighlightedEvent(eventId);
  // CSS: .highlighted { ring-2 ring-blue-500 }
};
```

---

### **E3. Filtros e Seleção de Equipes**
**Tempo:** 2 dias | **Complexidade:** Baixa

#### **Interface:**
```tsx
<MultiSelect
  label="Selecionar Equipes"
  options={allTeams}
  value={selectedTeams}
  onChange={setSelectedTeams}
  max={6} // Máximo 6 equipes simultâneas
/>

<div className="flex gap-2 flex-wrap">
  {selectedTeams.map(team => (
    <Badge key={team.id} variant="secondary">
      {team.name}
      <button onClick={() => removeTeam(team.id)}>×</button>
    </Badge>
  ))}
</div>
```

---

## 📊 Resumo Fase 3E

| Funcionalidade | Tempo | Complexidade | Valor de Negócio |
|----------------|-------|--------------|------------------|
| E1. Layout Grid | 3 dias | Média | ⭐⭐⭐ Médio |
| E2. Sincronização | 2 dias | Média | ⭐⭐ Baixo-Médio |
| E3. Filtros | 2 dias | Baixa | ⭐⭐⭐ Médio |
| **TOTAL** | **7 dias** | | |

---

## 🎯 Priorização Recomendada

### **Ordem de Implementação:**

1. **FASE 3D (12 dias)** - ALTA PRIORIDADE
   - D1. Bloqueio de Datas (2 dias) ⭐⭐⭐⭐⭐
   - D3. Distribuição Equilibrada (3 dias) ⭐⭐⭐⭐⭐
   - D2. Preferências (2 dias) ⭐⭐⭐⭐
   - D4. Plantões Recorrentes (3 dias) ⭐⭐⭐⭐
   - D5. Validações (2 dias) ⭐⭐⭐

2. **FASE 3E (7 dias)** - BAIXA PRIORIDADE
   - Apenas se houver demanda real dos gestores

---

## 💡 Recomendação Final

**Implementar Fase 3D primeiro**, pois:
- ✅ Maior valor de negócio
- ✅ Resolve problemas reais (bloqueios, distribuição)
- ✅ Reduz trabalho manual de gestão
- ✅ Melhora satisfação dos fisioterapeutas

**Fase 3E pode esperar**, pois:
- ⚠️ Funcionalidade atual (filtro por equipe) já atende bem
- ⚠️ Complexidade visual pode confundir usuários
- ⚠️ Poucos gestores precisam ver múltiplas equipes simultaneamente

---

**Documento criado em:** 05/03/2026  
**Versão:** 1.0  
**Status:** Planejamento Completo
