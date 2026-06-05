"use client";

/**
 * Seção compartilhada de endereço — usada em ClienteForm e PreCadastroForm (#27, #65).
 *
 * Schema novo (#27): Cliente ganhou enderecoLogradouro/Numero/Complemento/Bairro/
 * Municipio/Uf/Cep como campos diretos. Gerador de contrato prioriza esses
 * sobre o `endereco` Json legado.
 *
 * Bônus: lookup de CEP via ViaCEP (preenche logradouro/bairro/municipio/uf) ao
 * digitar 8 dígitos no campo CEP. Patrick mencionou que copia endereço da
 * V106 — o autocompletar reduz fricção.
 *
 * A11y: usa <Field> do components/ui/field.tsx — cada input vem com Label,
 * htmlFor/id, aria-describedby. Construção, não retrofit (#60).
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FieldText } from "@/components/ui/field";
import { Search } from "lucide-react";

export interface EnderecoValues {
  enderecoLogradouro?: string;
  enderecoNumero?: string;
  enderecoComplemento?: string;
  enderecoBairro?: string;
  enderecoMunicipio?: string;
  enderecoUf?: string;
  enderecoCep?: string;
}

interface Props {
  valores: EnderecoValues;
  onChange: (campo: keyof EnderecoValues, valor: string) => void;
  titulo?: string;
  descricao?: string;
}

export function EnderecoSection({
  valores,
  onChange,
  titulo = "Endereço",
  descricao = "Usado no mail merge dos contratos gerados. Digite o CEP pra auto-preencher.",
}: Props) {
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepErro, setCepErro] = useState<string | null>(null);

  async function consultarCep(cepBruto: string) {
    const cep = cepBruto.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    setCepErro(null);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await r.json();
      if (j?.erro) {
        setCepErro("CEP não encontrado");
        return;
      }
      // Só preenche o que estiver vazio (não sobrescreve o que o usuário já digitou)
      if (j.logradouro && !valores.enderecoLogradouro) onChange("enderecoLogradouro", j.logradouro);
      if (j.bairro && !valores.enderecoBairro) onChange("enderecoBairro", j.bairro);
      if (j.localidade && !valores.enderecoMunicipio) onChange("enderecoMunicipio", j.localidade);
      if (j.uf && !valores.enderecoUf) onChange("enderecoUf", j.uf);
    } catch (err: any) {
      setCepErro("Falha ao consultar ViaCEP");
    } finally {
      setBuscandoCep(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <FieldText
          label="CEP"
          value={valores.enderecoCep}
          onChange={(v) => {
            onChange("enderecoCep", v);
            if (v.replace(/\D/g, "").length === 8) consultarCep(v);
          }}
          placeholder="00000-000"
          maxLength={9}
          className="md:col-span-2"
          hint={buscandoCep ? "Consultando ViaCEP…" : "Digite 8 dígitos pra auto-preencher"}
          error={cepErro}
        />
        <FieldText
          label="Logradouro"
          value={valores.enderecoLogradouro}
          onChange={(v) => onChange("enderecoLogradouro", v)}
          placeholder="Rua / Avenida"
          className="md:col-span-3"
        />
        <FieldText
          label="Número"
          value={valores.enderecoNumero}
          onChange={(v) => onChange("enderecoNumero", v)}
          placeholder="123"
          className="md:col-span-1"
        />

        <FieldText
          label="Complemento"
          value={valores.enderecoComplemento}
          onChange={(v) => onChange("enderecoComplemento", v)}
          placeholder="Sala 401, Bloco B…"
          className="md:col-span-3"
        />
        <FieldText
          label="Bairro"
          value={valores.enderecoBairro}
          onChange={(v) => onChange("enderecoBairro", v)}
          className="md:col-span-3"
        />

        <FieldText
          label="Município"
          value={valores.enderecoMunicipio}
          onChange={(v) => onChange("enderecoMunicipio", v)}
          className="md:col-span-4"
        />
        <FieldText
          label="UF"
          value={valores.enderecoUf}
          onChange={(v) => onChange("enderecoUf", v.toUpperCase())}
          placeholder="RS"
          maxLength={2}
          className="md:col-span-2"
        />
      </CardContent>
    </Card>
  );
}
