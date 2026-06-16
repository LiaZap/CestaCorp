# Roteiro de testes — entregas Cestacorp Jun/2026

**Para:** Equipe QA
**Domínio de teste:** `https://cestacorp.bahflash.tech`
**Última atualização:** 12/06/2026

> Todas as mudanças listadas estão no `main` em produção (commits `132a7ff` → `534bbc4`).
> Necessidades de deploy antes de testar estão marcadas com ⚠️.

---

## ⚠️ Pré-requisitos no EasyPanel antes de QA

Confirmar com Patrick que os 3 passos abaixo foram feitos no container `app`:

1. **Variáveis de ambiente** — todos os 6 secrets rotacionados estão no painel
   - `NIBO_WEBHOOK_SECRET`, `DIGISAC_WEBHOOK_SECRET`, `AUTENTIQUE_WEBHOOK_SECRET`
   - `CRON_SECRET`, `NEXTAUTH_SECRET`, `CERTIFICATE_ENCRYPTION_KEY`
   - **SMTP_*** (`HOST`, `PORT`, `USER`, `PASS` = app password Workspace, `FROM`)
2. **Migração do banco** depois do redeploy do app:
   ```bash
   npx prisma db push
   ```
   Sem isso, os testes #5, #6 e #11 vão dar erro de "column does not exist".
3. **Redeploy do app** após salvar envs.

---

## 1. Tela `/tags/[id]` — mensagens da V-106 usáveis

**Onde:** menu lateral → **Tags** → clica em qualquer linha.

**Cenários a testar:**

| # | Cenário | Resultado esperado |
|---|---|---|
| 1.1 | Abrir uma tag (ex.: "Honorários dia 5") | 4 KPIs (Futuros / Passados / Executados / Com erro) + lista de mensagens + lista de agendamentos |
| 1.2 | Clicar **Nova mensagem** | Form inline aparece com título / texto / canal (whatsapp/email/sms) |
| 1.3 | Salvar nova mensagem com texto curto (1 char) | Toast vermelho "Preencha título e texto" |
| 1.4 | Salvar com título 60 chars + texto 200 chars | Aparece imediatamente na lista, badge "WhatsApp" |
| 1.5 | Editar mensagem existente (lápis) | Form de edição aparece em destaque azul |
| 1.6 | Cancelar edição (X) | Volta sem salvar |
| 1.7 | Excluir mensagem (lixeira) | Confirm dialog; ao confirmar, mensagem + agendamentos vinculados somem |
| 1.8 | Filtrar agendamentos: Futuros / Passados / Executados / Todos | Lista atualiza, contador KPI muda visual |
| 1.9 | Botão **Marcar passados como executado** | Confirm dialog; ao confirmar, todos agendamentos com data < hoje viram verde |
| 1.10 | Marcar 1 agendamento como executado (check verde) | Vira verde, mostra "executado em DD/MM/YYYY HH:mm" |
| 1.11 | Voltar agendamento executado pra pendente (refresh azul) | Volta pra "futuros pendentes" |
| 1.12 | Cancelar 1 agendamento (lixeira) | Some da lista, KPI total decrementa |

**Bugs conhecidos:** nenhum.

---

## 2. Card de evento na agenda — mostra cliente

**Onde:** menu lateral → **Agenda** → ver calendário do mês.

**Cenários:**

| # | Cenário | Resultado esperado |
|---|---|---|
| 2.1 | Visualizar card no calendário | Mostra `#código RAZÃO SOCIAL` em vez de só razão social |
| 2.2 | Passar mouse no card (sem clicar) | Tooltip rico aparece: `[TIPO] título · Cliente: #123 Razão · Resp · Status` |
| 2.3 | Clicar no card | Vai pra `/agenda/[id]` (detalhe do evento) |
| 2.4 | Olhar "Próximos 30 dias" embaixo do calendário | Cada evento mostra `#código` em fonte mono |
| 2.5 | Na ficha do evento, botão **Baixar .ics** | Download de arquivo `.ics` válido (consegue importar no Google Calendar/Outlook) |

---

## 3. Aplicar resposta de formulário (4 modos)

**Onde:** menu lateral → **Formulários** → clica em alguma resposta.

**Cenários:**

