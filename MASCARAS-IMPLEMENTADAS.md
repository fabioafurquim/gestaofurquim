# Máscaras de Entrada Implementadas

## Resumo das Funcionalidades

Foram implementadas máscaras de entrada nos formulários de cadastro e edição de fisioterapeutas para melhorar a experiência do usuário e garantir a consistência dos dados.

## Máscaras Implementadas

### 1. Telefone
- **Formato:** `(XX)-XXXXX-XXXX`
- **Exemplo:** `(11)-99999-9999`
- **Aplicação:** Campo "Telefone" nos formulários

### 2. CPF
- **Formato:** `XXX.XXX.XXX-XX`
- **Exemplo:** `123.456.789-00`
- **Aplicação:** Campo "CPF" nos formulários

### 3. CNPJ (para empresas PJ)
- **Formato:** `XX.XXX.XXX/XXXX-XX`
- **Exemplo:** `12.345.678/0001-90`
- **Aplicação:** Campo "CNPJ da Empresa" quando tipo de contrato é PJ

### 4. Valores Monetários
- **Formato:** `R$ X.XXX,XX`
- **Exemplo:** `R$ 1.250,75`
- **Aplicação:** Campos "Valor da Hora" e "Valor Adicional"
- **Funcionalidade:** Formatação automática com centavos durante a digitação

### 5. Validação de Chave PIX
- **Regra:** Quando o tipo PIX é "CPF" ou "CNPJ", apenas números são permitidos
- **Aplicação:** Campo "Chave PIX" nas informações bancárias
- **Comportamento:** Remove automaticamente caracteres não numéricos

## Arquivos Modificados

### Novo Arquivo Criado
- `src/lib/input-masks.ts` - Utilitários para aplicação das máscaras

### Arquivos Atualizados
- `src/app/physiotherapists/new/page.tsx` - Formulário de cadastro
- `src/app/physiotherapists/edit/[id]/page.tsx` - Formulário de edição

## Funcionalidades Técnicas

### Funções Utilitárias (`input-masks.ts`)

1. **`applyPhoneMask(value: string)`** - Aplica máscara de telefone
2. **`applyCpfMask(value: string)`** - Aplica máscara de CPF
3. **`applyCnpjMask(value: string)`** - Aplica máscara de CNPJ
4. **`applyCurrencyMask(value: string)`** - Aplica máscara de moeda
5. **`removeCurrencyMask(value: string)`** - Remove máscara e retorna valor numérico
6. **`validateNumericPixKey(value: string, pixType: string)`** - Valida chave PIX numérica

### Comportamentos Implementados

- **Formatação em Tempo Real:** As máscaras são aplicadas conforme o usuário digita
- **Remoção Automática:** Caracteres inválidos são removidos automaticamente
- **Preservação de Dados:** Os valores são convertidos corretamente para envio à API
- **Carregamento de Dados:** Dados existentes são formatados ao carregar o formulário de edição

## Validações Especiais

### Chave PIX
- **CPF/CNPJ:** Aceita apenas números (máximo 11 para CPF, 14 para CNPJ)
- **Email/Telefone/Chave Aleatória:** Aceita qualquer caractere

### Valores Monetários
- **Entrada:** Aceita apenas números, formatados automaticamente
- **Armazenamento:** Convertidos para formato decimal (float) no banco de dados
- **Exibição:** Formatados com símbolo R$ e separadores de milhares

## Como Usar

1. **Telefone:** Digite apenas números, a máscara será aplicada automaticamente
2. **CPF:** Digite apenas números, pontos e hífen serão adicionados automaticamente
3. **Valores:** Digite apenas números, a formatação de moeda será aplicada
4. **Chave PIX:** Para CPF/CNPJ, digite apenas números; outros tipos aceitam qualquer caractere

## Benefícios

- **UX Melhorada:** Interface mais intuitiva e profissional
- **Consistência:** Dados sempre no formato correto
- **Validação:** Prevenção de erros de entrada
- **Acessibilidade:** Feedback visual imediato para o usuário