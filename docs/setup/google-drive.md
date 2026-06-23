# Setup — Google Drive (#15)

> Patrick mandou em 12/06: https://drive.google.com/drive/folders/1lAdksPXH680jDDSxnLwuvGI16ZqK6uM1
> ID da pasta: `1lAdksPXH680jDDSxnLwuvGI16ZqK6uM1`

## O que essa integração faz

Quando um cliente submete um formulário com campo **upload de arquivo**, o
sistema:

1. **Sempre** grava o arquivo localmente em `uploads/<hash><ext>` (ou S3 se
   configurado) com `FileMetadata` + ownership pra controle de acesso.
2. **Quando o Drive está configurado** — adicionalmente copia o arquivo
   pra pasta compartilhada do Workspace, dentro de uma subpasta
   automática `cliente-<id>` ou `form-respostas`.

Drive é **complementar**, não substitui. Se Drive cair, o cliente continua
conseguindo subir arquivo (vai pro FS/S3). Equipe perde só o atalho pra
abrir o anexo direto no Google Drive UI.

## Passo a passo no Google Cloud

### 1. Criar projeto (ou usar existente)
- https://console.cloud.google.com/
- Sugestão: nome "Cestacorp Sistema"

### 2. Habilitar Drive API
- Menu → APIs & Services → Library
- Procurar **"Google Drive API"** → Enable

### 3. Criar Service Account
- Menu → IAM & Admin → Service Accounts → "+ Create Service Account"
- Nome: `cestacorp-drive`
- Role: deixar **sem role** (não precisa de IAM, só Drive)
- Continue → Done

### 4. Gerar chave JSON
- Clica na service account criada → aba "Keys" → "Add Key" → "Create new key"
- Tipo: **JSON** → Create
- Vai baixar um arquivo tipo `cestacorp-drive-abc123.json`
- **Guarda esse arquivo seguro** — quem tiver vê tudo da pasta

### 5. Compartilhar a pasta com a service account
- Abrir `cestacorp-drive-abc123.json` em um editor de texto
- Procurar a linha `"client_email": "cestacorp-drive@<projeto>.iam.gserviceaccount.com"`
- Voltar pra pasta do Drive:
  https://drive.google.com/drive/folders/1lAdksPXH680jDDSxnLwuvGI16ZqK6uM1
- Botão direito → **Compartilhar** → colar o `client_email` da service account
- Permissão: **Editor**
- Desmarcar "Notificar pessoas" (a service account não tem inbox)
- Compartilhar

### 6. Colar no EasyPanel
- EasyPanel → container `app` → Environment Variables
- Adicionar duas variáveis:

```
GOOGLE_DRIVE_FOLDER_ID=1lAdksPXH680jDDSxnLwuvGI16ZqK6uM1
GOOGLE_SERVICE_ACCOUNT_JSON=<CONTEÚDO DO JSON EM UMA LINHA SÓ>
```

Pra colar o JSON: copia o conteúdo inteiro do arquivo `.json` baixado.
EasyPanel aceita JSON multi-linha em algumas versões; se não aceitar,
remove as quebras de linha (o conteúdo já é JSON, então fica em uma linha).

**Cuidado:** o JSON contém `"private_key"` com `\n` nos caracteres. Esses
`\n` precisam ser preservados literalmente. Se você colar como variável
multi-linha do EasyPanel, mantenha como veio. Se colar em uma linha só,
não substitua `\n` por nada.

- Save → Redeploy

### 7. Testar

Depois do redeploy:

**Via UI** (recomendado):
- Login como admin em `https://cestacorp.bahflash.tech`
- Vai em `/configuracoes/integracao-drive` (a criar — ver `#15` follow-up)
- Clica em "Fazer upload de teste"
- Deve aparecer: ✅ "Upload OK em XXXms" + link pro arquivo no Drive

**Via curl** (rápido):
```bash
curl -X POST https://cestacorp.bahflash.tech/api/admin/drive/test \
  -H "Cookie: <sua sessão admin>"
```

Esperado:
```json
{
  "ok": true,
  "configurado": true,
  "duracaoMs": 1234,
  "arquivo": { "fileId": "...", "name": "teste-...txt", "webViewLink": "..." }
}
```

Se vier `configurado: false` → faltam envs no EasyPanel.

Se vier `ok: false` + erro tipo "File not found: ..." → a pasta NÃO foi
compartilhada com a service account. Volta ao passo 5.

## Se algo der errado

| Erro retornado | Causa | Solução |
|---|---|---|
| `configurado: false` | Envs faltando | Conferir GOOGLE_SERVICE_ACCOUNT_JSON e GOOGLE_DRIVE_FOLDER_ID |
| `Token Drive falhou: 401` | JSON inválido ou private_key corrompida | Re-gerar chave JSON (passo 4) |
| `Token Drive falhou: 403` | Drive API não habilitada | Voltar ao passo 2 |
| `404 File not found` | Pasta não compartilhada com service account | Passo 5 |
| `403 storageQuotaExceeded` | Service Account sem cota própria | Usar Shared Drive (pasta na unidade compartilhada do Workspace) |

## Após configurar

- Cliente preenche formulário em `/forms/<slug>`
- Upload vai pra: `uploads/<hash><ext>` (sistema) **+** Drive `cliente-<id>/`
- Equipe vê em `/formularios/<respostaId>` link "Abrir no Drive" ao lado de
  cada anexo (a fazer na UI — ver follow-up no #15)
- Cliente baixa pelo portal sem precisar de conta Google
