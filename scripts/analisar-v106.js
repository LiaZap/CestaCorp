const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const abas = [
  "CLIENTES", "RESPONSÁVEIS", "TAGS HUBLX", "TEXTOS TAGS HUBLX",
  "HONORÁRIOS", "ATIVIDADES", "OBRIGAÇÕES", "DASH", "AGENDAS",
  "CERTIFICADOS", "ÍNDICE", "ANIVERSARIANTES", "EMAILS", "CONTATOS",
  "GESTÃO", "ENCERRADOS", "CLASSIFICAÇÃO", "CLIENTE INDICA",
  "PARCEIRO INDICA", "REDE IDEIA", "ENVIO", "TABELA HONORARIOS",
  "OBJETO SOCIAL ", "CONTRATOS - MALA EXCEL", "DIRF", "DAS", "DEFIS",
];

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("C:/Users/Paulo/Downloads/CONTROLE CESTACORP - 102019 v106.xlsx");
  const out = {};
  for (const nome of abas) {
    const ws = wb.getWorksheet(nome);
    if (!ws) { out[nome] = { erro: "aba não encontrada" }; continue; }
    const headers = [];
    const r1 = [], r2 = [], r3 = [], sample = [];
    ws.getRow(1).eachCell({ includeEmpty: false }, (c, i) => { r1[i - 1] = String(c.value ?? "").slice(0, 60); });
    ws.getRow(2).eachCell({ includeEmpty: false }, (c, i) => { r2[i - 1] = String(c.value ?? "").slice(0, 60); });
    ws.getRow(3).eachCell({ includeEmpty: false }, (c, i) => { r3[i - 1] = String(c.value ?? "").slice(0, 60); });
    ws.getRow(5).eachCell({ includeEmpty: false }, (c, i) => { sample[i - 1] = String(c.value ?? "").slice(0, 30); });
    out[nome] = {
      linhas: ws.actualRowCount,
      cols: ws.columnCount,
      r1, r2, r3, sample,
    };
  }
  const dir = path.join(process.cwd(), "tmp-v106");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "headers.json"), JSON.stringify(out, null, 2));
  console.log("OK", Object.keys(out).length, "abas extraídas para", dir);
})();
