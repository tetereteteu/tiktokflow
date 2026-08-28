import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";
import CopyPix from "./CopyPix";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function RecuperacaoPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const storeWhere = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const stores = await prisma.store.findMany({ where: storeWhere, select: { id: true } });
  const storeIds = stores.map((s) => s.id);

  // pendentes das últimas 48h com dados de contato
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const pendentes = await prisma.order.findMany({
    where: {
      storeId: { in: storeIds },
      status: "PENDING",
      createdAt: { gte: since },
    },
    include: { product: { select: { title: true } }, store: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <PainelShell email={session.email}>
      <div>
        <div className="eyebrow">Conversão</div>
        <h1 className="display" style={{ fontSize: 34 }}>Recuperação</h1>
        <p className="muted" style={{ fontSize: 13, margin: "6px 0 18px", maxWidth: 620 }}>
          Pedidos que geraram Pix mas ainda não pagaram (últimas 48h). Use o contato pra
          chamar o cliente no WhatsApp e reenviar o código Pix. Assim que o pagamento cair,
          o pedido sai daqui automaticamente.
        </p>

        {pendentes.length === 0 ? (
          <div className="card"><p className="muted">Nenhum pendente recente. 👌</p></div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text-dim)" }}>
                    <th style={th}>Cliente</th>
                    <th style={th}>Contato</th>
                    <th style={th}>Produto</th>
                    <th style={th}>Valor</th>
                    <th style={th}>Há</th>
                    <th style={th}>Pix</th>
                  </tr>
                </thead>
                <tbody>
                  {pendentes.map((o) => {
                    const mins = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
                    const tempo = mins < 60 ? `${mins}min` : `${Math.floor(mins / 60)}h`;
                    return (
                      <tr key={o.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={td}>{o.customerName || "—"}</td>
                        <td style={td} className="muted">{o.customerEmail || o.customerDocument}</td>
                        <td style={td}>{o.product.title}</td>
                        <td style={td}>{brl(o.amountCents)}</td>
                        <td style={td} className="dim">{tempo}</td>
                        <td style={td}>
                          {o.pixCode ? (
                            <CopyPix code={o.pixCode} />
                          ) : (
                            <span className="dim">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PainelShell>
  );
}

// pequeno client pra copiar o pix da linha — em ./CopyPix.tsx

const th: React.CSSProperties = { padding: "12px 16px", fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: "12px 16px" };
