import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Envios em lote agendados.
 * Um documento = uma campanha agendada para uma data/hora específica.
 * A rotina diária (regua-cobranca.ts) consome os que têm `agendadoPara <= agora`.
 */
const EnvioAgendadoSchema = new Schema(
  {
    titulo: String,
    criadoPor: String, // userId
    agendadoPara: { type: Date, required: true, index: true },
    template: { type: String, required: true },
    canal: { type: String, enum: ["WHATSAPP", "EMAIL"], default: "WHATSAPP" },
    alvos: [{
      clienteId: String,
      cobrancaId: String,
      razaoSocial: String,
      telefone: String,
    }],
    status: {
      type: String,
      enum: ["AGENDADO", "EM_EXECUCAO", "CONCLUIDO", "CANCELADO", "ERRO"],
      default: "AGENDADO",
      index: true,
    },
    resultado: {
      sucesso: { type: Number, default: 0 },
      erro: { type: Number, default: 0 },
      detalhes: [{ clienteId: String, ok: Boolean, erro: String }],
    },
    executadoEm: Date,
  },
  { timestamps: true }
);

export type EnvioAgendado = InferSchemaType<typeof EnvioAgendadoSchema>;
export const EnvioAgendadoModel =
  models.EnvioAgendado || model("EnvioAgendado", EnvioAgendadoSchema);
