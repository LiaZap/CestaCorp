import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Notificações internas para a equipe Cestacorp.
 * Geradas automaticamente (form novo, cobrança atrasada, erro na régua, etc.).
 * Podem ser direcionadas a todos (userId = null) ou a um usuário específico.
 */
const NotificationSchema = new Schema(
  {
    tipo: {
      type: String,
      enum: [
        "FORM_RECEBIDO",
        "COBRANCA_ATRASADA",
        "COBRANCA_PAGA",
        "REGUA_ERRO",
        "REAJUSTE_MES",
        "CLIENTE_PROSPECT",
        "SISTEMA",
      ],
      required: true,
      index: true,
    },
    titulo: { type: String, required: true },
    descricao: String,
    href: String,       // link destino (ex.: "/formularios/abc123")
    userId: { type: String, index: true }, // null = para toda a equipe
    clienteId: { type: String, index: true },
    lidaPor: [String],  // array de userIds que já leram
    metadata: Schema.Types.Mixed,
    priority: { type: String, enum: ["LOW", "NORMAL", "HIGH"], default: "NORMAL" },
  },
  { timestamps: true }
);

NotificationSchema.index({ createdAt: -1 });

export type Notification = InferSchemaType<typeof NotificationSchema>;
export const NotificationModel =
  models.Notification || model("Notification", NotificationSchema);
