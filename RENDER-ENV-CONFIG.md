# Configuração de Variáveis de Ambiente no Render

## Variáveis Obrigatórias

Para que a aplicação funcione corretamente no Render, você deve configurar as seguintes variáveis de ambiente no painel do Render:

### 1. DATABASE_URL
**Descrição:** URL de conexão com pooling para operações normais da aplicação
**Formato:** `postgresql://postgres:SENHA@HOST:6543/postgres?pgbouncer=true&connection_limit=1`
**Exemplo:** `postgresql://postgres:x0MVmRRfaM768OQ0@db.cuqazmbznwwzpasquexe.supabase.co:6543/postgres?pgbouncer=true&connection_limit=1`

### 2. DIRECT_URL
**Descrição:** URL de conexão direta (sem pooling) para migrações do Prisma
**Formato:** `postgresql://postgres:SENHA@HOST:5432/postgres`
**Exemplo:** `postgresql://postgres:x0MVmRRfaM768OQ0@db.cuqazmbznwwzpasquexe.supabase.co:5432/postgres`

### 3. NEXTAUTH_URL (Gerada automaticamente)
**Descrição:** URL base da aplicação para NextAuth
**Valor:** Será gerada automaticamente pelo Render

### 4. NEXTAUTH_SECRET (Gerada automaticamente)
**Descrição:** Chave secreta para NextAuth
**Valor:** Será gerada automaticamente pelo Render

## Como Configurar no Render

1. Acesse o painel do Render (https://dashboard.render.com)
2. Selecione seu serviço `plantaofisio-app`
3. Vá para a aba **Environment**
4. Adicione as variáveis `DATABASE_URL` e `DIRECT_URL` com os valores do seu banco Supabase
5. Salve as configurações
6. O Render fará o redeploy automaticamente

## Diferença entre DATABASE_URL e DIRECT_URL

- **DATABASE_URL (Porta 6543):** Usa connection pooling do Supabase, ideal para operações da aplicação
- **DIRECT_URL (Porta 5432):** Conexão direta ao PostgreSQL, necessária para migrações do Prisma

## Verificação

Após configurar as variáveis:
1. Monitore os logs de deploy no Render
2. Verifique se as migrações são executadas com sucesso
3. Teste o acesso à rota `/api/auth/setup` para confirmar que as tabelas foram criadas

## Troubleshooting

### Erro: "Environment variable not found: DIRECT_URL"
- Verifique se a variável `DIRECT_URL` foi adicionada no painel do Render
- Confirme que o valor está correto (porta 5432, sem parâmetros de pooling)

### Erro: "Can't reach database server"
- Verifique as credenciais do Supabase
- Confirme que o IP do Render está na whitelist do Supabase (se aplicável)
- Teste a conectividade usando a URL direta