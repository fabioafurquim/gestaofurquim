# 🚀 Guia de Migração para Supabase

Este guia explica como migrar o banco de dados da aplicação PlantãoFisio para o Supabase.

## 📋 Pré-requisitos

### 1. Conta no Supabase
- Acesse [supabase.com](https://supabase.com)
- Crie uma conta gratuita
- Crie um novo projeto

### 2. Obter Credenciais do Banco

1. **Acesse o Dashboard do Supabase**
   - Vá para [supabase.com/dashboard](https://supabase.com/dashboard)
   - Selecione seu projeto

2. **Obter String de Conexão**
   - Vá em `Settings` > `Database`
   - Na seção "Connection string", copie a URL
   - Anote a senha do banco (definida na criação do projeto)

3. **Informações Necessárias**
   - **Host**: `db.SEU_PROJETO.supabase.co`
   - **Senha**: A senha definida na criação do projeto
   - **Porta 6543**: Para conexões com pooling (aplicação)
   - **Porta 5432**: Para conexões diretas (migrações)

## 🔧 Configuração Local

### Passo 1: Configurar Variáveis de Ambiente

1. **Copie o arquivo de exemplo**
   ```bash
   cp .env.example .env
   ```

2. **Edite o arquivo `.env`**
   ```env
   # Substitua pelos seus dados do Supabase
   DATABASE_URL="postgresql://postgres:SUA_SENHA@db.SEU_PROJETO.supabase.co:6543/postgres?pgbouncer=true&connection_limit=1"
   DIRECT_URL="postgresql://postgres:SUA_SENHA@db.SEU_PROJETO.supabase.co:5432/postgres"
   
   # NextAuth (opcional para desenvolvimento)
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="seu-secret-super-seguro-aqui"
   ```

### Passo 2: Executar Migração

**Opção 1: Script Automatizado (Recomendado)**
```bash
npm run db:migrate-supabase
```

**Opção 2: Comandos Manuais**
```bash
# Gerar cliente Prisma
npm run db:generate

# Executar migrações
npm run db:migrate
```

### Passo 3: Verificar Migração

1. **Verificar no Dashboard do Supabase**
   - Vá em `Database` > `Tables`
   - Confirme que as tabelas foram criadas:
     - `Physiotherapist`
     - `ShiftTeam`
     - `Shift`
     - `User`
     - `_prisma_migrations`

2. **Testar Localmente**
   ```bash
   npm run dev
   ```
   - Acesse `http://localhost:3000`
   - Teste as funcionalidades básicas

## 🚀 Deploy para Produção

### Render.com (Recomendado)

1. **Configurar Variáveis no Render**
   - Acesse [dashboard.render.com](https://dashboard.render.com)
   - Selecione seu serviço
   - Vá em `Environment`
   - Adicione as variáveis:
     ```
     DATABASE_URL=postgresql://postgres:SUA_SENHA@db.SEU_PROJETO.supabase.co:6543/postgres?pgbouncer=true&connection_limit=1
     DIRECT_URL=postgresql://postgres:SUA_SENHA@db.SEU_PROJETO.supabase.co:5432/postgres
     ```

2. **Deploy Automático**
   - O Render executará automaticamente:
     - `npm install`
     - `npm run migrate:production`
     - `npm run build:production`
     - `npm run start:production`

### Vercel (Alternativa)

1. **Configurar Variáveis no Vercel**
   ```bash
   vercel env add DATABASE_URL
   vercel env add DIRECT_URL
   ```

2. **Deploy**
   ```bash
   vercel --prod
   ```

## 📊 Schema do Banco

O schema atual inclui:

### Tabelas Principais
- **Physiotherapist**: Dados dos fisioterapeutas
- **ShiftTeam**: Equipes de plantão
- **Shift**: Plantões individuais
- **User**: Usuários do sistema

### Campos Importantes
- **Physiotherapist**: Inclui campos bancários e dados PJ
- **User**: Sistema de autenticação com roles
- **Shift**: Relacionamento entre fisioterapeuta e equipe

## 🔍 Troubleshooting

### Erro: "Can't reach database server"
- ✅ Verifique se as credenciais estão corretas
- ✅ Confirme se o projeto Supabase está ativo (não pausado)
- ✅ Teste a conexão no Dashboard do Supabase

### Erro: "Environment variable not found"
- ✅ Verifique se o arquivo `.env` existe
- ✅ Confirme se as variáveis estão definidas corretamente
- ✅ Reinicie o servidor de desenvolvimento

### Erro de Migração
- ✅ Use `DIRECT_URL` (porta 5432) para migrações
- ✅ Use `DATABASE_URL` (porta 6543) para a aplicação
- ✅ Verifique se não há conflitos de schema

### Projeto Supabase Pausado
- ✅ Acesse o Dashboard do Supabase
- ✅ Clique em "Restore" ou "Unpause"
- ✅ Aguarde alguns minutos para ativação

## 📚 Recursos Úteis

- [Documentação do Supabase](https://supabase.com/docs)
- [Documentação do Prisma](https://www.prisma.io/docs)
- [Guia de Deploy no Render](./DEPLOY-PRODUCTION.md)
- [Configuração de Variáveis](./RENDER-ENV-CONFIG.md)

## 🎯 Próximos Passos

Após a migração bem-sucedida:

1. **Configurar Backup Automático**
   - O Supabase faz backups automáticos
   - Configure alertas de monitoramento

2. **Otimizar Performance**
   - Configure índices necessários
   - Monitore queries lentas

3. **Segurança**
   - Configure Row Level Security (RLS)
   - Revise permissões de acesso

4. **Monitoramento**
   - Configure alertas de uptime
   - Monitore uso de recursos

---

✅ **Migração concluída com sucesso!** 🎉