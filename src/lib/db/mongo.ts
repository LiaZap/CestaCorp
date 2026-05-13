import mongoose from "mongoose";

/**
 * Lazy check da env var: só falha quando alguém tentar conectar de verdade,
 * não no import. Isso permite que o `next build` rode sem MONGODB_URI no
 * ambiente — só rotas que chamam connectMongo() em runtime falharão se a
 * env não estiver setada em produção.
 */

type Cached = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const globalForMongoose = globalThis as unknown as { mongoose: Cached };

const cached: Cached = globalForMongoose.mongoose ?? { conn: null, promise: null };
globalForMongoose.mongoose = cached;

export async function connectMongo() {
  if (cached.conn) return cached.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI não definida — configure a variável de ambiente em produção.");
  }
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, { bufferCommands: false });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
