/**
 * Validação de CPF e CNPJ com dígitos verificadores.
 * Sem dependências externas — algoritmo oficial da Receita Federal.
 */

export function soDigitos(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

export function isCpfValido(cpf: string): boolean {
  const c = soDigitos(cpf);
  if (c.length !== 11) return false;
  if (/^(\d)\1+$/.test(c)) return false; // 111.111.111-11 é inválido

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(c[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(c[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(c[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === parseInt(c[10]);
}

export function isCnpjValido(cnpj: string): boolean {
  const c = soDigitos(cnpj);
  if (c.length !== 14) return false;
  if (/^(\d)\1+$/.test(c)) return false;

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let soma = 0;
  for (let i = 0; i < 12; i++) soma += parseInt(c[i]) * pesos1[i];
  let resto = soma % 11;
  const d1 = resto < 2 ? 0 : 11 - resto;
  if (d1 !== parseInt(c[12])) return false;

  soma = 0;
  for (let i = 0; i < 13; i++) soma += parseInt(c[i]) * pesos2[i];
  resto = soma % 11;
  const d2 = resto < 2 ? 0 : 11 - resto;
  return d2 === parseInt(c[13]);
}

export function isDocumentoValido(doc: string): boolean {
  const c = soDigitos(doc);
  if (c.length === 11) return isCpfValido(c);
  if (c.length === 14) return isCnpjValido(c);
  return false;
}

export function formatarDocumento(doc: string): string {
  const c = soDigitos(doc);
  if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}
