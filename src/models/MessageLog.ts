import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Log bruto de mensagens enviadas (WhatsApp/e-mail) e respostas recebidas.
 * Útil para auditoria e retentativas.
 */
const MessageLogSchema = new Schema(
  {
    canal: { type: String, enum: ["WHATSAPP", "EMAIL", "SMS"], required: true },
    direcao: { type: String, enum: ["OUT", "IN"], required: true, index: true },
    clienteId: { type: String, index: true },
    execucaoReguaId: String,
    para: String, // telefone ou email
    de: String,
    assunto: String,
    conteudo: String,
    provider: { type: String, default: "digisac" },
    providerMessageId: { type: String, index: true },
    providerPayload: Schema.Types.Mixed, // resposta crua do provider
    status: {
      type: String,
      enum: ["ENVIANDO", "ENVIADO", "ENTREGUE", "LIDA", "ERRO", "RECEBIDO"],
      default: "ENVIANDO",
      index: true,
    },
    erro: String,
  },
  { timestamps: true }
);

MessageLogSchema.index({ createdAt: -1 });

export type MessageLog = InferSchemaType<typeof MessageLogSchema>;
export const MessageLogModel =
  models.MessageLog || model("MessageLog", MessageLogSchema);
