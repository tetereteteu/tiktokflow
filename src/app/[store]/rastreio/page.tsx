// ─────────────────────────────────────────────────────────────
// Consulta pública de rastreio: /{loja}/rastreio?codigo=XXX
//
// Devolve só o andamento da entrega. Nada de nome, e-mail, CPF ou
// telefone do comprador: quem digita um código não é necessariamente
// quem comprou, e um código pode ser adivinhado.
//
// A busca é limitada à loja da URL — código de uma loja não pode
// revelar pedido de outra.
// ─────────────────────────────────────────────────────────────

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function RastreioPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ codigo?: string }>;
}) {
  const { store: slug } = await params;
  const { codigo: bruto } = await searchParams;
  const codigo = (bruto ?? "").trim().toUpperCase();

  const store = await prisma.store.findFirst({
    where: { slug, active: true },
    select: { id: true, name: true, slug: true },
  });
  if (!store) notFound();

  const envio = codigo
    ? await prisma.shipment.findFirst({
        where: { codigo, order: { storeId: store.id } },
        select: {
          codigo: true,
          transportadora: true,
          url: true,
          createdAt: true,
          order: {
            select: { status: true, paidAt: true, shippingName: true, product: { select: { title: true } } },
          },
        },
      })
    : null;

  return (
    <main className="wrap" style={{ maxWidth: 520, paddingBottom: 60 }}>
      <header style={{ padding: "48px 0 24px", textAlign: "center" }}>
        <div className="eyebrow">{store.name}</div>
        <h1 className="display" style={{ fontSize: "clamp(34px, 7vw, 54px)", marginTop: 8 }}>
          Rastrear pedido
        </h1>
      </header>

      <form method="GET" className="card" style={{ padding: 18, marginBottom: 18 }}>
        <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>
          Código de rastreio
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" name="codigo" defaultValue={codigo}
            placeholder="AA123456789BR" style={{ flex: 1 }} />
          <button className="btn btn--gold" type="submit" style={{ width: "auto", padding: "0 18px" }}>
            Buscar
          </button>
        </div>
      </form>

      {codigo && !envio && (
        <div className="card">
          <p className="muted" style={{ fontSize: 14 }}>
            Nenhuma entrega encontrada com esse código nesta loja. Confira se digitou certo —
            o código é enviado quando o pedido é despachado.
          </p>
        </div>
      )}

      {envio && (
        <div className="card" style={{ padding: 20 }}>
          <div className="eyebrow">Em transporte</div>
          <h2 className="display" style={{ fontSize: 26, margin: "6px 0 14px" }}>
            {envio.order.product.title}
          </h2>

          <Linha rotulo="Código" valor={envio.codigo} destaque />
          <Linha rotulo="Transportadora" valor={envio.transportadora} />
          {envio.order.shippingName && <Linha rotulo="Modalidade" valor={envio.order.shippingName} />}
          <Linha
            rotulo="Despachado em"
            valor={envio.createdAt.toLocaleDateString("pt-BR")}
          />

          {envio.url && (
            <a className="btn btn--gold" href={envio.url} target="_blank" rel="noreferrer"
              style={{ marginTop: 16, display: "inline-block" }}>
              Acompanhar na transportadora
            </a>
          )}
        </div>
      )}

      <footer style={{ marginTop: 40, textAlign: "center", fontSize: 12, color: "var(--text-dim)" }}>
        {store.name}
      </footer>
    </main>
  );
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
      <span className="dim" style={{ fontSize: 13 }}>{rotulo}</span>
      <span style={{ fontSize: 14, fontWeight: destaque ? 700 : 500, color: destaque ? "var(--gold)" : "var(--text)" }}>
        {valor}
      </span>
    </div>
  );
}
