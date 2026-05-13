-- CreateTable
CREATE TABLE "cliente_acessos" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "password" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "tokenConvite" TEXT,
    "tokenConviteExpira" TIMESTAMP(3),
    "tokenReset" TEXT,
    "tokenResetExpira" TIMESTAMP(3),
    "ultimoAcesso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cliente_acessos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cliente_acessos_email_key" ON "cliente_acessos"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_acessos_tokenConvite_key" ON "cliente_acessos"("tokenConvite");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_acessos_tokenReset_key" ON "cliente_acessos"("tokenReset");

-- CreateIndex
CREATE INDEX "cliente_acessos_clienteId_idx" ON "cliente_acessos"("clienteId");

-- AddForeignKey
ALTER TABLE "cliente_acessos" ADD CONSTRAINT "cliente_acessos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
