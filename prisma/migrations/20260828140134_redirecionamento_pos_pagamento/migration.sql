-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "redirectUrl" TEXT;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "redirectSkipUpsell" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "redirectUrl" TEXT;
