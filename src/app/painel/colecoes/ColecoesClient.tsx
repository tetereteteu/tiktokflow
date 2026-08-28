// ─────────────────────────────────────────────────────────────
// CRUD de coleções.
//
// Cada coleção mostra a URL do próprio feed — é ela que se cola no
// catálogo do TikTok pra rodar campanha só daquela linha de produto,
// em vez do catálogo inteiro da loja.
// ─────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Loja = { id: string; name: string; slug: string };
type Produto = { id: string; title: string; storeId: string; active: boolean };
type Colecao = {
  id: string; storeId: string; title: string; slug: string;
  description: string | null; active: boolean; ordem: number; productIds: string[];
};

const VAZIO = { title: "", slug: "", description: "", ordem: "0", active: true, productIds: [] as string[] };

export default function ColecoesClient({
  lojas, produtos, colecoes, baseUrl,
}: {
  lojas: Loja[]; produtos: Produto[]; colecoes: Colecao[]; baseUrl: string;
}) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(lojas[0]?.id ?? "");
  const [editando, setEditando] = useState<string | null>(null);
  const [f, setF] = useState({ ...VAZIO });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const loja = lojas.find((l) => l.id === storeId);
  const daLoja = colecoes.filter((c) => c.storeId === storeId);
  const produtosDaLoja = produtos.filter((p) => p.storeId === storeId);

  function abrirNova() {
    setEditando(null);
    setF({ ...VAZIO });
    setErro(null);
  }

  function abrirEdicao(c: Colecao) {
    setEditando(c.id);
    setErro(null);
    setF({
      title: c.title, slug: c.slug, description: c.description ?? "",
      ordem: String(c.ordem), active: c.active, productIds: [...c.productIds],
    });
  }

  function alternarProduto(id: string) {
    setF((a) => ({
      ...a,
      productIds: a.productIds.includes(id)
        ? a.productIds.filter((x) => x !== id)
        : [...a.productIds, id],
    }));
  }

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      const corpo = {
        storeId,
        title: f.title,
        slug: f.slug,
        description: f.description,
        ordem: Number(f.ordem) || 0,
        active: f.active,
        productIds: f.productIds,
      };
      const r = await fetch(
        editando ? `/api/admin/collections/${editando}` : "/api/admin/collections",
        {
          method: editando ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(corpo),
        },
      );
      const j = await r.json();
      if (!r.ok) { setErro(j.error ?? "Falha ao salvar"); return; }
      abrirNova();
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  async function remover(c: Colecao) {
    if (!confirm(`Apagar a coleção "${c.title}"? Os produtos continuam na loja.`)) return;
    const r = await fetch(`/api/admin/collections/${c.id}`, { method: "DELETE" });
    if (r.ok) { if (editando === c.id) abrirNova(); router.refresh(); }
  }

  return (
    <div>
      <div className="eyebrow">Vitrine</div>
      <h1 className="display" style={{ fontSize: 34 }}>Coleções</h1>
      <p className="muted" style={{ fontSize: 13, margin: "6px 0 18px", maxWidth: 660, lineHeight: 1.6 }}>
        Agrupa produtos por tema. A vitrine passa a exibir uma seção por coleção, e cada
        coleção ganha um feed próprio — dá pra rodar campanha de uma linha só, em vez do
        catálogo inteiro.
      </p>

      <div className="field" style={{ maxWidth: 320, marginBottom: 18 }}>
        <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 5 }}>Loja</label>
        <select className="input" value={storeId} onChange={(e) => { setStoreId(e.target.value); abrirNova(); }}>
          {lojas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
        <div>
          <h2 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 10 }}>
            {daLoja.length} coleção(ões)
          </h2>

          {daLoja.length === 0 ? (
            <div className="card"><p className="muted" style={{ fontSize: 13 }}>Nenhuma ainda. Crie a primeira ao lado.</p></div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {daLoja.map((c) => (
                <div key={c.id} className="card" style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 15 }}>{c.title}</strong>
                    <span className={`badge badge--${c.active ? "paid" : "expired"}`}>
                      {c.active ? "ativa" : "inativa"}
                    </span>
                  </div>
                  <p className="dim" style={{ fontSize: 12, marginTop: 4 }}>
                    ordem {c.ordem} · {c.productIds.length} produto(s)
                  </p>
                  {loja && (
                    <p className="dim" style={{ fontSize: 11.5, marginTop: 8, wordBreak: "break-all", lineHeight: 1.5 }}>
                      {baseUrl}/catalog/{loja.slug}/feed.csv?colecao={c.slug}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button className="btn btn--ghost" onClick={() => abrirEdicao(c)}>Editar</button>
                    <button className="btn btn--ghost" onClick={() => remover(c)}>Apagar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--gold-soft)", marginBottom: 12 }}>
            {editando ? "Editar coleção" : "Nova coleção"}
          </h2>

          <Campo label="Título">
            <input className="input" value={f.title} placeholder="Verão"
              onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Campo>
          <Campo label="Slug (vai na URL do feed — em branco, sai do título)">
            <input className="input" value={f.slug} placeholder="verao"
              onChange={(e) => setF({ ...f, slug: e.target.value })} />
          </Campo>
          <Campo label="Descrição">
            <input className="input" value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Campo>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <Campo label="Ordem na vitrine">
              <input className="input" value={f.ordem} inputMode="numeric"
                onChange={(e) => setF({ ...f, ordem: e.target.value })} />
            </Campo>
            <Campo label="Situação">
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)", paddingTop: 8 }}>
                <input type="checkbox" checked={f.active}
                  onChange={(e) => setF({ ...f, active: e.target.checked })} />
                ativa na vitrine
              </label>
            </Campo>
          </div>

          <Campo label={`Produtos (${f.productIds.length} marcado(s))`}>
            {produtosDaLoja.length === 0 ? (
              <p className="dim" style={{ fontSize: 12.5 }}>Esta loja ainda não tem produtos.</p>
            ) : (
              <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 10 }}>
                {produtosDaLoja.map((p) => (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "3px 0", color: p.active ? "var(--text-muted)" : "var(--text-dim)" }}>
                    <input type="checkbox" checked={f.productIds.includes(p.id)}
                      onChange={() => alternarProduto(p.id)} />
                    {p.title}{!p.active && " (inativo)"}
                  </label>
                ))}
              </div>
            )}
          </Campo>

          {erro && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 10 }}>{erro}</p>}

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn--gold" onClick={salvar} disabled={salvando || !f.title}>
              {salvando ? "Salvando..." : editando ? "Salvar" : "Criar"}
            </button>
            {editando && <button className="btn btn--ghost" onClick={abrirNova}>Cancelar</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="field" style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);
