// ─────────────────────────────────────────────────────────────
// Faixas de frete da loja.
//
// O valor digitado aqui é em reais e vira centavos antes de subir —
// o banco e o cálculo do pedido trabalham só com inteiro, pra não
// perder centavo em arredondamento.
// ─────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Faixa = {
  id: string; nome: string; prazoDias: number;
  priceCents: number; ativo: boolean; ordem: number;
};
type Loja = { id: string; name: string; freteGratisAcimaCents: number | null; shippingRates: Faixa[] };

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const paraCentavos = (reais: string) =>
  Math.max(0, Math.round(Number(String(reais).replace(",", ".")) * 100) || 0);

const VAZIO = { nome: "", prazoDias: "0", preco: "", ordem: "0", ativo: true };

export default function FretesClient({ lojas }: { lojas: Loja[] }) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(lojas[0]?.id ?? "");
  const loja = lojas.find((l) => l.id === storeId);

  const [f, setF] = useState({ ...VAZIO });
  const [editando, setEditando] = useState<string | null>(null);
  const [gratisAcima, setGratisAcima] = useState(
    loja?.freteGratisAcimaCents != null ? String(loja.freteGratisAcimaCents / 100) : "",
  );
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function trocarLoja(id: string) {
    const l = lojas.find((x) => x.id === id);
    setStoreId(id);
    setGratisAcima(l?.freteGratisAcimaCents != null ? String(l.freteGratisAcimaCents / 100) : "");
    setEditando(null);
    setF({ ...VAZIO });
    setAviso(null);
  }

  async function salvarFaixa() {
    setAviso(null);
    setSalvando(true);
    try {
      const corpo = {
        storeId,
        nome: f.nome,
        prazoDias: Number(f.prazoDias) || 0,
        priceCents: paraCentavos(f.preco),
        ordem: Number(f.ordem) || 0,
        ativo: f.ativo,
      };
      const r = await fetch(editando ? `/api/admin/fretes/${editando}` : "/api/admin/fretes", {
        method: editando ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (!r.ok) { setAviso("Falha ao salvar a faixa."); return; }
      setF({ ...VAZIO }); setEditando(null);
      router.refresh();
    } finally { setSalvando(false); }
  }

  async function salvarGratis() {
    const r = await fetch(`/api/admin/stores/${storeId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        freteGratisAcimaCents: gratisAcima.trim() === "" ? null : paraCentavos(gratisAcima),
      }),
    });
    setAviso(r.ok ? "Salvo." : "Falha ao salvar.");
    if (r.ok) router.refresh();
  }

  async function remover(x: Faixa) {
    if (!confirm(`Apagar a faixa "${x.nome}"? Pedidos já feitos continuam mostrando o que cobraram.`))
      return;
    const r = await fetch(`/api/admin/fretes/${x.id}`, { method: "DELETE" });
    if (r.ok) { if (editando === x.id) { setEditando(null); setF({ ...VAZIO }); } router.refresh(); }
  }

  return (
    <div>
      <div className="eyebrow">Logística</div>
      <h1 className="display" style={{ fontSize: 34 }}>Fretes</h1>
      <p className="muted" style={{ fontSize: 13, margin: "6px 0 18px", maxWidth: 660, lineHeight: 1.6 }}>
        Faixas de entrega que aparecem no checkout. O cliente escolhe uma e o valor entra no
        total do pedido.
      </p>

      <div className="field" style={{ maxWidth: 320, marginBottom: 18 }}>
        <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 5 }}>Loja</label>
        <select className="input" value={storeId} onChange={(e) => trocarLoja(e.target.value)}>
          {lojas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 18, maxWidth: 660 }}>
        <div className="field" style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 5 }}>
            Frete grátis acima de (R$)
          </label>
          <input className="input" value={gratisAcima} inputMode="decimal" placeholder="em branco, desligado"
            onChange={(e) => setGratisAcima(e.target.value)} style={{ maxWidth: 200 }} />
          <p className="dim" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
            Vale sobre produto + order bump, sem contar o frete — senão ele ajudaria a atingir
            o próprio limite.
          </p>
        </div>
        <button className="btn btn--ghost" onClick={salvarGratis}>Salvar limite</button>
      </div>

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start" }}>
        <div>
          <h2 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 10 }}>
            {loja?.shippingRates.length ?? 0} faixa(s)
          </h2>
          {(loja?.shippingRates.length ?? 0) === 0 ? (
            <div className="card"><p className="muted" style={{ fontSize: 13 }}>
              Sem faixa cadastrada, o checkout não mostra entrega e não cobra frete.
            </p></div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {loja!.shippingRates.map((x) => (
                <div key={x.id} className="card" style={{ padding: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 15 }}>{x.nome}</strong>
                    <span style={{ color: "var(--gold)", fontWeight: 700 }}>{brl(x.priceCents)}</span>
                  </div>
                  <p className="dim" style={{ fontSize: 12, marginTop: 3 }}>
                    {x.prazoDias > 0 ? `até ${x.prazoDias} dia(s)` : "sem prazo definido"} · ordem {x.ordem}
                    {!x.ativo && " · inativa"}
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                    <button className="btn btn--ghost" onClick={() => {
                      setEditando(x.id);
                      setF({ nome: x.nome, prazoDias: String(x.prazoDias), preco: String(x.priceCents / 100), ordem: String(x.ordem), ativo: x.ativo });
                    }}>Editar</button>
                    <button className="btn btn--ghost" onClick={() => remover(x)}>Apagar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--gold-soft)", marginBottom: 12 }}>
            {editando ? "Editar faixa" : "Nova faixa"}
          </h2>
          <Campo label="Nome"><input className="input" value={f.nome} placeholder="PAC"
            onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <Campo label="Valor (R$)"><input className="input" value={f.preco} inputMode="decimal" placeholder="19,90"
              onChange={(e) => setF({ ...f, preco: e.target.value })} /></Campo>
            <Campo label="Prazo (dias)"><input className="input" value={f.prazoDias} inputMode="numeric"
              onChange={(e) => setF({ ...f, prazoDias: e.target.value })} /></Campo>
          </div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <Campo label="Ordem"><input className="input" value={f.ordem} inputMode="numeric"
              onChange={(e) => setF({ ...f, ordem: e.target.value })} /></Campo>
            <Campo label="Situação">
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)", paddingTop: 8 }}>
                <input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} />
                aparece no checkout
              </label>
            </Campo>
          </div>
          {aviso && <p style={{ color: aviso === "Salvo." ? "var(--green)" : "var(--red)", fontSize: 13, marginBottom: 10 }}>{aviso}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn--gold" onClick={salvarFaixa} disabled={salvando || !f.nome}>
              {salvando ? "Salvando..." : editando ? "Salvar" : "Criar"}
            </button>
            {editando && <button className="btn btn--ghost" onClick={() => { setEditando(null); setF({ ...VAZIO }); }}>Cancelar</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="field" style={{ marginBottom: 13 }}>
    <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);
