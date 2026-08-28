// ─────────────────────────────────────────────────────────────
// Lote de criação de contas de anúncio.
//
// POST  cria o lote e dispara em segundo plano
// GET   progresso do lote (a tela consulta daqui)
// PATCH para o lote em andamento
//
// O POST não espera o lote terminar: com as esperas entre
// tentativas ele pode levar horas. Responde na hora com o id e o
// trabalho segue solto, igual ao disparo da Conversions API no
// webhook.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canManageStore } from "@/lib/admin";
import { rodarLote } from "@/lib/contas-em-massa";

const TETO_ALVO = 100; // guarda contra alvo digitado errado (ex: 2800)

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const storeId = String(b.storeId ?? "");
  if (!storeId || !(await canManageStore(session, storeId)))
    return NextResponse.json({ error: "Sem acesso a esta loja" }, { status: 403 });

  const brutos: string[] = Array.isArray(b.bcIds)
    ? b.bcIds.map((x: unknown) => String(x).trim()).filter((v: string) => v.length > 0)
    : [];
  const bcIds = Array.from(new Set<string>(brutos)); // BC repetido criaria conta a mais
  if (bcIds.length === 0)
    return NextResponse.json({ error: "Informe ao menos um Business Center" }, { status: 400 });

  const obrigatorios = ["nomePrefixo", "company", "industry"] as const;
  for (const c of obrigatorios) {
    if (!b[c]) return NextResponse.json({ error: `Campo obrigatório: ${c}` }, { status: 400 });
  }

  const alvoPorBc = Math.min(Math.max(Number(b.alvoPorBc) || 28, 1), TETO_ALVO);
  const maxTentativas = Math.min(Math.max(Number(b.maxTentativas) || 20, 1), 500);

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { tiktokBusinessToken: true },
  });
  if (!store?.tiktokBusinessToken)
    return NextResponse.json(
      { error: "Cadastre o token de Marketing API do TikTok nesta loja antes." },
      { status: 400 },
    );

  // Um lote rodando por vez na mesma loja: dois lotes disputando o
  // mesmo BC criam conta a mais e brigam pela cota.
  const rodando = await prisma.adAccountBatch.findFirst({
    where: { storeId, status: "RODANDO" },
    select: { id: true },
  });
  if (rodando)
    return NextResponse.json(
      { error: "Já existe um lote rodando nesta loja.", batchId: rodando.id },
      { status: 409 },
    );

  const lote = await prisma.adAccountBatch.create({
    data: {
      storeId,
      bcIds,
      alvoPorBc,
      maxTentativas,
      nomePrefixo: String(b.nomePrefixo),
      currency: String(b.currency || "BRL"),
      timezone: String(b.timezone || "America/Sao_Paulo"),
      company: String(b.company),
      industry: Number(b.industry),
      registeredArea: String(b.registeredArea || "BR"),
      contactEmail: b.contactEmail ? String(b.contactEmail) : null,
      contactName: b.contactName ? String(b.contactName) : null,
      contactNumber: b.contactNumber ? String(b.contactNumber) : null,
      licenseNo: b.licenseNo ? String(b.licenseNo) : null,
      qualificationImageIds: Array.isArray(b.qualificationImageIds)
        ? b.qualificationImageIds.map((x: unknown) => String(x)).filter(Boolean)
        : [],
      promotionLink: b.promotionLink ? String(b.promotionLink) : null,
      taxId: b.taxId ? String(b.taxId) : null,
      billingAddress: b.billingAddress ? String(b.billingAddress) : null,
    },
    select: { id: true },
  });

  void rodarLote(lote.id);

  return NextResponse.json({ batchId: lote.id });
}

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const batchId = req.nextUrl.searchParams.get("batchId");
  if (!batchId) return NextResponse.json({ error: "Informe batchId" }, { status: 400 });

  const lote = await prisma.adAccountBatch.findUnique({
    where: { id: batchId },
    include: { contas: { orderBy: { createdAt: "asc" } } },
  });
  if (!lote) return NextResponse.json({ error: "Lote não encontrado" }, { status: 404 });
  if (!(await canManageStore(session, lote.storeId)))
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });

  return NextResponse.json({
    id: lote.id,
    status: lote.status,
    bcIds: lote.bcIds,
    alvoPorBc: lote.alvoPorBc,
    observacao: lote.observacao,
    criadas: lote.contas.filter((c) => c.status === "CRIADA").length,
    comErro: lote.contas.filter((c) => c.status === "ERRO").length,
    tentando: lote.contas.filter((c) => c.status === "PENDENTE").length,
    contas: lote.contas.map((c) => ({
      id: c.id,
      bcId: c.bcId,
      nome: c.nome,
      status: c.status,
      tentativas: c.tentativas,
      classe: c.ultimaClasse,
      erro: c.ultimoErro,
      advertiserId: c.externalAdvertiserId,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { batchId } = await req.json().catch(() => ({}));
  const lote = await prisma.adAccountBatch.findUnique({
    where: { id: String(batchId ?? "") },
    select: { id: true, storeId: true, status: true },
  });
  if (!lote) return NextResponse.json({ error: "Lote não encontrado" }, { status: 404 });
  if (!(await canManageStore(session, lote.storeId)))
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });

  // O motor lê este status a cada tentativa e encerra sozinho.
  if (lote.status === "RODANDO")
    await prisma.adAccountBatch.update({ where: { id: lote.id }, data: { status: "PARADO" } });

  return NextResponse.json({ ok: true });
}
