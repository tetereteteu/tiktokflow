// ─────────────────────────────────────────────────────────────
// Central de pixels: visão consolidada de todas as lojas.
//
// Leitura apenas — a edição continua em /painel/lojas, que é onde
// mora o formulário. O valor aqui é ver de uma vez quem está com
// rastreamento incompleto, em vez de abrir loja por loja.
//
// Tokens nunca são enviados ao browser: só o booleano de presença.
// ─────────────────────────────────────────────────────────────

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";

export default async function PixelsPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const where = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const lojas = await prisma.store.findMany({
    where,
    select: {
      id: true, name: true,
      metaPixelId: true, tiktokPixelId: true, googleAdsId: true,
      capiOwn: true, metaAccessToken: true, tiktokAccessToken: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <PainelShell email={session.email}>
      <div>
        <div className="eyebrow">Marketing</div>
        <h1 className="display" style={{ fontSize: 34 }}>Pixels</h1>
        <p className="muted" style={{ fontSize: 13, margin: "6px 0 18px", maxWidth: 660, lineHeight: 1.6 }}>
          Rastreamento de cada loja, no browser e no servidor. Loja sem pixel roda anúncio
          às cegas: a plataforma não recebe a conversão e não consegue otimizar.
        </p>

        {lojas.length === 0 ? (
          <div className="card"><p className="muted">Nenhuma loja cadastrada ainda.</p></div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text-dim)" }}>
                    <th style={th}>Loja</th>
                    <th style={th}>Meta Pixel</th>
                    <th style={th}>TikTok Pixel</th>
                    <th style={th}>Google Ads</th>
                    <th style={th}>Conversão server-side</th>
                  </tr>
                </thead>
                <tbody>
                  {lojas.map((l) => (
                    <tr key={l.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={td}>{l.name}</td>
                      <td style={td}><Id v={l.metaPixelId} /></td>
                      <td style={td}><Id v={l.tiktokPixelId} /></td>
                      <td style={td}><Id v={l.googleAdsId} /></td>
                      <td style={td}>
                        {l.capiOwn ? (
                          <span style={{ color: "var(--gold-soft)" }}>
                            própria
                            <span className="dim" style={{ fontSize: 12, marginLeft: 6 }}>
                              (Meta {l.metaAccessToken ? "ok" : "sem token"} · TikTok{" "}
                              {l.tiktokAccessToken ? "ok" : "sem token"})
                            </span>
                          </span>
                        ) : (
                          <span className="muted">pelo gateway</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: 18, padding: 20, maxWidth: 660 }}>
          <h2 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--gold-soft)", marginBottom: 10 }}>
            Como ler a última coluna
          </h2>
          <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            <strong>Pelo gateway</strong>: o app manda os dados de rastreamento junto da
            cobrança e o gateway dispara Meta CAPI e TikTok Events API quando a venda é paga.
          </p>
          <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 10 }}>
            <strong>Própria</strong>: o disparo sai daqui, no webhook, com os tokens da loja.
            Nesse modo, desligue a integração equivalente no painel do gateway — senão a
            mesma venda é contada duas vezes.
          </p>
          <p className="dim" style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 12 }}>
            Edição em{" "}
            <Link href="/painel/lojas" style={{ color: "var(--gold-soft)" }}>Lojas</Link>. Esta
            tela nunca recebe os tokens, só se eles existem.
          </p>
        </div>
      </div>
    </PainelShell>
  );
}

const Id = ({ v }: { v: string | null }) =>
  v ? <span style={{ fontSize: 12.5 }}>{v}</span> : <span className="dim">—</span>;

const th: React.CSSProperties = { padding: "12px 16px", fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: "12px 16px" };
