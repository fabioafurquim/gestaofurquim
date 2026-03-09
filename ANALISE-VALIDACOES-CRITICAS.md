# Análise de Validações Críticas - Sistema de Gestão de Plantões

## 📋 Problemas Identificados pelo Usuário

### 1. **Histórico de Valores de Plantão** ⚠️ CRÍTICO
**Problema:** Quando alterar o valor do plantão da equipe, o sistema não deve alterar o cálculo dos pagamentos retroativos.

**Impacto:**
- Pagamentos já calculados seriam recalculados com novo valor
- Perda de integridade financeira
- Impossibilidade de auditoria

**Solução:**
- Criar tabela `ShiftTeamPriceHistory` para manter histórico de valores
- Cada alteração de valor gera novo registro com data de vigência
- Cálculos de pagamento usam valor vigente na data do plantão
- Novo valor só vale para plantões futuros (a partir da data de alteração)

---

### 2. **Validação de Redução de Vagas** ⚠️ CRÍTICO
**Problema:** Se tentar diminuir a quantidade de vagas de um turno e já tiver plantões futuros excedendo o novo limite, o sistema deve bloquear.

**Impacto:**
- Inconsistência entre vagas configuradas e plantões existentes
- Impossibilidade de calcular vagas disponíveis corretamente
- Conflitos no calendário

**Solução:**
- Antes de salvar redução de vagas, contar plantões futuros por período
- Validar se quantidade de plantões futuros <= novo limite de vagas
- Retornar erro específico indicando quantos plantões precisam ser removidos
- Sugerir datas/fisioterapeutas que precisam ser realocados

---

## 🔍 Análise de Situações Similares

### 3. **Exclusão de Fisioterapeuta com Plantões Futuros** ⚠️ CRÍTICO
**Problema Potencial:** Excluir fisioterapeuta que tem plantões futuros agendados.

**Impacto:**
- Plantões órfãos no sistema
- Quebra de integridade referencial
- Vagas não liberadas corretamente

**Solução:**
- Validar se fisioterapeuta tem plantões futuros antes de excluir
- Bloquear exclusão se houver plantões futuros
- Permitir apenas inativação (status = INACTIVE)
- Sugerir remoção/realocação dos plantões primeiro

---

### 4. **Remoção de Fisioterapeuta de Equipe com Plantões Futuros** ⚠️ MÉDIO
**Problema Potencial:** Remover fisioterapeuta de uma equipe quando ele tem plantões futuros naquela equipe.

**Impacto:**
- Fisioterapeuta sem vínculo com equipe mas com plantões
- Inconsistência de dados
- Problemas no cálculo de valores

**Solução:**
- Validar plantões futuros na equipe específica antes de remover vínculo
- Bloquear remoção se houver plantões futuros
- Sugerir remoção dos plantões primeiro
- Permitir apenas após limpar plantões futuros

---

### 5. **Exclusão de Equipe com Plantões Futuros** ⚠️ CRÍTICO
**Problema Potencial:** Excluir equipe que tem plantões futuros agendados.

**Impacto:**
- Plantões órfãos sem equipe
- Quebra de integridade referencial
- Perda de dados de pagamento

**Solução:**
- Validar se equipe tem plantões futuros antes de excluir
- Bloquear exclusão se houver plantões futuros
- Sugerir remoção/realocação dos plantões primeiro
- Permitir apenas inativação ou após limpar plantões

---

### 6. **Alteração de Valor Customizado de Fisioterapeuta em Equipe** ⚠️ ALTO
**Problema Potencial:** Similar ao problema #1, mas para valores customizados por fisioterapeuta.

**Impacto:**
- Pagamentos retroativos recalculados incorretamente
- Perda de histórico de valores customizados
- Impossibilidade de auditoria

**Solução:**
- Criar tabela `PhysiotherapistTeamPriceHistory` para histórico de valores customizados
- Cada alteração gera novo registro com data de vigência
- Cálculos usam valor vigente na data do plantão
- Novo valor só vale para plantões futuros

---

### 7. **Alteração de Tipo de Contrato com Pagamentos Pendentes** ⚠️ MÉDIO
**Problema Potencial:** Alterar tipo de contrato (PJ/RPA) de fisioterapeuta com pagamentos pendentes no mês.

**Impacto:**
- Cálculos de descontos incorretos
- Documentos gerados com tipo errado
- Problemas fiscais

**Solução:**
- Validar se há pagamentos pendentes no mês atual antes de alterar tipo
- Alertar usuário sobre impacto
- Sugerir fechar mês atual antes de alterar
- Ou permitir mas recalcular pagamentos pendentes

