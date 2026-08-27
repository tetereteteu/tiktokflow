// Seed inicial: cria o usuário admin, uma loja de exemplo e produtos.
// Rode com: npm run db:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@tiktokflow.com";
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "troque-esta-senha";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: await bcrypt.hash(adminPass, 10),
      name: "Admin",
      role: "ADMIN",
    },
  });
  console.log("✓ Admin:", admin.email);

  const store = await prisma.store.upsert({
    where: { slug: "loja-demo" },
    update: {},
    create: {
      name: "Loja Demo",
      slug: "loja-demo",
      description: "Loja de exemplo — troque pelos seus dados.",
      ownerId: admin.id,
      // Preencha com as credenciais reais da Nerva desta loja:
      nervaApiKey: process.env.SEED_NERVA_API_KEY || null,
      nervaWebhookSecret: process.env.SEED_NERVA_WEBHOOK_SECRET || null,
    },
  });
  console.log("✓ Loja:", store.slug);

  const produtos = [
    {
      title: "Produto Exemplo A",
      slug: "produto-a",
      priceCents: 9700,
      compareAtCents: 14700,
    },
    {
      title: "Produto Exemplo B",
      slug: "produto-b",
      priceCents: 19900,
      compareAtCents: null,
    },
  ];

  for (const p of produtos) {
    await prisma.product.upsert({
      where: { storeId_slug: { storeId: store.id, slug: p.slug } },
      update: {},
      create: { ...p, storeId: store.id },
    });
    console.log("  ✓ Produto:", p.title);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
