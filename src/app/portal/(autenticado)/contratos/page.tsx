import { redirect } from "next/navigation";

/**
 * #95: /portal/contratos foi substituído por /portal/documentos?tipo=contrato.
 * Mantido como redirect pra emails antigos / bookmarks dos clientes.
 */
export default function PortalContratosRedirect() {
  redirect("/portal/documentos?tipo=contrato");
}
