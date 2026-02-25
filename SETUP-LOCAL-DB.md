# Configuração do Banco de Dados Local

## Problema Identificado

O sistema estava tentando conectar com o banco Supabase mesmo após o reset, causando problemas de login e redirecionamento.

## Solução: PostgreSQL Local com Docker

### 1. Instalar Docker Desktop

Baixe e instale o Docker Desktop para Windows:
- https://www.docker.com/products/docker-desktop/

### 2. Iniciar o Banco PostgreSQL

```bash
# Iniciar o PostgreSQL em container Docker
docker-compose up -d postgres

# Verificar se está rodando
docker ps
```

### 3. Configurar a Aplicação

O arquivo `.env` já está configurado para usar o banco local:
```
DATABASE_URL="postgresql://postgres:Fmm20615@localhost:5432/plantaofisio"
```

### 4. Executar Migrações

```bash
# Aplicar migrações
npx prisma migrate deploy

# Ou resetar o banco (apaga todos os dados)
npx prisma migrate reset --force

# Gerar cliente Prisma
npx prisma generate
```

### 5. Iniciar a Aplicação

```bash
npm run dev
```

### 6. Primeiro Acesso

Com o banco limpo, a aplicação deve redirecionar automaticamente para `/setup` onde você pode:
- Criar o primeiro usuário administrador
- Configurar as equipes iniciais
- Definir os fisioterapeutas

## Comandos Úteis

```bash
# Parar o banco
docker-compose down

# Ver logs do banco
docker-compose logs postgres

# Acessar o banco via linha de comando
docker exec -it plantaofisio-postgres psql -U postgres -d plantaofisio

# Backup do banco
docker exec plantaofisio-postgres pg_dump -U postgres plantaofisio > backup.sql
```

## pgAdmin (Opcional)

Se quiser uma interface gráfica para gerenciar o banco:

```bash
# Iniciar pgAdmin junto com o PostgreSQL
docker-compose up -d

# Acessar: http://localhost:8080
# Email: admin@plantaofisio.com
# Senha: admin123
```

## Troubleshooting

### Erro de Conexão
- Verifique se o Docker está rodando
- Confirme que a porta 5432 não está sendo usada por outro serviço
- Execute `docker-compose logs postgres` para ver erros

### Erro de Permissão no Prisma
- Pare a aplicação Next.js
- Execute `npx prisma generate`
- Reinicie a aplicação

### Banco não Reseta
- Pare todos os containers: `docker-compose down`
- Remova o volume: `docker volume rm plantaofisio_postgres_data`
- Reinicie: `docker-compose up -d postgres`
- Execute as migrações novamente