| # | Cenário | Resultado esperado |
|---|---|---|
| 3.1 | Clicar **Aplicar ao cadastro** | Abre modal com 4 opções (não trava mais como antes) |
| 3.2 | Selecionar **Vincular a cliente existente** + buscar "luciano" | Lista de até 10 clientes aparece debounced (250ms) |
| 3.3 | Selecionar um cliente da lista (CheckCircle aparece) + Aplicar | Toast verde "Resposta aplicada", redireciona pra ficha do cliente. Resposta marcada como APLICADO |
| 3.4 | **Vincular a pré-cadastro existente** + buscar email | Lista de pré-cadastros aparece |
| 3.5 | **Criar pré-cadastro novo** + Aplicar | Cria PreCadastro novo, redireciona pra `/clientes/pre-cadastros/[id]` |
| 3.6 | **Criar cliente novo (PF)** SEM CPF/CNPJ no form | Toast erro: "Sem CPF/CNPJ no formulário pra criar cliente. Use Vincular ou Criar pré-cadastro." |
| 3.7 | **Criar cliente novo (PF)** COM CPF inválido | Toast erro: "CPF/CNPJ inválido (dígitos verificadores não conferem)" |
| 3.8 | **Criar cliente novo (PF)** COM CPF válido | Cria cliente PROSPECT, redireciona pra ficha |
| 3.9 | Aplicar resposta de "Dados de Sócio" → modo Vincular a cliente | Cliente recebe novo sócio no card Sócios |

---

## 4. Planos contratados na ficha do cliente — ⚠️ exige `prisma db push`

**Onde:** abrir qualquer cliente → card **"Planos contratados"** (entre Contratos e Sócios).

**Cenários:**

| # | Cenário | Resultado esperado |
|---|---|---|
| 4.1 | Cliente sem planos | "Nenhum plano contratado ainda" + botão **Adicionar plano** |
| 4.2 | Clicar **Adicionar plano** | Form inline: serviço (dropdown só lista não-contratados ativos), valor mensal, dia vencimento, observação |
| 4.3 | Criar plano "Contabilidade" R$ 600 dia 5 | Linha verde "ATIVO" aparece. Header mostra "Receita mensal ativa: R$ 600,00" |
| 4.4 | Adicionar 2º plano "Gestão de Consultório" R$ 200 dia 10 | 2 linhas verdes. Header R$ 800,00 |
| 4.5 | Tentar adicionar plano "Contabilidade" novamente (já ativo) | Não aparece no dropdown — sem duplicação possível |
| 4.6 | Editar valor de um plano (lápis) | Edita inline, badge verde, novo total |
| 4.7 | Suspender plano (Pause amarelo) + motivo "férias coletivas" | Vira amarelo "SUSPENSO", header recalcula só ATIVOS |
| 4.8 | Reativar suspenso (Play verde) | Volta a verde, soma de novo |
| 4.9 | Cancelar plano (Ban vermelho) sem motivo | Toast amarelo "motivo obrigatório" |
| 4.10 | Cancelar com motivo "rescisão amigável 06/2026" | Vira cinza "CANCELADO" + opacity 60% + motivo destacado com ícone |
| 4.11 | Tentar reativar CANCELADO | Botões somem (só remove cancelar) — não permite reativar |
| 4.12 | Soma da Receita ativa | Bate exatamente com soma dos ATIVOS (não inclui suspensos nem cancelados) |

---

## 5. Excluir cliente da ficha

**Onde:** ficha de qualquer cliente → header, último botão (ícone lixeira).

**Cenários:**

| # | Cenário | Resultado esperado |
|---|---|---|
| 5.1 | Clicar lixeira | Modal aparece com aviso amarelo "É exclusão temporária — Lixeira 30 dias" |
| 5.2 | Tentar confirmar sem digitar nada | Botão "Mover pra Lixeira" desabilitado |
| 5.3 | Digitar 8 primeiras letras erradas | Botão continua desabilitado |
| 5.4 | Digitar 8 primeiras letras da razão social | Botão habilita |
| 5.5 | Confirmar | Toast "Cliente movido pra Lixeira (30 dias pra restaurar)", redireciona pra `/clientes` |
| 5.6 | Verificar em `/configuracoes/lixeira` | Cliente aparece com data de exclusão |
| 5.7 | Restaurar de `/configuracoes/lixeira` | Cliente volta normal pra `/clientes` |

---

## 6. Autocomplete `#código` em `/clientes`

**Onde:** menu lateral → **Clientes** → campo de busca no topo.

**Cenários:**

| # | Cenário | Resultado esperado |
|---|---|---|
| 6.1 | Digitar "luciano" (1 char) | Nada acontece (mínimo 2) |
| 6.2 | Digitar "luc" (3 chars) | Dropdown aparece após ~250ms com `#código RAZÃO SOCIAL · CPF/CNPJ` |
| 6.3 | Setinha ↓ | Hover muda de linha, mostra ícone CornerDownLeft |
| 6.4 | Enter na sugestão highlighted | Vai direto pra `/clientes/[id]` |
| 6.5 | Click direto numa sugestão | Mesma coisa |
| 6.6 | Esc | Dropdown fecha |
| 6.7 | Click fora do dropdown | Dropdown fecha |
| 6.8 | Olhar coluna "Código" da tabela | Mostra `#NNN` em link azul Cestacorp (não só "NNN") |

