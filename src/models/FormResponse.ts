import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Respostas dos formulários. Schema flexível pois cada formulário tem campos diferentes.
 * Migração dos Google Forms entra aqui.
 */
const FormResponseSchema = new Schema(
  {
    formSlug: { type: String, required: true, index: true },
    formId: { type: Schema.Types.ObjectId, ref: "FormDefinition" },
    clienteId: { type: String, index: true }, // id do Postgres
    autor: { nome: String, email: String, telefone: String },
    answers: { type: Schema.Types.Mixed, default: {} }, // { key: value }
    files: [{ key: String, url: String, mime: String, size: Number }],
    status: {
      type: String,
      enum: ["RECEBIDO", "EM_ANALISE", "APLICADO", "REJEITADO"],
      default: "RECEBIDO",
      index: true,
    },
    aplicadoEm: Date,
    aplicadoPor: String, // userId
    origem: { type: String, default: "form-publico" }, // ou "import-google"
    googleTimestamp: Date, // para migração dos dados antigos
    ip: String,
    userAgent: String,
  },
  { timestamps: true }
);

FormResponseSchema.index({ formSlug: 1, createdAt: -1 });
FormResponseSchema.index({ clienteId: 1, formSlug: 1 });

export type FormResponse = InferSchemaType<typeof FormResponseSchema>;
export const FormResponseModel =
  models.FormResponse || model("FormResponse", FormResponseSchema);
