# Notas Fiscais com IA — O que já está pronto

## Material de venda pro comercial · Cestacorp

> **Importante:** este documento lista **só o que já está implementado e funcional em produção**. Você pode vender, demonstrar e entregar tudo aqui hoje. Roadmap fica em documento separado.

---

## O Pitch em uma frase

**"Sua equipe não digita mais nota fiscal. Sobe a pasta inteira no sistema, a IA lê cada PDF, identifica o tomador, extrai os dados, renomeia tudo no padrão da contabilidade e devolve em segundos — pronto pra entrar no sistema."**

---

## Os 5 módulos já entregues

### 1. Renomeador automático de PDF em lote

**O que faz:**
Sobe até 30 PDFs de uma vez. A IA lê cada documento, identifica o nome do tomador e a data de emissão, e devolve um arquivo `.zip` com todos os PDFs renomeados no padrão Cestacorp.

**Padrão de saída:**
```
NOME COMPLETO DO TOMADOR DDMMAAAA.pdf
```

**Exemplos reais:**
```
LUCIANO FRAGA BIACHI LTDA 15032026.pdf
CONDOMINIO EDIF CAMPOS VERDES 28022026.pdf
MARCIA REGINA OLIVEIRA CORDEIRO 05012026.pdf
```

**Para vender:**
- "100 notas processadas em ~3 minutos"
- "Zero erro de digitação no nome do arquivo"
- "Padrão único entre todos os colaboradores"
- "Aceita NF-e, NFS-e, recibo, qualquer prefeitura"

---

### 2. Extração estruturada (não só renomeia — lê os dados)

**O que faz:**
Junto com o nome do arquivo, a IA já extrai os dados fiscais do PDF para preencher a base do sistema automaticamente:

| Campo extraído | Pra que serve |
|---|---|
| CNPJ do tomador | Vincula a nota ao cliente cadastrado |
| CNPJ do prestador | Identifica fornecedor |
| Número da nota | Controle de série |
| Data de emissão | Competência fiscal |
| Valor total | Apuração + escrituração |
| Descrição do serviço | Classificação de conta |
| Tributos retidos | INSS, IRRF, ISS, etc. |

**Para vender:**
- "Em uma operação só: renomear + importar pro sistema"
- "Quando o CNPJ do tomador bate com um cliente seu, a nota já vai vinculada"
- "Quando não bate, fica claramente sinalizada pra revisão"

---

### 3. Importação direta de XML NF-e / NFS-e

**O que faz:**
Para quem já recebe o XML (não só o PDF), a importação é ainda mais rápida — leitura nativa, sem IA, 100% precisa.

- Aceita XML padrão NF-e (modelo 55) e NFS-e
- Parser interno robusto: lida com `infNFe`, arrays vs. objeto único, datas em ISO ou formato BR
- Cria registro de `NotaFiscal` no banco automaticamente
- Vincula ao cliente via CNPJ

**Para vender:**
- "Se seu emissor manda XML, a gente importa em massa instantaneamente"
- "Sem perda de dado: cada campo do XML vai pro campo certo do sistema"

---

### 4. Listagem inteligente de notas (busca, filtro, paginação)

**O que faz:**
Toda nota importada (via OCR ou XML) entra numa listagem com:

- **Busca** por número, CNPJ, nome do cliente, descrição
- **Filtros** por: cliente, período, valor mínimo/máximo, status
- **Paginação** otimizada (sistema aguenta dezenas de milhares de notas)
- **Vínculo direto** com o cliente cadastrado (1 clique pra abrir ficha)

**Para vender:**
- "Toda nota fica organizada por cliente, por período, pesquisável"
- "Você não precisa abrir Excel pra achar uma nota de 6 meses atrás"

---

### 5. Auditoria + Segurança LGPD

**O que faz:**
Cada operação com nota fiscal é auditada:

- **Quem** subiu a nota
- **Quando** subiu
- **De qual** IP
- **Resultado** (sucesso/erro/parcial)

**Segurança técnica embutida:**
- Rate-limit: 5 lotes por colaborador a cada 10 minutos (proteção contra abuso)
- Tamanho máximo: 10 MB por PDF (proteção contra DoS)
- Validação de tipo (não aceita arquivo malicioso disfarçado de PDF)
- Senhas/credenciais que apareçam em NF nunca são armazenadas (LGPD por design)
- Processamento em ambiente cifrado (AES-256-GCM em campos sensíveis)

**Para vender:**
- "Conformidade LGPD por construção, não por adesivo"
- "Toda operação é rastreável — exigência da Lei Geral de Proteção de Dados (Art. 37)"
- "Cliente final pode pedir relatório de quem acessou os dados dele a qualquer momento"

---

## Como demonstrar (roteiro de 2 minutos)

### Antes da demo
1. Abrir `https://cestacorp.bahflash.tech/notas-fiscais/renomear` em uma aba
2. Ter 5 PDFs de nota fiscal de exemplo no desktop (qualquer prefeitura serve)

