// ─────────────────────────────────────────────────────────────
// Código de rastreio por pedido pago.
//
// Recadastrar o código do mesmo pedido corrige em vez de duplicar —
// a rota faz upsert, já que Shipment.orderId é único.
// ─────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Pedido = {
  id: string; cliente: string | null; produto: string; frete: string | null;
  pagoEm: string | null; lojaSlug: string;
  codigo: string | null; transportadora: string | null; url: string | null;
};

export default function RastreiosClient({
  pedidos, baseUrl,
}: { pedidos: Pedido[]; baseUrl: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState<string | null>(null);
  const [f, setF] = useState({ codigo: "", transportadora: "", url: "" });
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const comCodigo = pedidos.filter((p) => p.codigo).length;

  function abrir(p: Pedido) {
    if (aberto === p.id) { setAberto(null); return; }
    setAberto(p.id);
    setAviso(null);
    setF({ codigo: p.codigo ?? "", transportadora: p.transportadora ?? "", url: p.url ?? "" });
  }

  async function salvar(p: Pedido) {
    setAviso(null); setSalvando(true);
    try {
      const r = await fetch("/api/admin/rastreios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: p.id, ...f }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setAviso(j.error ?? "Falha ao salvar."); return; }
      setAberto(null);
      router.refresh();
    } finally { setSalvando(false); }
  }

  async function remover(p: Pedido) {
    if (!confirm("Remover o rastreio deste pedido?")) return;
    const r = await fetch(`/api/admin/rastreios?orderId=${p.id}`, { method: "DELETE" });
    if (r.ok) { setAberto(null); router.refresh(); }
  }

  return (
    <div>
      <div className="eyebrow">Logística</div>
      <h1 className="display" style={{ fontSize: 34 }}>Rastreios</h1>
      <p className="muted" style={{ fontSize: 13, margin: "6px 0 18px", maxWidth: 660, lineHeight: 1.6 }}>
        Código de entrega dos pedidos pagos. O cliente acompanha em{" "}
        <code style={{ color: "var(--gold-soft)" }}>/&#123;loja&#125;/rastreio</code>, no domínio da
        própria loja — {comCodigo} de {pedidos.length} pedido(s) com código.
      </p>

      {pedidos.length === 0 ? (
        <div className="card"><p className="muted" style={{ fontSize: 13 }}>
          Nenhum pedido pago ainda. Rastreio só existe depois do pagamento confirmado.
        </p></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden", maxWidth: 760 }}>
          {pedidos.map((p) => (
            <div key={p.id} style={{ borderTop: "1px solid var(--border)", padding: "13px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{p.produto}</strong>
                  <span className="dim" style={{ fontSize: 12, marginLeft: 8 }}>
                    {p.cliente || "sem nome"}
                    {p.frete ? ` · ${p.frete}` : ""}
                    {p.pagoEm ? ` · ${new Date(p.pagoEm).toLocaleDateString("pt-BR")}` : ""}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {p.codigo ? (
                    <span className="badge badge--paid">{p.codigo}</span>
                  ) : (
                    <span className="badge badge--pending">sem código</span>
                  )}
                  <button className="btn btn--ghost" onClick={() => abrir(p)}>
                    {aberto === p.id ? "Fechar" : p.codigo ? "Editar" : "Adicionar"}
                  </button>
                  {p.codigo && <button className="btn btn--ghost" onClick={() => remover(p)}>Remover</button>}
                </div>
              </div>

              {aberto === p.id && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    <Campo label="Código"><input className="input" value={f.codigo} placeholder="AA123456789BR"
                      onChange={(e) => setF({ ...f, codigo: e.target.value })} /></Campo>
                    <Campo label="Transportadora"><input className="input" value={f.transportadora} placeholder="Correios"
                      onChange={(e) => setF({ ...f, transportadora: e.target.value })} /></Campo>
                  </div>
                  <Campo label="Link de rastreio (opcional)">
                    <input className="input" value={f.url} placeholder="https://..."
                      onChange={(e) => setF({ ...f, url: e.target.value })} />
                  </Campo>
                  <p className="dim" style={{ fontSize: 12, marginBottom: 10, wordBreak: "break-all" }}>
                    Consulta do cliente: {baseUrl}/{p.lojaSlug}/rastreio
                  </p>
                  {aviso && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>{aviso}</p>}
                  <button className="btn btn--gold" onClick={() => salvar(p)} disabled={salvando}>
                    {salvando ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="field" style={{ marginBottom: 12 }}>
    <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);