---

### 8. **Fechamento de Mês com Plantões Futuros no Mês** ⚠️ BAIXO
**Problema Potencial:** Fechar mês de pagamento quando ainda há dias futuros no mês.

**Impacto:**
- Plantões adicionados depois não entram no pagamento
- Necessidade de reabrir mês
- Confusão administrativa

**Solução:**
- Alertar se há dias futuros no mês ao tentar fechar
- Permitir mas com confirmação explícita
- Documentar que novos plantões não entrarão no pagamento
- Sugerir aguardar fim do mês

---

### 9. **Exclusão de Plantão com Solicitação de Troca Pendente** ⚠️ MÉDIO
**Problema Potencial:** Excluir plantão que tem solicitação de troca em andamento.

**Impacto:**
- Solicitações de troca órfãs
- Confusão para fisioterapeutas
- Notificações sobre plantão inexistente

**Solução:**
- Validar se plantão tem trocas pendentes antes de excluir
- Bloquear exclusão ou cancelar trocas automaticamente
- Notificar fisioterapeutas envolvidos
- Cascade delete configurado no schema (já implementado)

---

### 10. **Criação de Plantão Excedendo Vagas Disponíveis** ⚠️ ALTO
**Problema Potencial:** Criar plantão quando já atingiu limite de vagas para aquele período/dia.

**Impacto:**
- Mais plantões do que vagas configuradas
- Cálculo de vagas disponíveis incorreto
- Overbooking de equipe

**Solução:**
- Validar vagas disponíveis antes de criar plantão
- Considerar tipo de dia (útil/fim de semana/feriado)
- Bloquear criação se exceder limite
- Mostrar quantas vagas estão disponíveis

---

## 📊 Priorização de Implementação

### 🔴 CRÍTICO (Implementar Imediatamente)
1. ✅ **Histórico de Valores de Plantão** - Impacto financeiro direto
2. ✅ **Validação de Redução de Vagas** - Integridade de dados
3. ✅ **Exclusão de Fisioterapeuta com Plantões Futuros** - Integridade referencial
4. ✅ **Exclusão de Equipe com Plantões Futuros** - Integridade referencial
5. ✅ **Criação de Plantão Excedendo Vagas** - Overbooking

### 🟡 ALTO (Implementar em Seguida)
6. ✅ **Histórico de Valores Customizados** - Consistência financeira
7. ⚠️ **Remoção de Fisioterapeuta de Equipe** - Integridade de dados

### 🟢 MÉDIO (Implementar Depois)
8. ⚠️ **Alteração de Tipo de Contrato** - Impacto administrativo
9. ⚠️ **Exclusão de Plantão com Troca Pendente** - Já tem cascade delete

### 🔵 BAIXO (Implementar se Necessário)
10. ℹ️ **Fechamento de Mês Antecipado** - Apenas alerta/confirmação

---

## 🗄️ Mudanças no Schema Prisma

### Nova Tabela: ShiftTeamPriceHistory
```prisma
model ShiftTeamPriceHistory {
  id            Int       @id @default(autoincrement())
  shiftTeamId   Int
  shiftValue    Decimal   @db.Decimal(10, 2)
  effectiveFrom DateTime  @default(now()) // Data a partir da qual o valor é válido
  createdAt     DateTime  @default(now())
  createdBy     Int?      // Usuário que fez a alteração
  
  shiftTeam     ShiftTeam @relation(fields: [shiftTeamId], references: [id], onDelete: Cascade)
  user          User?     @relation(fields: [createdBy], references: [id])
  
  @@index([shiftTeamId, effectiveFrom])
}
```

### Nova Tabela: PhysiotherapistTeamPriceHistory
```prisma
model PhysiotherapistTeamPriceHistory {
  id                    Int                 @id @default(autoincrement())
  physiotherapistTeamId Int
  customShiftValue      Decimal             @db.Decimal(10, 2)
  effectiveFrom         DateTime            @default(now())
  createdAt             DateTime            @default(now())
  createdBy             Int?
  
  physiotherapistTeam   PhysiotherapistTeam @relation(fields: [physiotherapistTeamId], references: [id], onDelete: Cascade)
  user                  User?               @relation(fields: [createdBy], references: [id])
  
  @@index([physiotherapistTeamId, effectiveFrom])
}
```

### Atualização: ShiftTeam
```prisma
model ShiftTeam {
  // ... campos existentes
  priceHistory  ShiftTeamPriceHistory[]
}
```

### Atualização: PhysiotherapistTeam
```prisma
model PhysiotherapistTeam {
  // ... campos existentes
  priceHistory  PhysiotherapistTeamPriceHistory[]
}
```

