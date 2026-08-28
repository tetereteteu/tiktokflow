-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shippingName" TEXT,
ADD COLUMN     "shippingRateId" TEXT;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "faturaDescricao" TEXT,
ADD COLUMN     "freteGratisAcimaCents" INTEGER,
ADD COLUMN     "pixExpiraSegundos" INTEGER NOT NULL DEFAULT 3600;

-- CreateTable
CREATE TABLE "ShippingRate" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "prazoDias" INTEGER NOT NULL DEFAULT 0,
    "priceCents" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "transportadora" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShippingRate_storeId_idx" ON "ShippingRate"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_codigo_idx" ON "Shipment"("codigo");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingRateId_fkey" FOREIGN KEY ("shippingRateId") REFERENCES "ShippingRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
