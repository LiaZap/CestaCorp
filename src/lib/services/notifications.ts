import { connectMongo } from "@/lib/db/mongo";
import { NotificationModel } from "@/models/Notification";

export interface CreateNotificationInput {
  tipo:
    | "FORM_RECEBIDO"
    | "COBRANCA_ATRASADA"
    | "COBRANCA_PAGA"
    | "REGUA_ERRO"
    | "REAJUSTE_MES"
    | "CLIENTE_PROSPECT"
    | "SISTEMA";
  titulo: string;
  descricao?: string;
  href?: string;
  userId?: string;
  clienteId?: string;
  priority?: "LOW" | "NORMAL" | "HIGH";
  metadata?: any;
}

export async function notificar(input: CreateNotificationInput) {
  await connectMongo();
  return NotificationModel.create({ ...input });
}

export async function listarNotificacoes(userId: string, opts?: { unreadOnly?: boolean; limit?: number }) {
  await connectMongo();
  const filter: any = { $or: [{ userId: null }, { userId }] };
  if (opts?.unreadOnly) filter.lidaPor = { $ne: userId };
  return NotificationModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(opts?.limit ?? 30)
    .lean();
}

export async function contarNaoLidas(userId: string) {
  await connectMongo();
  return NotificationModel.countDocuments({
    $or: [{ userId: null }, { userId }],
    lidaPor: { $ne: userId },
  });
}

export async function marcarComoLida(id: string, userId: string) {
  await connectMongo();
  return NotificationModel.updateOne({ _id: id }, { $addToSet: { lidaPor: userId } });
}

export async function marcarTodasComoLidas(userId: string) {
  await connectMongo();
  return NotificationModel.updateMany(
    { $or: [{ userId: null }, { userId }], lidaPor: { $ne: userId } },
    { $addToSet: { lidaPor: userId } }
  );
}
