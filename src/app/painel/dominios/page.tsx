// ─────────────────────────────────────────────────────────────
// Domínios das vitrines.
//
// Leitura apenas: o campo Store.domain já existe e é editável em
// /painel/lojas, mas NADA roteia por ele ainda — não há middleware
// que resolva host -> loja. Por isso a tela mostra o que está
// cadastrado e deixa explícito o que falta pro domínio funcionar.
// ─────────────────────────────────────────────────────────────

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";

export default async function DominiosPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const where = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const lojas = await prisma.store.findMany({
    where,
    select: { id: true, name: true, slug: true, domain: true, active: true },
    orderBy: { name: "asc" },
  });

  const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  const comDominio = lojas.filter((l) => l.domain).length;

  return (
    <PainelShell email={session.email}>
      <div>
        <div className="eyebrow">Vitrine</div>
        <h1 className="display" style={{ fontSize: 34 }}>Domínios</h1>
        <p className="muted" style={{ fontSize: 13, margin: "6px 0 18px", maxWidth: 640, lineHeight: 1.6 }}>
          Endereço de cada vitrine. Hoje toda loja é servida em{" "}
          <code style={{ color: "var(--gold-soft)" }}>{base || "APP_BASE_URL"}/{"{slug}"}</code>.
          O domínio próprio já pode ser cadastrado, mas ainda não é usado para servir a loja.
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
                    <th style={th}>Endereço atual</th>
                    <th style={th}>Domínio próprio</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lojas.map((l) => (
                    <tr key={l.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={td}>{l.name}</td>
                      <td style={td} className="muted">
                        <a href={`${base}/${l.slug}`} target="_blank" rel="noreferrer">
                          /{l.slug}
                        </a>
                      </td>
                      <td style={td}>
                        {l.domain ? (
                          <span style={{ color: "var(--gold-soft)" }}>{l.domain}</span>
                        ) : (
                          <span className="dim">não cadastrado</span>
                        )}
                      </td>
                      <td style={td}>
                        <span className={`badge badge--${l.active ? "paid" : "expired"}`}>
                          {l.active ? "ativa" : "inativa"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: 18, padding: 20, maxWidth: 640 }}>
          <h2 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--gold-soft)", marginBottom: 10 }}>
            Para o domínio próprio funcionar
          </h2>
          <ol style={{ display: "grid", gap: 9, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55, color: "var(--text-muted)" }}>
            <li>Apontar o DNS do domínio (registro A) para o IP deste servidor.</li>
            <li>Adicionar o domínio no Caddyfile, que emite o certificado HTTPS sozinho.</li>
            <li>
              Cadastrar o domínio na loja em <Link href="/painel/lojas" style={{ color: "var(--gold-soft)" }}>Lojas</Link>.
            </li>
            <li>
              Pronto: o roteamento por domínio já funciona. Com o DNS apontado e o domínio
              cadastrado, a raiz do domínio serve a vitrine e <code>/checkout/&#123;produto&#125;</code>{" "}
              cai no checkout certo.
            </li>
          </ol>
          <p className="dim" style={{ fontSize: 12.5, marginTop: 14, lineHeight: 1.55 }}>
            {comDominio} de {lojas.length} loja(s) com domínio cadastrado. Lembre que
            APP_BASE_URL monta a URL do webhook de pagamento — mudá-la exige recadastrar o
            webhook no painel do gateway.
          </p>
        </div>
      </div>
    </PainelShell>
  );
}

const th: React.CSSProperties = { padding: "12px 16px", fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: "12px 16px" };
