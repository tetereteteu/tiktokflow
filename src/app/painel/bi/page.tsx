// ─────────────────────────────────────────────────────────────
// BI — cruza receita (pedidos) com custo (AdSpend) pra mostrar
// LUCRO, e não só faturamento. Toda a agregação acontece aqui, no
// servidor: o client só desenha.
//
// Dinheiro em centavos até a hora de formatar, como no resto do app.
// ─────────────────────────────────────────────────────────────
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";
import BiClient from "./BiClient";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export default async function BiPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; loja?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/painel/login");
  const sp = await searchParams;

  const dias = [7, 30, 90].includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const where = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const lojas = await prisma.store.findMany({
    where, orderBy: { createdAt: "desc" }, select: { id: true, name: true },
  });
  const lojaId = sp.loja && lojas.some((l) => l.id === sp.loja) ? sp.loja : null;
  const storeIds = lojaId ? [lojaId] : lojas.map((l) => l.id);

  // janela fechada em dias inteiros, pra bater com a granularidade do AdSpend
  const hoje = new Date();
  const inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  inicio.setUTCDate(inicio.getUTCDate() - (dias - 1));

  const [pedidos, gastos] = await Promise.all([
    prisma.order.findMany({
      where: { storeId: { in: storeIds }, createdAt: { gte: inicio } },
      select: {
        status: true, amountCents: true, netCents: true, createdAt: true, paidAt: true,
        utmSource: true, utmCampaign: true,
        product: { select: { id: true, title: true } },
      },
    }),
    prisma.adSpend.findMany({
      where: { storeId: { in: storeIds }, date: { gte: inicio } },
      select: { date: true, spendCents: true, clicks: true, impressions: true },
    }),
  ]);

  const pagos = pedidos.filter((p) => p.status === "PAID");
  const receitaCents = pagos.reduce((a, p) => a + p.amountCents, 0);
  const liquidoCents = pagos.reduce((a, p) => a + (p.netCents ?? p.amountCents), 0);
  const gastoCents = gastos.reduce((a, g) => a + g.spendCents, 0);
  const cliques = gastos.reduce((a, g) => a + g.clicks, 0);

  // série diária: receita pela data do PAGAMENTO (é quando o dinheiro
  // entra), gasto pela data do relatório de anúncio.
  const dia: Record<string, { receita: number; gasto: number }> = {};
  for (let i = 0; i < dias; i++) {
    const d = new Date(inicio);
    d.setUTCDate(d.getUTCDate() + i);
    dia[ymd(d)] = { receita: 0, gasto: 0 };
  }
  for (const p of pagos) {
    const k = ymd(p.paidAt ?? p.createdAt);
    if (dia[k]) dia[k].receita += p.amountCents;
  }
  for (const g of gastos) {
    const k = ymd(g.date);
    if (dia[k]) dia[k].gasto += g.spendCents;
  }
  const serie = Object.entries(dia).map(([data, v]) => ({ data, ...v }));

  // receita por produto
  const porProduto: Record<string, { titulo: string; receita: number; qtd: number }> = {};
  for (const p of pagos) {
    const k = p.product.id;
    porProduto[k] ??= { titulo: p.product.title, receita: 0, qtd: 0 };
    porProduto[k].receita += p.amountCents;
    porProduto[k].qtd += 1;
  }
  const produtos = Object.values(porProduto).sort((a, b) => b.receita - a.receita).slice(0, 8);

  // origem do tráfego — muitas categorias, então vira tabela
  const porOrigem: Record<string, { pedidos: number; pagos: number; receita: number }> = {};
  for (const p of pedidos) {
    const k = [p.utmSource || "direto", p.utmCampaign || "—"].join(" · ");
    porOrigem[k] ??= { pedidos: 0, pagos: 0, receita: 0 };
    porOrigem[k].pedidos += 1;
    if (p.status === "PAID") { porOrigem[k].pagos += 1; porOrigem[k].receita += p.amountCents; }
  }
  const origens = Object.entries(porOrigem)
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 10);

  const contagem = (s: string) => pedidos.filter((p) => p.status === s).length;
  const valores = pagos.map((p) => p.amountCents);

  return (
    <PainelShell email={session.email}>
      <BiClient
        dias={dias}
        lojas={lojas}
        lojaId={lojaId}
        resumo={{
          receitaCents, liquidoCents, gastoCents,
          lucroCents: liquidoCents - gastoCents,
          pedidos: pedidos.length,
          pagos: pagos.length,
          cliques,
          ticketCents: pagos.length ? Math.round(receitaCents / pagos.length) : 0,
          maiorCents: valores.length ? Math.max(...valores) : 0,
          menorCents: valores.length ? Math.min(...valores) : 0,
          pendentes: contagem("PENDING"),
          expirados: contagem("EXPIRED"),
          estornados: contagem("REFUNDED"),
        }}
        serie={serie}
        produtos={produtos}
        origens={origens}
      />
    </PainelShell>
  );
}