---

## 7. Gerar lembrete antecipado + .ics (Obrigações)

**Onde:** menu lateral → **Agenda** → botão "Obrigações" → "Nova obrigação".

**Cenários:**

| # | Cenário | Resultado esperado |
|---|---|---|
| 7.1 | Header da `/agenda/obrigacoes` | Mostra "Lembretes antecipados pro cliente — não tarefa da equipe" |
| 7.2 | Criar obrigação "DAS Simples" dia 20, antecedência 5 | Hint embaixo da antecedência: "DAS vence dia 20, antecedência 5 → lembrete sai dia 15" |
| 7.3 | Card "Canais de envio" com 3 checkboxes | WhatsApp / E-mail / Agenda (.ics) — com descrição |
| 7.4 | Desmarcar todos canais | Aviso vermelho: "Sem canais → o lembrete será gerado mas não enviado" |
| 7.5 | Adicionar campo "Horário do envio" | Type=time funciona (08:00 default) |
| 7.6 | Salvar obrigação | Vai pra lista de obrigações |
| 7.7 | Abrir evento gerado por essa obrigação → Baixar `.ics` | Arquivo válido. Abrir no Google Calendar → cria evento com lembrete 1 dia antes |

> ⚠️ **Importante**: envio real **continua desligado** conforme acordado. Teste só verifica que a INTERFACE cria/configura corretamente.

---

## 8. Editor visual de formulários — duplicar + versionar

**Onde:** menu lateral → **Formulários** → "Editar campos".

**Cenários:**

| # | Cenário | Resultado esperado |
|---|---|---|
| 8.1 | Header do FormBuilder em modo edição | Mostra badge `versão N` ao lado de "Ativo" (tooltip explica que respostas antigas continuam válidas) |
| 8.2 | Editar 1 campo + Salvar alterações | Badge passa de versão 1 → versão 2 |
| 8.3 | Editar de novo + Salvar | Vira versão 3 |
| 8.4 | Editar apenas título do formulário (não fields) + Salvar | Versão NÃO incrementa (só fields conta) |
| 8.5 | Clicar **Duplicar** | Confirm dialog "Duplicar como novo formulário (sufixo -copia)?" |
| 8.6 | Confirmar duplicação | Redireciona pra editor do novo. Slug: `<original>-copia`, status `INATIVO` |
| 8.7 | Duplicar de novo | Slug `<original>-copia-2`, depois `-copia-3`... |
| 8.8 | API `GET /api/forms/definitions/[id]/versoes` | Retorna `versaoAtual` + array `versoes` com snapshots |

---

## 9. Portal cliente — Documentos unificados

**Onde:** logar como cliente em `/portal/login` → menu **Documentos** (era "Contratos").

> Pra criar acesso de teste: equipe vai em `/configuracoes/portal-cliente` → busca o cliente → "Gerar link" → copia + abre na aba anônima.

**Cenários:**

| # | Cenário | Resultado esperado |
|---|---|---|
| 9.1 | Menu do portal | Item "Contratos" virou **Documentos** |
| 9.2 | URL antiga `/portal/contratos` | Redireciona pra `/portal/documentos?tipo=contrato` (preserva bookmark) |
| 9.3 | Página `/portal/documentos` carrega | 4 KPIs (Todos / Contrato / Nota Fiscal / Documento) clicáveis |
| 9.4 | Click no KPI "Nota Fiscal" | Lista filtra; URL ganha `?tipo=nota-fiscal`; KPI ativo fica destacado |
| 9.5 | Buscar "comprovante" | Filtra por título/subtítulo, debounce na submissão do form |
| 9.6 | Filtro de ano (carrossel) | Aparece se houver docs de mais de 1 ano. Click filtra |
| 9.7 | Botão **Baixar tudo em ZIP** | Download de arquivo `documentos-cestacorp-AAAAMMDD.zip` |
| 9.8 | Abrir ZIP | Arquivos com nome padronizado (`TITULO DDMMAAAA.ext`) |
| 9.9 | Click em **Baixar** num item individual | Download direto do arquivo correspondente |
| 9.10 | Tentar acessar `/api/portal/notas-fiscais/[id-de-outro-cliente]/xml` | HTTP 403 (IDOR check) |
| 9.11 | Tentar ZIP com 500 MB de docs | HTTP 413 (limite 100 MB) — mensagem pede pra filtrar |

---

## 10. Gerenciador de acessos do portal

**Onde:** menu lateral → **Configurações** → card verde "Portal do cliente — acessos".