### Atualização: User
```prisma
model User {
  // ... campos existentes
  teamPriceChanges              ShiftTeamPriceHistory[]
  physiotherapistTeamPriceChanges PhysiotherapistTeamPriceHistory[]
}
```

---

## 🔧 APIs que Precisam de Validação

### 1. `/api/teams/[id]` (PUT)
- ✅ Validar redução de vagas vs plantões futuros
- ✅ Criar histórico de valor ao alterar `shiftValue`
- ✅ Validar exclusão (DELETE) com plantões futuros

### 2. `/api/physiotherapists/[id]` (PUT/DELETE)
- ✅ Validar exclusão com plantões futuros
- ✅ Permitir apenas inativação se houver plantões

### 3. `/api/physiotherapists/[id]/teams` (POST/DELETE)
- ✅ Validar remoção de equipe com plantões futuros
- ✅ Criar histórico de valor customizado ao alterar

### 4. `/api/shifts` (POST)
- ✅ Validar vagas disponíveis antes de criar
- ✅ Considerar tipo de dia (útil/fim de semana/feriado)

### 5. `/api/shifts/[id]` (DELETE)
- ✅ Validar trocas pendentes (já tem cascade)

### 6. `/api/payments/calculate`
- ✅ Usar histórico de valores para cálculo correto
- ✅ Buscar valor vigente na data do plantão

---

## 📝 Funções Utilitárias Necessárias

### 1. `getShiftValueForDate(shiftTeamId, date)`
Retorna o valor do plantão vigente na data especificada.

### 2. `getCustomShiftValueForDate(physiotherapistTeamId, date)`
Retorna o valor customizado vigente na data especificada.

### 3. `validateSlotReduction(shiftTeamId, period, newSlots, dayType)`
Valida se redução de vagas é possível considerando plantões futuros.

### 4. `countFutureShifts(physiotherapistId, shiftTeamId?)`
Conta plantões futuros de um fisioterapeuta (opcionalmente filtrado por equipe).

### 5. `getAvailableSlots(shiftTeamId, date, period)`
Calcula vagas disponíveis considerando tipo de dia e plantões existentes.

---

## ✅ Checklist de Implementação

### Fase 1: Schema e Migrations
- [ ] Criar modelo `ShiftTeamPriceHistory`
- [ ] Criar modelo `PhysiotherapistTeamPriceHistory`
- [ ] Atualizar relações em `ShiftTeam`, `PhysiotherapistTeam`, `User`
- [ ] Gerar migration
- [ ] Popular histórico com valores atuais (data retroativa)

### Fase 2: Funções Utilitárias
- [ ] Implementar `getShiftValueForDate`
- [ ] Implementar `getCustomShiftValueForDate`
- [ ] Implementar `validateSlotReduction`
- [ ] Implementar `countFutureShifts`
- [ ] Implementar `getAvailableSlots`

### Fase 3: Validações em APIs
- [ ] Atualizar `/api/teams/[id]` (PUT) - validar vagas e criar histórico
- [ ] Atualizar `/api/teams/[id]` (DELETE) - validar plantões futuros
- [ ] Atualizar `/api/physiotherapists/[id]` (DELETE) - validar plantões futuros
- [ ] Atualizar `/api/physiotherapists/[id]/teams` - validar e criar histórico
- [ ] Atualizar `/api/shifts` (POST) - validar vagas disponíveis
- [ ] Atualizar `/api/payments/calculate` - usar histórico de valores

### Fase 4: Testes
- [ ] Testar alteração de valor de equipe
- [ ] Testar redução de vagas com plantões futuros
- [ ] Testar exclusão de fisioterapeuta com plantões
- [ ] Testar criação de plantão excedendo vagas
- [ ] Testar cálculo de pagamento com histórico

### Fase 5: Documentação
- [ ] Documentar novas validações
- [ ] Atualizar README com regras de negócio
- [ ] Criar guia de troubleshooting

---

## 🎯 Benefícios da Implementação

1. **Integridade Financeira:** Pagamentos sempre calculados com valores corretos
2. **Auditoria Completa:** Histórico de todas as alterações de valores
3. **Prevenção de Erros:** Validações impedem inconsistências
4. **Melhor UX:** Mensagens claras sobre o que precisa ser corrigido
5. **Conformidade:** Sistema mais robusto e confiável
6. **Manutenibilidade:** Código mais organizado e previsível

---

**Data da Análise:** 09/03/2026  
**Status:** Pronto para Implementação  
**Prioridade:** CRÍTICA
