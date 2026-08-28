// Painel admin — lista de pedidos + resumo. Exige sessão.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import PainelShell from "./PainelShell";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const STATUS_LABEL: Record<string, string> = {
  PAID: "Pago",
  PENDING: "Pendente",
  FAILED: "Falhou",
  EXPIRED: "Expirado",
  REFUNDED: "Estornado",
};

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; store?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const sp = await searchParams;

  // ADMIN vê tudo; OWNER vê só as próprias lojas
  const storeFilter: Prisma.StoreWhereInput =
    session.role === "ADMIN" ? {} : { ownerId: session.userId };

  const stores = await prisma.store.findMany({
    where: storeFilter,
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
  const storeIds = stores.map((s) => s.id);

  const where: Prisma.OrderWhereInput = {
    storeId: { in: storeIds },
    ...(sp.status ? { status: sp.status as never } : {}),
    ...(sp.store ? { storeId: sp.store } : {}),
  };

  const [orders, paidAgg, pendingCount] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { product: { select: { title: true } }, store: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.order.aggregate({
      where: { storeId: { in: storeIds }, status: "PAID" },
      _sum: { amountCents: true, netCents: true },
      _count: true,
    }),
    prisma.order.count({
      where: { storeId: { in: storeIds }, status: "PENDING" },
    }),
  ]);

  const totalBruto = paidAgg._sum.amountCents ?? 0;
  const totalLiquido = paidAgg._sum.netCents ?? 0;
  const totalVendas = paidAgg._count;

  return (
    <PainelShell email={session.email}>

      {/* KPIs */}
      <section
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          marginBottom: 22,
        }}
      >
        <Kpi label="Faturamento (pago)" value={brl(totalBruto)} highlight />
        <Kpi label="Líquido recebido" value={brl(totalLiquido)} />
        <Kpi label="Vendas pagas" value={String(totalVendas)} />
        <Kpi label="Pendentes" value={String(pendingCount)} />
      </section>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <FilterLink label="Todos" href="/painel" active={!sp.status} />
        <FilterLink label="Pagos" href="/painel?status=PAID" active={sp.status === "PAID"} />
        <FilterLink
          label="Pendentes"
          href="/painel?status=PENDING"
          active={sp.status === "PENDING"}
        />
        <FilterLink
          label="Falhos"
          href="/painel?status=FAILED"
          active={sp.status === "FAILED"}
        />
      </div>

      {/* Tabela de pedidos */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {orders.length === 0 ? (
          <p className="muted" style={{ padding: 28, textAlign: "center" }}>
            Nenhum pedido ainda. As vendas aparecem aqui em tempo real.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-dim)" }}>
                  <Th>Cliente</Th>
                  <Th>Produto</Th>
                  <Th>Loja</Th>
                  <Th>Valor</Th>
                  <Th>Status</Th>
                  <Th>Data</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <Td>
                      <div style={{ fontWeight: 500 }}>
                        {o.customerName || "—"}
                      </div>
                      <div className="dim" style={{ fontSize: 12 }}>
                        {o.customerEmail || o.customerDocument}
                      </div>
                    </Td>
                    <Td>{o.product.title}</Td>
                    <Td className="muted">{o.store.name}</Td>
                    <Td>{brl(o.amountCents)}</Td>
                    <Td>
                      <span className={`badge badge--${o.status.toLowerCase()}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </Td>
                    <Td className="dim">
                      {new Date(o.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PainelShell>
  );
}

function Kpi({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: highlight ? "var(--gold)" : "var(--text)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FilterLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      style={{
        padding: "7px 14px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 500,
        border: "1px solid var(--border)",
        background: active ? "var(--gold-dim)" : "var(--bg-card)",
        color: active ? "var(--gold)" : "var(--text-muted)",
      }}
    >
      {label}
    </a>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ padding: "12px 16px", fontWeight: 600, fontSize: 12 }}>
      {children}
    </th>
  );
}
function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={className} style={{ padding: "12px 16px" }}>
      {children}
    </td>
  );
}
