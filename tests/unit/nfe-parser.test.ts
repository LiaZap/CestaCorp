import { describe, it, expect } from "vitest";
import { parseNFe } from "@/lib/services/nfe-parser";

// XMLs de fixture — estrutura mínima válida de NFe
const NFE_SAIDA_COMPLETA = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe43250412345678000199550010000012341234567890" versao="4.00">
      <ide>
        <cUF>43</cUF>
        <natOp>VENDA DE MERCADORIA</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>1234</nNF>
        <dhEmi>2026-04-20T14:30:00-03:00</dhEmi>
        <dhSaiEnt>2026-04-20T15:00:00-03:00</dhSaiEnt>
        <tpNF>1</tpNF>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>TECHNOVA LTDA</xNome>
        <xFant>TechNova</xFant>
      </emit>
      <dest>
        <CNPJ>98765432000111</CNPJ>
        <xNome>CLIENTE DESTINO LTDA</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>ABC-001</cProd>
          <xProd>Servico de contabilidade</xProd>
          <NCM>00000000</NCM>
          <CFOP>5933</CFOP>
          <uCom>UN</uCom>
          <qCom>1.0000</qCom>
          <vUnCom>1850.00</vUnCom>
          <vProd>1850.00</vProd>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <vICMS>111.00</vICMS>
            </ICMS00>
          </ICMS>
        </imposto>
      </det>
      <det nItem="2">
        <prod>
          <cProd>DEF-002</cProd>
          <xProd>Honorario adicional</xProd>
          <NCM>00000000</NCM>
          <CFOP>5933</CFOP>
          <uCom>UN</uCom>
          <qCom>2.0000</qCom>
          <vUnCom>150.00</vUnCom>
          <vProd>300.00</vProd>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <vICMS>18.00</vICMS>
            </ICMS00>
          </ICMS>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vBC>2150.00</vBC>
          <vICMS>129.00</vICMS>
          <vProd>2150.00</vProd>
          <vFrete>0.00</vFrete>
          <vDesc>0.00</vDesc>
          <vIPI>0.00</vIPI>
          <vPIS>14.00</vPIS>
          <vCOFINS>65.00</vCOFINS>
          <vNF>2150.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

const NFE_ENTRADA_MINIMA = `<?xml version="1.0"?>
<NFe>
  <infNFe Id="NFe43250400000000000199550010000099991234567890">
    <ide>
      <nNF>9999</nNF>
      <mod>55</mod>
      <tpNF>0</tpNF>
      <dhEmi>2026-03-15T10:00:00-03:00</dhEmi>
    </ide>
    <emit>
      <CNPJ>11111111000100</CNPJ>
      <xNome>FORNECEDOR TESTE</xNome>
    </emit>
    <det nItem="1">
      <prod>
        <xProd>Produto teste</xProd>
        <qCom>1</qCom>
        <vUnCom>100</vUnCom>
        <vProd>100</vProd>
      </prod>
    </det>
    <total>
      <ICMSTot>
        <vNF>100.00</vNF>
      </ICMSTot>
    </total>
  </infNFe>
</NFe>`;

