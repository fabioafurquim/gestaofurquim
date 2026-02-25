# Configuração do Google Drive e Gmail

Este guia explica como configurar a integração com Google Drive e Gmail para o módulo de Controle de Pagamentos.

## Passo 1: Criar Projeto no Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Anote o **Project ID**

## Passo 2: Habilitar APIs

No Google Cloud Console, vá em **APIs & Services > Library** e habilite:

1. **Google Drive API**
2. **Gmail API**

## Passo 3: Configurar Tela de Consentimento OAuth

1. Vá em **APIs & Services > OAuth consent screen**
2. Selecione **External** (ou Internal se for G Suite)
3. Preencha:
   - **App name**: PlantãoFisio
   - **User support email**: furquimfisioterapia@gmail.com
   - **Developer contact**: furquimfisioterapia@gmail.com
4. Em **Scopes**, adicione:
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/gmail.send`
5. Em **Test users**, adicione: `furquimfisioterapia@gmail.com`

## Passo 4: Criar Credenciais OAuth

1. Vá em **APIs & Services > Credentials**
2. Clique em **Create Credentials > OAuth client ID**
3. Selecione **Desktop app** (ou Web application)
4. Nome: PlantãoFisio
5. Se for Web application, adicione em **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/google/callback`
6. Clique em **Create**
7. Baixe o JSON das credenciais

## Passo 5: Configurar no Sistema

1. Renomeie o arquivo JSON baixado para `google-credentials.json`
2. Coloque na raiz do projeto (pasta `plantaofisio`)
3. O arquivo deve ter esta estrutura:

```json
{
  "installed": {
    "client_id": "SEU_CLIENT_ID.apps.googleusercontent.com",
    "project_id": "seu-projeto",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "SEU_CLIENT_SECRET",
    "redirect_uris": ["http://localhost"]
  }
}
```

## Passo 6: Autenticar no Sistema

1. Acesse o sistema: http://localhost:3000/payment-control
2. Clique no botão **"Configurar Google"**
3. Faça login com a conta `furquimfisioterapia@gmail.com`
4. Autorize as permissões solicitadas
5. Você será redirecionado de volta ao sistema

## Estrutura de Pastas no Google Drive

O sistema criará automaticamente a seguinte estrutura:

```
📁 Pagamentos Fisioterapeutas
  └── 📁 [Nome do Fisioterapeuta]
      └── 📁 [Ano]
          ├── 📁 RPA
          ├── 📁 Notas Fiscais
          └── 📁 Comprovantes PIX
```

## Formato do E-mail

O e-mail enviado terá o seguinte formato:

**Assunto:** Comprovante [Mês]/[Ano]

**Corpo:**
```
Bom dia/Boa tarde/Boa noite,

Segue anexo comprovante de pagamento referente aos serviços prestados no mês de [Mês]/[Ano].

Obrigada
Att
[Assinatura configurada no Gmail]
```

**Anexos:**
- Comprovante PIX (obrigatório)
- RPA (apenas para contratos RPA)

## Troubleshooting

### Erro "Token expirado"
- Acesse `/payment-control` e clique em "Configurar Google" novamente

### Erro "Arquivo google-credentials.json não encontrado"
- Verifique se o arquivo está na raiz do projeto
- Verifique se o nome está correto (sem espaços)

### Erro ao enviar e-mail
- Verifique se a API do Gmail está habilitada
- Verifique se o escopo `gmail.send` foi autorizado

### Arquivos não aparecem no Drive
- Verifique se a API do Drive está habilitada
- Verifique se o escopo `drive.file` foi autorizado
