import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Formulários dinâmicos (substituem os Google Forms).
 * Cada FormDefinition define campos, validações e mapeamento para Cliente/Sócio.
 */

const FieldSchema = new Schema(
  {
    key: { type: String, required: true },          // ex.: "razaoSocial"
    label: { type: String, required: true },        // rótulo no formulário
    type: {
      type: String,
      enum: [
        "text", "textarea", "email", "phone", "cpf", "cnpj",
        "date", "number", "money", "select", "multiselect",
        "radio", "checkbox", "file", "section",
      ],
      required: true,
    },
    required: { type: Boolean, default: false },
    helpText: String,
    placeholder: String,
    options: [{ label: String, value: String }],
    validation: {
      minLength: Number,
      maxLength: Number,
      min: Number,
      max: Number,
      regex: String,
    },
    // Autoalimentação: qual campo do Cliente/Sócio preencher automaticamente
    mapping: {
      entity: { type: String, enum: ["cliente", "socio", "contato", "endereco"] },
      field: String,
    },
    // Exibir condicionalmente
    showIf: { field: String, equals: Schema.Types.Mixed },
  },
  { _id: false }
);

const FormDefinitionSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: String,
    category: {
      type: String,
      enum: [
        "abertura-empresa", "alteracao-empresa",
        "abertura-mei", "alteracao-mei",
        "socios", "carne-leao",
        "esocial-domestico", "gps-avulsa",
        "outros",
      ],
      required: true,
    },
    fields: [FieldSchema],
    active: { type: Boolean, default: true },
    autoFillFromClienteId: { type: Boolean, default: true },
    notifyEmails: [String],
  },
  { timestamps: true }
);

export type FormDefinition = InferSchemaType<typeof FormDefinitionSchema>;
export const FormDefinitionModel =
  models.FormDefinition || model("FormDefinition", FormDefinitionSchema);