describe("parseNFe", () => {
  it("extrai chave de 44 dígitos do atributo Id", () => {
    const r = parseNFe(NFE_SAIDA_COMPLETA);
    expect(r.chave).toBe("43250412345678000199550010000012341234567890");
  });

  it("identifica NFe de saída (tpNF=1)", () => {
    const r = parseNFe(NFE_SAIDA_COMPLETA);
    expect(r.tipo).toBe("saida");
  });

  it("identifica NFe de entrada (tpNF=0)", () => {
    const r = parseNFe(NFE_ENTRADA_MINIMA);
    expect(r.tipo).toBe("entrada");
  });

  it("extrai dados do emitente", () => {
    const r = parseNFe(NFE_SAIDA_COMPLETA);
    expect(r.emitente.cnpj).toBe("12345678000199");
    expect(r.emitente.nome).toBe("TECHNOVA LTDA");
  });

  it("extrai destinatário quando presente", () => {
    const r = parseNFe(NFE_SAIDA_COMPLETA);
    expect(r.destinatario?.cnpjCpf).toBe("98765432000111");
    expect(r.destinatario?.nome).toBe("CLIENTE DESTINO LTDA");
  });

  it("NFe de entrada sem destinatário não quebra", () => {
    const r = parseNFe(NFE_ENTRADA_MINIMA);
    expect(r.destinatario).toBeUndefined();
  });

  it("parseia número, série e modelo", () => {
    const r = parseNFe(NFE_SAIDA_COMPLETA);
    expect(r.numero).toBe("1234");
    expect(r.serie).toBe("1");
    expect(r.modelo).toBe("55");
  });

  it("parseia data de emissão", () => {
    const r = parseNFe(NFE_SAIDA_COMPLETA);
    expect(r.dataEmissao).toBeInstanceOf(Date);
    expect(r.dataEmissao.getFullYear()).toBe(2026);
    expect(r.dataEmissao.getMonth()).toBe(3); // abril = 3 (zero-indexed)
  });

  it("totaliza valores da nota", () => {
    const r = parseNFe(NFE_SAIDA_COMPLETA);
    expect(r.valores.total).toBe(2150);
    expect(r.valores.produtos).toBe(2150);
    expect(r.valores.icms).toBe(129);
    expect(r.valores.pis).toBe(14);
    expect(r.valores.cofins).toBe(65);
  });

  it("parseia todos os itens (det)", () => {
    const r = parseNFe(NFE_SAIDA_COMPLETA);
    expect(r.itens).toHaveLength(2);
    expect(r.itens[0].codigo).toBe("ABC-001");
    expect(r.itens[0].descricao).toBe("Servico de contabilidade");
    expect(r.itens[0].quantidade).toBe(1);
    expect(r.itens[0].valorUnit).toBe(1850);
    expect(r.itens[0].valorTotal).toBe(1850);
    expect(r.itens[0].valorIcms).toBe(111);
    expect(r.itens[1].quantidade).toBe(2);
    expect(r.itens[1].valorTotal).toBe(300);
  });

  it("mantém ordem dos itens pelo atributo nItem", () => {
    const r = parseNFe(NFE_SAIDA_COMPLETA);
    expect(r.itens[0].ordem).toBe(1);
    expect(r.itens[1].ordem).toBe(2);
  });

  it("pega CFOP do primeiro item como CFOP geral", () => {
    const r = parseNFe(NFE_SAIDA_COMPLETA);
    expect(r.cfop).toBe("5933");
  });

  it("aceita Buffer como entrada", () => {
    const buf = Buffer.from(NFE_SAIDA_COMPLETA, "utf-8");
    const r = parseNFe(buf);
    expect(r.chave).toHaveLength(44);
  });

  it("XML sem infNFe lança erro específico", () => {
    expect(() => parseNFe("<outro>irrelevante</outro>"))
      .toThrow(/infNFe não encontrado/);
  });

  it("XML inválido lança erro claro", () => {
    expect(() => parseNFe("<invalido"))
      .toThrow();
  });

  it("chave diferente de 44 dígitos é rejeitada", () => {
    const xml = `<NFe><infNFe Id="NFeABC123"><ide><nNF>1</nNF></ide><emit><CNPJ>x</CNPJ><xNome>X</xNome></emit><total><ICMSTot/></total></infNFe></NFe>`;
    expect(() => parseNFe(xml)).toThrow(/Chave/);
  });

  it("aceita valores com vírgula como decimal", () => {
    const xml = NFE_ENTRADA_MINIMA.replace("<vNF>100.00</vNF>", "<vNF>100,50</vNF>");
    const r = parseNFe(xml);
    expect(r.valores.total).toBe(100.5);
  });
});