**Cenários:**

| # | Cenário | Resultado esperado |
|---|---|---|
| 10.1 | Página carrega | 4 KPIs (Total / Acesso ativo / Convite pendente / Sem acesso) |
| 10.2 | Filtros: Todos / Com acesso / Sem acesso | Lista refresh |
| 10.3 | Busca: digitar "luciano" | Filtra clientes |
| 10.4 | Badge por linha | Verde "acesso ativo" / Amarelo "convite pendente" / Outline "sem acesso" |
| 10.5 | Click em "Gerar link" (cliente sem acesso) | Modal pede nome + email |
| 10.6 | Preencher e gerar | Link aparece com botões Copiar/Abrir |
| 10.7 | Click Copiar | Toast "Link copiado" + URL na clipboard |
| 10.8 | Click Abrir (em aba anônima) | Página de definir senha aparece |
| 10.9 | Definir senha < 8 chars | Erro |
| 10.10 | Definir senha ≥ 8 chars | Cria conta, redireciona pra `/portal` |
| 10.11 | Voltar em `/configuracoes/portal-cliente` | Status do cliente virou verde "acesso ativo" |

---

## 11. Saúde dos webhooks

**Onde:** menu lateral → **Configurações** → card roxo "Saúde dos webhooks".

**Cenários:**

| # | Cenário | Resultado esperado |
|---|---|---|
| 11.1 | Página carrega | 3 cards (NIBO / Digisac / Autentique) com status |
| 11.2 | Cada card mostra: status, secret configurado, token configurado, último evento, total 24h e total | Tudo populado |
| 11.3 | Verde "OK" = secret + evento <24h. Amarelo = sem evento. Vermelho = sem secret | Lógica correta |
| 11.4 | URL do webhook com botão Copiar | Funciona |
| 11.5 | Bater no endpoint sem assinatura: `curl -X POST https://cestacorp.bahflash.tech/api/webhooks/nibo` | HTTP 401 (assinatura ausente) ou 503 se secret não setado |
| 11.6 | Enviar webhook de teste do painel NIBO/Digisac/Autentique | Status muda pra OK em segundos. Total incrementa |

---

## Bugs que devem ESTAR corrigidos (regressão)

| # | Cenário | Resultado esperado |
|---|---|---|
| R.1 | Botão **Sincronizar Digisac** em `/tags` | Mostra toast (verde/amarelo) na mesma página, **não trava** em `/api/tags/sincronizar` |
| R.2 | Botão **Aplicar ao cadastro** em formulário | Abre modal de 4 opções, **não trava** em URL de API |
| R.3 | Ficha de cliente com avaliacao Google "DIAMANTE" | Aparece sem erro (enum aceita) |
| R.4 | Endereço estruturado do cliente em mail merge | Contrato gerado tem rua/número/bairro/cep, não JSON cru |

---

## Smoke tests rápidos (5 min, pré-testar)

```
✅ /  — login funciona
✅ /clientes  — lista carrega, filtros funcionam
✅ /clientes/[id]  — ficha completa com card Planos
✅ /agenda  — calendário renderiza, cards mostram #código
✅ /tags  — lista linkável
✅ /tags/[id]  — abre detalhe da tag
✅ /formularios  — lista funciona
✅ /formularios/[id]  — vê resposta, botão Aplicar abre modal
✅ /formularios/definitions/[id]  — editor abre, badge versão N
✅ /configuracoes/portal-cliente  — KPIs carregam
✅ /configuracoes/webhooks  — 3 cards carregam
✅ /portal/login  — formulário login do cliente
✅ /portal/documentos  — após logar como cliente
```

---

## O que NÃO está coberto neste QA

Estes ficaram para depois (dependem de ação externa):

- **#7** Digisac (Patrick precisa liberar número WhatsApp + token)
- **#15** Upload de formulário → Drive (Patrick precisa criar pasta + service account)
- **#96** Renomeador Universal (Douglas vai analisar)
- **Disparo real** de WhatsApp / e-mail (continua desligado por design — só liga quando Patrick autorizar)

---

## Reporta bugs como

```
# [TÍTULO CURTO]

**Cenário:** [número e nome do cenário do roteiro, ex: 4.5]
**Reproduzir:**
1. ...
2. ...

**Esperado:** ...
**Obtido:** ...

**Browser:** Chrome 130 / Firefox / Safari
**Cliente de teste:** [#código ou razão social]
**Screenshot:** [anexo]
**Audit log:** [se aparecer no /configuracoes/audit, copia o request_id]
```

---

**Próximo passo do dev:** se algum cenário falhar, abre issue marcando o número do cenário do roteiro pra eu corrigir.
