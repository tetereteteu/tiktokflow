// ─────────────────────────────────────────────────────────────
// Gateways de pagamento.
//
// Hoje existe UM: a Nerva. Esta tela mostra o estado real da
// integração por loja (chave, secret e URL de webhook) e lista os
// gateways ainda não conectados.
//
// Segredo nunca sai do servidor: a tela devolve só booleano de
// "está configurado", nunca a chave — mesmo padrão de
// /painel/lojas (hasNervaKey).
// ─────────────────────────────────────────────────────────────

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";

// Gateways mapeados como próximos passos. Cada um precisa da
// documentação oficial da API antes de virar código: inventar
// campo de cobrança quebra no primeiro Pix real.
const PLANEJADOS = [
  "BlackCat", "D2Bank", "Fastsoftbrasil", "GhostPay", "IronPay",
  "KeyClub", "MagicPay", "Mangofy", "Mercado Pago", "Nitro",
  "Paradise", "Pixo", "Plowf", "PrimeCash Brasil", "Scalefy",
];

export default async function GatewaysPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const where = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const lojas = await prisma.store.findMany({
    where,
    select: { id: true, name: true, nervaApiKey: true, nervaWebhookSecret: true },
    orderBy: { name: "asc" },
  });

  const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  const prontas = lojas.filter((l) => l.nervaApiKey && l.nervaWebhookSecret).length;

  return (
    <PainelShell email={session.email}>
      <div>
        <div className="eyebrow">Checkout</div>
        <h1 className="display" style={{ fontSize: 34 }}>Gateways</h1>
        <p className="muted" style={{ fontSize: 13, margin: "6px 0 18px", maxWidth: 640, lineHeight: 1.6 }}>
          Quem processa a cobrança. A credencial é por loja, não global — cada vitrine pode
          rodar numa conta diferente do gateway.
        </p>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong style={{ color: "var(--gold-soft)" }}>Gateway Nerva</strong>
              <span className="dim" style={{ fontSize: 12.5, marginLeft: 10 }}>
                Pix · {prontas} de {lojas.length} loja(s) prontas para cobrar
              </span>
            </div>
            <span className="badge badge--paid">conectado</span>
          </div>

          {lojas.length === 0 ? (
            <p className="muted" style={{ padding: 18 }}>Nenhuma loja cadastrada ainda.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text-dim)" }}>
                    <th style={th}>Loja</th>
                    <th style={th}>API Key</th>
                    <th style={th}>Webhook secret</th>
                    <th style={th}>URL do webhook</th>
                  </tr>
                </thead>
                <tbody>
                  {lojas.map((l) => (
                    <tr key={l.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={td}>{l.name}</td>
                      <td style={td}>{l.nervaApiKey ? <Ok /> : <Falta />}</td>
                      <td style={td}>{l.nervaWebhookSecret ? <Ok /> : <Falta />}</td>
                      <td style={{ ...td, fontSize: 12 }} className="dim">
                        {base ? `${base}/api/webhooks/nerva/${l.id}` : "defina APP_BASE_URL"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="dim" style={{ fontSize: 12.5, margin: "12px 0 26px", maxWidth: 640, lineHeight: 1.55 }}>
          A chave e o secret são editados em{" "}
          <Link href="/painel/lojas" style={{ color: "var(--gold-soft)" }}>Lojas</Link>. Cadastre a
          URL acima na aba Webhooks do painel do gateway — é ela que confirma o pagamento, e
          sem isso o pedido fica pendente para sempre, mesmo com o Pix pago.
        </p>

        <h2 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 12 }}>
          Ainda não conectados
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxWidth: 700 }}>
          {PLANEJADOS.map((g) => (
            <span key={g} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid var(--border)", fontSize: 13, color: "var(--text-dim)" }}>
              {g}
            </span>
          ))}
        </div>
        <p className="dim" style={{ fontSize: 12.5, marginTop: 14, maxWidth: 640, lineHeight: 1.55 }}>
          Cada um precisa da documentação oficial da API antes de virar código. Campo de
          cobrança inventado não dá erro de compilação — quebra no primeiro Pix real.
        </p>
      </div>
    </PainelShell>
  );
}

const Ok = () => <span style={{ color: "var(--green)" }}>configurado</span>;
const Falta = () => <span className="dim">falta</span>;

const th: React.CSSProperties = { padding: "12px 16px", fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: "12px 16px" };
