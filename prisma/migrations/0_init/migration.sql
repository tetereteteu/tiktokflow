-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AdPlatform" AS ENUM ('TIKTOK', 'META', 'MANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nervaApiKey" TEXT,
    "nervaWebhookSecret" TEXT,
    "metaPixelId" TEXT,
    "tiktokPixelId" TEXT,
    "googleAdsId" TEXT,
    "tiktokAdvertiserId" TEXT,
    "tiktokBusinessToken" TEXT,
    "tiktokBcId" TEXT,
    "tiktokCatalogId" TEXT,
    "capiOwn" BOOLEAN NOT NULL DEFAULT false,
    "metaAccessToken" TEXT,
    "metaTestEventCode" TEXT,
    "tiktokAccessToken" TEXT,
    "tiktokTestEventCode" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "compareAtCents" INTEGER,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "customerDocument" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "feeCents" INTEGER,
    "netCents" INTEGER,
    "bumpId" TEXT,
    "isUpsell" BOOLEAN NOT NULL DEFAULT false,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "fbclid" TEXT,
    "ttclid" TEXT,
    "gclid" TEXT,
    "fbp" TEXT,
    "fbc" TEXT,
    "clientIp" TEXT,
    "clientUa" TEXT,
    "nervaSaleId" TEXT,
    "nervaTxId" TEXT,
    "pixCode" TEXT,
    "pixQrCodeUrl" TEXT,
    "metaCapiAt" TIMESTAMP(3),
    "metaCapiError" TEXT,
    "tiktokCapiAt" TIMESTAMP(3),
    "tiktokCapiError" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderBump" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderBump_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upsell" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "compareAtCents" INTEGER,
    "imageUrl" TEXT,
    "productId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Upsell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutTheme" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "brandColor" TEXT NOT NULL DEFAULT '#d4a012',
    "bgColor" TEXT NOT NULL DEFAULT '#08080b',
    "cardColor" TEXT NOT NULL DEFAULT '#14141c',
    "textColor" TEXT NOT NULL DEFAULT '#f4f4f7',
    "radiusPx" INTEGER NOT NULL DEFAULT 14,
    "bannerDesktopUrl" TEXT,
    "bannerMobileUrl" TEXT,
    "noticeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "noticeText" TEXT,
    "noticeBg" TEXT NOT NULL DEFAULT '#d4a012',
    "noticeColor" TEXT NOT NULL DEFAULT '#08080b',
    "countdownEnabled" BOOLEAN NOT NULL DEFAULT false,
    "countdownMinutes" INTEGER NOT NULL DEFAULT 15,
    "countdownText" TEXT NOT NULL DEFAULT 'Oferta reservada por',
    "socialProofEnabled" BOOLEAN NOT NULL DEFAULT false,
    "socialProofText" TEXT,
    "socialProofAvatars" BOOLEAN NOT NULL DEFAULT true,
    "badgesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ctaText" TEXT NOT NULL DEFAULT 'Pagar {valor}',
    "footerText" TEXT,
    "customCss" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "platform" "AdPlatform" NOT NULL DEFAULT 'TIKTOK',
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "budgetCents" INTEGER NOT NULL,
    "productId" TEXT,
    "externalCampaignId" TEXT,
    "externalAdgroupId" TEXT,
    "externalAdId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CRIANDO',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSpend" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "platform" "AdPlatform" NOT NULL DEFAULT 'TIKTOK',
    "date" DATE NOT NULL,
    "externalCampaignId" TEXT NOT NULL DEFAULT '',
    "spendCents" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdSpend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Store_domain_key" ON "Store"("domain");

-- CreateIndex
CREATE INDEX "Store_ownerId_idx" ON "Store"("ownerId");

-- CreateIndex
CREATE INDEX "Product_storeId_idx" ON "Product"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_storeId_slug_key" ON "Product"("storeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Order_nervaSaleId_key" ON "Order"("nervaSaleId");

-- CreateIndex
CREATE INDEX "Order_storeId_idx" ON "Order"("storeId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_nervaSaleId_idx" ON "Order"("nervaSaleId");

-- CreateIndex
CREATE INDEX "OrderBump_storeId_idx" ON "OrderBump"("storeId");

-- CreateIndex
CREATE INDEX "Upsell_storeId_idx" ON "Upsell"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutTheme_storeId_key" ON "CheckoutTheme"("storeId");

-- CreateIndex
CREATE INDEX "AdCampaign_storeId_idx" ON "AdCampaign"("storeId");

-- CreateIndex
CREATE INDEX "AdSpend_storeId_date_idx" ON "AdSpend"("storeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AdSpend_storeId_platform_date_externalCampaignId_key" ON "AdSpend"("storeId", "platform", "date", "externalCampaignId");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_bumpId_fkey" FOREIGN KEY ("bumpId") REFERENCES "OrderBump"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBump" ADD CONSTRAINT "OrderBump_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upsell" ADD CONSTRAINT "Upsell_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upsell" ADD CONSTRAINT "Upsell_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutTheme" ADD CONSTRAINT "CheckoutTheme_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSpend" ADD CONSTRAINT "AdSpend_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

