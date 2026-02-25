# Teste da Máscara de Moeda Corrigida

## Problema Identificado
A máscara de moeda estava adicionando zeros desnecessários à esquerda após digitar os dois primeiros números, causando formatação incorreta.

## Solução Implementada
Substituí a lógica manual de formatação por `toLocaleString('pt-BR')` que:

1. **Remove caracteres não numéricos** do input
2. **Converte para número inteiro** (centavos)
3. **Divide por 100** para obter o valor em reais
4. **Formata automaticamente** usando padrão brasileiro

## Como Funciona Agora

### Entrada do Usuário → Resultado
- `1` → `R$ 0,01`
- `12` → `R$ 0,12`
- `123` → `R$ 1,23`
- `1234` → `R$ 12,34`
- `12345` → `R$ 123,45`
- `123456` → `R$ 1.234,56`

## Código da Função Corrigida

```typescript
export const applyCurrencyMask = (value: string): string => {
  // Remove todos os caracteres não numéricos
  let numbers = value.replace(/\D/g, '');
  
  // Se não há números, retorna vazio
  if (!numbers) return '';
  
  // Converte para centavos
  const numValue = parseInt(numbers);
  
  // Formata como moeda (divide por 100 para obter reais.centavos)
  const formatted = (numValue / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return formatted;
};
```

## Benefícios da Nova Implementação

1. **Formatação Natural**: Segue o padrão brasileiro automaticamente
2. **Sem Zeros Desnecessários**: Não adiciona zeros à esquerda
3. **Separadores Corretos**: Usa ponto para milhares e vírgula para decimais
4. **Símbolo de Moeda**: Inclui "R$" automaticamente
5. **Mais Robusta**: Usa API nativa do JavaScript para formatação

## Arquivos Modificados

- `src/lib/input-masks.ts` - Função `applyCurrencyMask` corrigida
- `src/app/physiotherapists/new/page.tsx` - Usa a máscara nos campos de valor
- `src/app/physiotherapists/edit/[id]/page.tsx` - Usa a máscara nos campos de valor

## Teste Manual

Para testar:
1. Acesse `/physiotherapists/new`
2. Digite números nos campos "Valor da Hora" e "Valor Adicional"
3. Observe a formatação automática em tempo real