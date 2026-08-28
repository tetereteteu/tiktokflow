-- CreateTable
CREATE TABLE "AdAccountBatch" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "bcIds" TEXT[],
    "alvoPorBc" INTEGER NOT NULL DEFAULT 28,
    "maxTentativas" INTEGER NOT NULL DEFAULT 20,
    "nomePrefixo" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "company" TEXT NOT NULL,
    "industry" INTEGER NOT NULL,
    "registeredArea" TEXT NOT NULL DEFAULT 'BR',
    "contactEmail" TEXT,
    "contactName" TEXT,
    "contactNumber" TEXT,
    "licenseNo" TEXT,
    "qualificationImageIds" TEXT[],
    "promotionLink" TEXT,
    "taxId" TEXT,
    "billingAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RODANDO',
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdAccountBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAccount" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "bcId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "externalAdvertiserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimaClasse" TEXT,
    "ultimoErro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdAccountBatch_storeId_idx" ON "AdAccountBatch"("storeId");

-- CreateIndex
CREATE INDEX "AdAccount_batchId_idx" ON "AdAccount"("batchId");

-- CreateIndex
CREATE INDEX "AdAccount_bcId_idx" ON "AdAccount"("bcId");

-- AddForeignKey
ALTER TABLE "AdAccountBatch" ADD CONSTRAINT "AdAccountBatch_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AdAccountBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
