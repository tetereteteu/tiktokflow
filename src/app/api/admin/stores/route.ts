import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, slugify } from "@/lib/admin";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const where = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const stores = await prisma.store.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { products: true, orders: true } } },
  });
  return NextResponse.json({ stores });
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  if (!b.name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const slug = b.slug ? slugify(b.slug) : slugify(b.name);
  const exists = await prisma.store.findUnique({ where: { slug } });
  if (exists) return NextResponse.json({ error: "Slug já em uso" }, { status: 409 });

  const store = await prisma.store.create({
    data: {
      name: b.name,
      slug,
      description: b.description || null,
      domain: b.domain || null,
      ownerId: session.userId,
      nervaApiKey: b.nervaApiKey || null,
      nervaWebhookSecret: b.nervaWebhookSecret || null,
      metaPixelId: b.metaPixelId || null,
      tiktokPixelId: b.tiktokPixelId || null,
      googleAdsId: b.googleAdsId || null,
    },
  });
  return NextResponse.json({ store });
}
