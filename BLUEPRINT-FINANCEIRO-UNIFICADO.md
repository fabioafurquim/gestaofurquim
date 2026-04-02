# Blueprint Financeiro Unificado

## Objetivo
Consolidar o módulo financeiro em um único fluxo de fechamento mensal, com cálculo oficial por plantão, conferência manual auditável, documentação centralizada no Google Drive, integração bancária com Banco Inter e envio automático de comprovantes por e-mail.

## Princípios
- `payment-calculator.ts` é a fonte oficial de cálculo.
- O fechamento mensal deve nascer de snapshot, não de edição manual zerada.
- Ajustes manuais não substituem o cálculo base; entram como lançamentos auditáveis.
- Documentos financeiros devem ir direto para o Google Drive, com metadados persistidos no banco.
- O comprovante de pagamento deve vir preferencialmente da API do Banco Inter.
- CNAB permanece como fallback controlado, encapsulado em provider.

## Modelo alvo

### FinancialClosing
- Competência mensal única.
- Status do fechamento.
- Totais consolidados de bruto, ajustes e líquido.

### FinancialClosingLine
- Uma linha por fisioterapeuta na competência.
- Snapshot do cálculo por equipe e por plantão.
- Dados PIX e contratuais congelados no momento do fechamento.
- Valor bruto calculado, ajustes e valor líquido final.

### FinancialAdjustment
- Ajuste manual auditável.
- Tipo, valor, motivo, observação, autor e data.

### FinancialDocument
- Documento financeiro genérico.
- Tipos: `RPA`, `INVOICE`, `PIX_RECEIPT`, `BANK_BATCH`, `BANK_RETURN`, `EMAIL_RECEIPT`.
- Armazena `fileId`, nome, pasta, link, hash e payload parseado.

### PaymentBatch / PaymentBatchItem
- Lote bancário gerado a partir de linhas aprovadas.
- Provider bancário, payload, hash, status e comprovantes sincronizados.

### FinancialAuditEvent
- Trilha de eventos do fechamento, linha, lote e documentação.

## Fluxo operacional
1. Gerar competência mensal a partir dos plantões confirmados.
2. Revisar linhas por fisioterapeuta, setor e geral.
3. Aplicar ajustes auditáveis quando necessário.
4. Anexar RPA ou nota fiscal conforme o tipo de contrato.
5. Validar pendências documentais.
6. Aprovar linhas para pagamento.
7. Gerar lote bancário via provider do Banco Inter.
8. Sincronizar comprovantes automaticamente pela API do banco.
9. Arquivar comprovantes, RPAs e notas no Google Drive por fisioterapeuta e competência.
10. Enviar e-mail com comprovante e documentação final.

## Estrutura de pastas no Google Drive
- `Financeiro Fisioterapeutas`
- `Financeiro Fisioterapeutas/<Nome do Fisioterapeuta>/Documentos Financeiros/<AAAA>/<AAAA-MM>/RPA`
- `Financeiro Fisioterapeutas/<Nome do Fisioterapeuta>/Documentos Financeiros/<AAAA>/<AAAA-MM>/Notas Fiscais`
- `Financeiro Fisioterapeutas/<Nome do Fisioterapeuta>/Documentos Financeiros/<AAAA>/<AAAA-MM>/Comprovantes PIX`
- `Financeiro Fisioterapeutas/<Nome do Fisioterapeuta>/Documentos Financeiros/<AAAA>/<AAAA-MM>/Recibos de E-mail`

## Fases de implementação

### Fase 1
- Criar schema do fechamento unificado.
- Gerar snapshot mensal oficial.
- Expor APIs de consulta, ajuste e relatório por competência.

### Fase 2
- Criar módulo documental novo no Drive.
- Persistir RPA/NF/comprovantes como documentos financeiros.
- Registrar parser de RPA como sugestão validável.

### Fase 3
- Introduzir adapter do Banco Inter.
- Gerar lote bancário pelo novo fluxo.
- Sincronizar comprovantes automaticamente pela API do banco.

### Fase 4
- Enviar comprovantes por e-mail a partir do fechamento e dos documentos oficiais.
- Preparar coexistência e desativação gradual dos fluxos legados.

## Regras importantes
- Não gerar lote bancário a partir de valor vindo do frontend.
- Não usar path local como verdade documental.
- Não considerar `PAID` como sinônimo de `APPROVED`.
- Não fechar competência sem snapshot e trilha de auditoria.
