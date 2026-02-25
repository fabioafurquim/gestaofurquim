# 🚀 Guia de Desenvolvimento - Plantão Fisio

## 📋 Índice
- [Pré-requisitos](#pré-requisitos)
- [Configuração do Ambiente](#configuração-do-ambiente)
- [Executando Localmente](#executando-localmente)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Autenticação](#autenticação)
- [Banco de Dados](#banco-de-dados)
- [Comandos Úteis](#comandos-úteis)

---

## 🔧 Pré-requisitos

### Windows (Recomendado para este projeto)
- **Node.js 20+** - [Download](https://nodejs.org/)
- **PostgreSQL 15+** - [Download](https://www.postgresql.org/download/windows/)
- **Git** - [Download](https://git-scm.com/download/win)
- **VS Code** (recomendado) - [Download](https://code.visualstudio.com/)

### Extensões VS Code Recomendadas
- Prisma
- ESLint
- Prettier
- Tailwind CSS IntelliSense

---

## ⚙️ Configuração do Ambiente

### 1. Clone o Repositório
```bash
git clone <seu-repositorio>
cd plantaofisio
```

### 2. Instale as Dependências
```bash
npm install
```

### 3. Configure o Banco de Dados PostgreSQL

**Opção A: PostgreSQL Local (Windows)**
1. Instale o PostgreSQL
2. Crie o banco de dados:
```sql
CREATE DATABASE plantaofisio;
CREATE USER postgres WITH PASSWORD 'Fmm20615';
GRANT ALL PRIVILEGES ON DATABASE plantaofisio TO postgres;
```

**Opção B: Docker (se preferir)**
```bash
docker-compose up -d postgres
```

### 4. Configure as Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env`:
```bash
copy .env.example .env
```

Edite o `.env` com suas configurações:
```env
# Database
DATABASE_URL="postgresql://postgres:Fmm20615@localhost:5432/plantaofisio"
DIRECT_URL="postgresql://postgres:Fmm20615@localhost:5432/plantaofisio"

# Auth
AUTH_SECRET="plantaofisio-secret-key-2024"
JWT_SECRET="plantaofisio-secret-key-2024"

# Google Drive (opcional)
GOOGLE_CLIENT_ID="seu-client-id"
GOOGLE_CLIENT_SECRET="seu-client-secret"
```

### 5. Execute as Migrações do Prisma
```bash
npx prisma migrate dev
npx prisma generate
```

### 6. (Opcional) Popule o Banco com Dados de Teste
```bash
npx prisma db seed
```

---

## 🏃 Executando Localmente

### Modo Desenvolvimento
```bash
npm run dev
```

Acesse: http://localhost:3000

### Primeiro Acesso
1. Acesse http://localhost:3000/setup
2. Crie o usuário administrador
3. Faça login com as credenciais criadas

---

## 📁 Estrutura do Projeto

```
plantaofisio/
├── src/
│   ├── app/                    # App Router do Next.js
│   │   ├── api/               # API Routes
│   │   │   └── auth/          # Autenticação (NextAuth)
│   │   ├── login/             # Página de login
│   │   ├── setup/             # Configuração inicial
│   │   └── ...                # Outras páginas
│   ├── components/            # Componentes React
│   │   └── AuthLayout.tsx     # Layout com autenticação
│   ├── lib/                   # Utilitários
│   │   ├── auth.ts           # Funções de autenticação
│   │   └── prisma.ts         # Cliente Prisma
│   ├── types/                # TypeScript types
│   ├── auth.ts               # Configuração NextAuth
│   └── auth.config.ts        # Config NextAuth
├── prisma/
│   └── schema.prisma         # Schema do banco
├── public/                   # Arquivos estáticos
├── .env                      # Variáveis de ambiente (não commitar!)
├── .env.example             # Template de variáveis
├── package.json
└── next.config.ts
```

---

## 🔐 Autenticação

### NextAuth.js v5

Este projeto usa **NextAuth.js v5** (Auth.js) para autenticação moderna e segura.

**Características:**
- ✅ Sessões JWT
- ✅ Credentials Provider (email/senha)
- ✅ Proteção de rotas automática
- ✅ TypeScript completo
- ✅ Hooks React (`useSession`, `signIn`, `signOut`)

**Exemplo de uso:**
```typescript
import { useSession, signIn, signOut } from 'next-auth/react';

function MyComponent() {
  const { data: session, status } = useSession();
  
  if (status === 'loading') return <div>Carregando...</div>;
  if (!session) return <div>Não autenticado</div>;
  
  return (
    <div>
      <p>Olá, {session.user.name}!</p>
      <button onClick={() => signOut()}>Sair</button>
    </div>
  );
}
```

---

## 🗄️ Banco de Dados

### Prisma ORM

**Comandos principais:**
```bash
# Criar nova migração
npx prisma migrate dev --name nome_da_migracao

# Aplicar migrações
npx prisma migrate deploy

# Regenerar Prisma Client
npx prisma generate

# Abrir Prisma Studio (GUI do banco)
npx prisma studio

# Reset do banco (CUIDADO!)
npx prisma migrate reset
```

### Modificando o Schema

1. Edite `prisma/schema.prisma`
2. Execute `npx prisma migrate dev --name sua_alteracao`
3. O Prisma Client será regenerado automaticamente

---

## 🛠️ Comandos Úteis

### Desenvolvimento
```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Build de produção
npm run start        # Inicia servidor de produção
npm run lint         # Verifica erros de código
```

### Prisma
```bash
npx prisma studio    # Interface visual do banco
npx prisma format    # Formata o schema.prisma
npx prisma validate  # Valida o schema
```

### Git
```bash
git status           # Ver mudanças
git add .            # Adicionar todos os arquivos
git commit -m "msg"  # Commit com mensagem
git push            # Enviar para repositório remoto
```

---

## 🐛 Troubleshooting

### Erro: "Can't reach database server"
- Verifique se o PostgreSQL está rodando
- Confirme as credenciais no `.env`
- Teste a conexão: `psql -U postgres -d plantaofisio`

### Erro: "Module not found"
```bash
rm -rf node_modules package-lock.json
npm install
```

### Erro de Prisma
```bash
npx prisma generate
npx prisma migrate reset
```

### Porta 3000 em uso
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Ou use outra porta
PORT=3001 npm run dev
```

---

## 📚 Recursos

- [Next.js Docs](https://nextjs.org/docs)
- [NextAuth.js Docs](https://next-auth.js.org/)
- [Prisma Docs](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## 🔄 Workflow de Desenvolvimento

1. **Crie uma branch para sua feature**
   ```bash
   git checkout -b feature/nome-da-feature
   ```

2. **Desenvolva e teste localmente**
   ```bash
   npm run dev
   ```

3. **Commit suas mudanças**
   ```bash
   git add .
   git commit -m "feat: descrição da feature"
   ```

4. **Push para o repositório**
   ```bash
   git push origin feature/nome-da-feature
   ```

5. **Deploy automático via Coolify** (configurado no DEPLOY.md)

---

## 💡 Dicas

- Use `console.log()` para debug durante desenvolvimento
- Sempre teste localmente antes de fazer push
- Mantenha o `.env` atualizado mas NUNCA commite ele
- Use TypeScript para evitar erros
- Siga os padrões de código do projeto

---

## 🆘 Precisa de Ajuda?

- Verifique a documentação oficial das tecnologias
- Consulte o `DEPLOY.md` para questões de produção
- Entre em contato com o time de desenvolvimento
