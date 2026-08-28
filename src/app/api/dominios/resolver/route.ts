// ─────────────────────────────────────────────────────────────
// Resolve host -> slug da loja, para o middleware.
//
// Existe como rota porque o middleware do Next roda no edge, onde o
// Prisma não funciona. O middleware chama aqui e guarda o resultado
// num cache curto, então isto não é uma consulta por requisição.
//
// Devolve só o slug — que já é público, aparece na URL da vitrine.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const host = (req.nextUrl.searchParams.get("host") ?? "")
    .toLowerCase()
    .trim()
    .replace(/^www\./, "");

  if (!host) return NextResponse.json({ slug: null }, { status: 400 });

  const loja = await prisma.store.findFirst({
    where: { domain: host, active: true },
    select: { slug: true },
  });

  return NextResponse.json(
    { slug: loja?.slug ?? null },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
