// ─────────────────────────────────────────────────────────────
// Criação de contas de anúncio em lote, por Business Center.
//
// O lote roda no servidor e pode levar horas (há espera entre as
// tentativas), então aqui não se espera resposta: dispara, guarda o
// id e passa a consultar o progresso a cada 5s. Fechar a aba não
// interrompe nada.
// ─────────────────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useState } from "react";

type Loja = { id: string; name: string; temToken: boolean };
type Conta = {
  id: string; bcId: string; nome: string; status: string;
  tentativas: number; classe: string | null; erro: string | null;
  advertiserId: string | null;
};
type Progresso = {
  id: string; status: string; bcIds: string[]; alvoPorBc: number;
  observacao: string | null; criadas: number; comErro: number;
  tentando: number; contas: Conta[];
};

const CLASSE_TEXTO: Record<string, string> = {
  REDE: "falha de conexão — repetindo",
  LIMITE: "rate limit do TikTok — esperando mais",
  SERVIDOR: "erro do lado do TikTok — repetindo",
  NEGOCIO: "recusa do TikTok (payload/qualificação)",
  COTA: "limite de contas do BC atingido",
};

export default function ContasClient({
  lojas,
  loteInicial,
}: {
  lojas: Loja[];
  loteInicial: { id: string; status: string } | null;
}) {
  const [storeId, setStoreId] = useState(lojas[0]?.id ?? "");
  const [f, setF] = useState({
    bcIds: "",
    alvoPorBc: "28",
    maxTentativas: "20",
    nomePrefixo: "",
    company: "",
    industry: "",
    registeredArea: "BR",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
    contactEmail: "",
    contactName: "",
    contactNumber: "",
    licenseNo: "",
    taxId: "",
    billingAddress: "",
    promotionLink: "",
    qualificationImageIds: "",
  });
  const [batchId, setBatchId] = useState<string | null>(loteInicial?.id ?? null);
  const [prog, setProg] = useState<Progresso | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const loja = lojas.find((l) => l.id === storeId);

  const buscar = useCallback(async (id: string) => {
    const r = await fetch(`/api/admin/tiktok/contas?batchId=${id}`);
    if (r.ok) setProg(await r.json());
  }, []);

  // Consulta a cada 5s enquanto o lote está rodando.
  useEffect(() => {
    if (!batchId) return;
    void buscar(batchId);
    const t = setInterval(() => {
      void buscar(batchId);
    }, 5000);
    return () => clearInterval(t);
  }, [batchId, buscar]);

  async function iniciar() {
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/admin/tiktok/contas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storeId,
          bcIds: f.bcIds.split(/[\s,;]+/).filter(Boolean),
          alvoPorBc: Number(f.alvoPorBc),
          maxTentativas: Number(f.maxTentativas),
          nomePrefixo: f.nomePrefixo,
          company: f.company,
          industry: Number(f.industry),
          registeredArea: f.registeredArea,
          currency: f.currency,
          timezone: f.timezone,
          contactEmail: f.contactEmail,
          contactName: f.contactName,
          contactNumber: f.contactNumber,
          licenseNo: f.licenseNo,
          taxId: f.taxId,
          billingAddress: f.billingAddress,
          promotionLink: f.promotionLink,
          qualificationImageIds: f.qualificationImageIds.split(/[\s,;]+/).filter(Boolean),
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(j.error ?? "Falha ao iniciar");
        if (j.batchId) setBatchId(j.batchId);
      } else {
        setBatchId(j.batchId);
      }
    } finally {
      setEnviando(false);
    }
  }

  async function parar() {
    if (!batchId) return;
    await fetch("/api/admin/tiktok/contas", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ batchId }),
    });
    void buscar(batchId);
  }

  const rodando = prog?.status === "RODANDO";

  return (
    <div>
      <div className="eyebrow">Anúncios</div>
      <h1 className="display" style={{ fontSize: 34 }}>Contas em massa</h1>
      <p className="muted" style={{ fontSize: 13, margin: "6px 0 18px", maxWidth: 680, lineHeight: 1.6 }}>
        Cria contas de anúncio até o alvo em cada Business Center. Conta o que o BC já tem
        e cria só o que falta, então rodar de novo completa em vez de duplicar.
      </p>

      <div className="card" style={{ padding: 18, marginBottom: 18, maxWidth: 680 }}>
        <strong style={{ color: "var(--gold-soft)", fontSize: 13 }}>
          Conta registrada no Brasil exige estes campos
        </strong>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
          A API do TikTok marca como opcionais no esquema, mas exige quando o BC ou a conta é
          do Brasil: <strong>e-mail de contato</strong>, <strong>CNPJ</strong>,{" "}
          <strong>imagens de qualificação</strong> e <strong>CNPJ de faturamento (tax_id)</strong>.
          Faltando qualquer um, a criação é recusada — e recusa por campo faltando não passa
          por insistência, só gasta tentativa.
        </p>
      </div>

      <div className="card" style={{ padding: 20, maxWidth: 680 }}>
        <Campo label="Loja">
          <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}{l.temToken ? "" : " (sem token de Marketing API)"}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Business Centers — um por linha">
          <textarea
            className="input" rows={3} value={f.bcIds}
            onChange={(e) => setF({ ...f, bcIds: e.target.value })}
            placeholder={"7xxxxxxxxxxxxxxxxx\n7yyyyyyyyyyyyyyyyy"}
          />
        </Campo>

        <Linha>
          <Campo label="Contas por BC"><Inp v={f.alvoPorBc} on={(v) => setF({ ...f, alvoPorBc: v })} /></Campo>
          <Campo label="Máx. tentativas por conta"><Inp v={f.maxTentativas} on={(v) => setF({ ...f, maxTentativas: v })} /></Campo>
        </Linha>
        <p className="dim" style={{ fontSize: 12, margin: "-6px 0 14px", lineHeight: 1.5 }}>
          Falha de rede, erro do TikTok e rate limit repetem sem limite, com espera crescente.
          O teto acima vale para recusa de payload, que não muda por insistir.
        </p>

        <Linha>
          <Campo label="Prefixo do nome"><Inp v={f.nomePrefixo} on={(v) => setF({ ...f, nomePrefixo: v })} ph="Loja Demo" /></Campo>
          <Campo label="Empresa"><Inp v={f.company} on={(v) => setF({ ...f, company: v })} ph="Razão social" /></Campo>
        </Linha>
        <Linha>
          <Campo label="ID da indústria"><Inp v={f.industry} on={(v) => setF({ ...f, industry: v })} ph="ex: 291000" /></Campo>
          <Campo label="Região"><Inp v={f.registeredArea} on={(v) => setF({ ...f, registeredArea: v })} /></Campo>
        </Linha>
        <Linha>
          <Campo label="Moeda"><Inp v={f.currency} on={(v) => setF({ ...f, currency: v })} /></Campo>
          <Campo label="Fuso"><Inp v={f.timezone} on={(v) => setF({ ...f, timezone: v })} /></Campo>
        </Linha>
        <Linha>
          <Campo label="E-mail de contato"><Inp v={f.contactEmail} on={(v) => setF({ ...f, contactEmail: v })} ph="obrigatório no Brasil" /></Campo>
          <Campo label="Nome do contato"><Inp v={f.contactName} on={(v) => setF({ ...f, contactName: v })} /></Campo>
        </Linha>
        <Linha>
          <Campo label="CNPJ (license_no)"><Inp v={f.licenseNo} on={(v) => setF({ ...f, licenseNo: v })} ph="obrigatório no Brasil" /></Campo>
          <Campo label="CNPJ de faturamento (tax_id)"><Inp v={f.taxId} on={(v) => setF({ ...f, taxId: v })} ph="obrigatório no Brasil" /></Campo>
        </Linha>
        <Campo label="IDs das imagens de qualificação — um por linha">
          <textarea
            className="input" rows={2} value={f.qualificationImageIds}
            onChange={(e) => setF({ ...f, qualificationImageIds: e.target.value })}
            placeholder="obrigatório no Brasil — obtidos no upload do certificado"
          />
        </Campo>

        {erro && (
          <p style={{ color: "var(--red)", fontSize: 13, margin: "6px 0 12px" }}>{erro}</p>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            className="btn btn--gold" onClick={iniciar}
            disabled={enviando || rodando || !loja?.temToken}
          >
            {rodando ? "Lote em andamento..." : enviando ? "Iniciando..." : "Criar contas"}
          </button>
          {rodando && (
            <button className="btn btn--ghost" onClick={parar}>Parar</button>
          )}
        </div>
      </div>

      {prog && (
        <div className="card" style={{ padding: 20, marginTop: 18, maxWidth: 680 }}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "baseline" }}>
            <strong style={{ color: prog.status === "RODANDO" ? "var(--gold-soft)" : "var(--text)" }}>
              {prog.status === "RODANDO" ? "Rodando" : prog.status === "PARADO" ? "Parado" : "Concluído"}
            </strong>
            <span style={{ color: "var(--green)", fontSize: 13 }}>{prog.criadas} criada(s)</span>
            <span className="muted" style={{ fontSize: 13 }}>{prog.tentando} tentando</span>
            <span style={{ color: "var(--red)", fontSize: 13 }}>{prog.comErro} com erro</span>
            <span className="dim" style={{ fontSize: 13 }}>alvo {prog.alvoPorBc}/BC</span>
          </div>

          {prog.observacao && (
            <pre className="muted" style={{ fontSize: 12.5, whiteSpace: "pre-wrap", marginTop: 12, lineHeight: 1.6 }}>
              {prog.observacao}
            </pre>
          )}

          {prog.contas.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text-dim)" }}>
                    <th style={th}>Conta</th><th style={th}>BC</th>
                    <th style={th}>Tent.</th><th style={th}>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {prog.contas.map((c) => (
                    <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={td}>{c.nome}</td>
                      <td style={td} className="dim">{c.bcId.slice(0, 10)}…</td>
                      <td style={td}>{c.tentativas}</td>
                      <td style={td}>
                        {c.status === "CRIADA" ? (
                          <span style={{ color: "var(--green)" }}>
                            criada{c.advertiserId ? ` · ${c.advertiserId}` : ""}
                          </span>
                        ) : (
                          <span style={{ color: c.status === "ERRO" ? "var(--red)" : "var(--text-muted)" }}>
                            {c.classe ? CLASSE_TEXTO[c.classe] ?? c.classe : "aguardando"}
                            {c.erro ? ` — ${c.erro}` : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="field" style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 5 }}>
      {label}
    </label>
    {children}
  </div>
);

const Linha = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
    {children}
  </div>
);

const Inp = ({ v, on, ph }: { v: string; on: (v: string) => void; ph?: string }) => (
  <input className="input" value={v} placeholder={ph} onChange={(e) => on(e.target.value)} />
);

const th: React.CSSProperties = { padding: "9px 12px", fontWeight: 600, fontSize: 11.5 };
const td: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