### Durante a demo
1. **(15s)** "Hoje sua equipe gasta quanto tempo renomeando PDF por mês? Pensa numa colaboradora..."
2. **(10s)** "Vou jogar 5 notas aqui agora, do meu computador"
3. **(30s)** Drag-and-drop dos 5 PDFs → "Clica em Processar"
4. **(45s)** Tela mostra cada arquivo sendo processado em tempo real, com confiança e status
5. **(20s)** Download do ZIP → abre → mostra os 5 PDFs já renomeados no padrão
6. **(10s)** "Multiplica isso por 100 notas/mês — sua equipe ganha 12 horas de volta"

### Pergunta de fechamento
> "Você quer experimentar com 30 notas da sua mesa agora? Sem compromisso, eu te libero acesso por 7 dias."

---

## Limites técnicos (transparência — não venda mentira)

| Item | Limite atual | Suficiente pra... |
|---|---|---|
| PDFs por lote | 30 | 95% dos clientes (média de NF/mês é 50–200) |
| Tamanho por PDF | 10 MB | NF normal raramente passa de 500 KB |
| Velocidade média | 2–4 segundos por nota | 30 notas em ~1,5 min |
| Lotes por colaborador | 5 a cada 10 min | Uso normal não esbarra |
| Taxa de acerto (renome) | >95% em base interna | Os 5% restantes vão pra revisão manual |

**Se cliente quer mais que 30 por lote:** explique que basta dividir em batches — o sistema processa um após o outro sem perder o ritmo.

**Se cliente quer 100% de acerto:** seja honesto: "OCR de qualquer fornecedor tem margem. A nossa diferença é que **marcamos exatamente o que ficou com baixa confiança** pra revisão humana, em vez de fingir que está certo."

---

## Onde acessar (links de produção)

| Ação | URL |
|---|---|
| Tela de renomeação em lote | `https://cestacorp.bahflash.tech/notas-fiscais/renomear` |
| Tela de importação XML | `https://cestacorp.bahflash.tech/notas-fiscais/importar` |
| Listagem de todas as notas | `https://cestacorp.bahflash.tech/notas-fiscais` |

---

## Quebra de objeções (notas fiscais)

### "Funciona com NF-e do meu emissor X?"
> "Sim. A IA não depende do layout — ela lê o conteúdo. Se você tem o XML, ainda melhor: importamos sem IA, com 100% de precisão."

### "Vai vazar meu dado fiscal?"
> "Não. O processamento é em ambiente cifrado, sem armazenamento do conteúdo da nota. A IA lê, extrai os campos e descarta. Toda operação fica auditada — conformidade LGPD por design."

### "E se a IA renomear errado?"
> "Cada arquivo volta com nível de confiança. Abaixo de um limite, fica marcado claramente: 'parcial' ou 'erro' + motivo. Você sabe exatamente o que conferir. Em uso interno, mais de 95% sai 100% correto."

### "Preciso treinar a IA com minha base?"
> "Não. Funciona no primeiro dia. Nenhuma configuração adicional."

### "Tem demo grátis?"
> "Pega 5 notas e me manda agora. Em 30 segundos eu te mostro funcionando."

---

## CTAs de fechamento (notas fiscais)

### WhatsApp curto
> **"Pega 5 notas fiscais da sua mesa. Manda no meu WhatsApp agora. Em 30 segundos eu te devolvo renomeadas no padrão da contabilidade. É a parte mais básica do nosso pacote — quer ver?"**

### Reunião
> **"Vou abrir o sistema na sua frente. Pega a pasta de NF do mês passado, joga aqui — eu te mostro economizando ~1 dia útil da sua equipe em 3 minutos."**

### Email
> **"Anexo um exemplo: 10 PDFs antes e depois do processamento. Olha o padrão único, o tempo total (1m43s), e o relatório de qual nota ficou com cada cliente. Quer agendar uma demo com seus arquivos reais na próxima quinta?"**

---

## Resumo executivo (para colocar em proposta)

> **Módulo de Notas Fiscais com IA — incluso em todos os planos:**
> - ✅ Renomeação automática de PDFs em lote (até 30/lote, ~3s por nota)
> - ✅ Extração de campos fiscais (CNPJ, valor, data, descrição, tributos)
> - ✅ Importação direta de XML NF-e e NFS-e
> - ✅ Listagem pesquisável com busca, filtro e paginação
> - ✅ Vínculo automático nota × cliente via CNPJ
> - ✅ Auditoria completa LGPD (rastreabilidade Art. 37)
> - ✅ Rate-limit e validações de segurança em todos os endpoints
> - ✅ Padrão de nome unificado: `RAZÃO DDMMAAAA.pdf`

---

**Documento de uso interno · Não compartilhar com cliente final sem revisão do comercial.**

_Última atualização: 05/06/2026 · todos os módulos descritos estão em produção em `cestacorp.bahflash.tech`._
