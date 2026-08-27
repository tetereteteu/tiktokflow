"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Product = {
  id: string; title: string; slug: string; description: string | null;
  priceCents: number; compareAtCents: number | null; imageUrl: string | null;
  active: boolean; storeId: string; storeName: string; storeSlug: string;
};
type Store = { id: string; name: string; slug: string };

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const toCents = (v: string) => Math.round(parseFloat(v.replace(",", ".")) * 100) || 0;
const fromCents = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2));

export default function ProdutosClient({ products, stores }: { products: Product[]; stores: Store[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div className="eyebrow">Gestão</div>
          <h1 className="display" style={{ fontSize: 34 }}>Produtos</h1>
        </div>
        <button className="btn btn--gold" style={{ width: "auto" }}
          disabled={stores.length === 0}
          onClick={() => setCreating(true)}>+ Novo produto</button>
      </div>

      {stores.length === 0 && (
        <div className="card"><p className="muted">Crie uma loja antes de cadastrar produtos.</p></div>
      )}

      {products.length === 0 && stores.length > 0 ? (
        <div className="card"><p className="muted">Nenhum produto ainda.</p></div>
      ) : (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {products.map((p) => (
            <div key={p.id} className="card" style={{ display: "flex", gap: 12, padding: 14 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 8, flexShrink: 0, background: "var(--bg-input)",
                backgroundImage: p.imageUrl ? `url(${p.imageUrl})` : undefined,
                backgroundSize: "cover", backgroundPosition: "center",
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</h3>
                  <span className={`badge badge--${p.active ? "paid" : "refunded"}`} style={{ flexShrink: 0 }}>
                    {p.active ? "On" : "Off"}
                  </span>
                </div>
                <div className="dim" style={{ fontSize: 12 }}>{p.storeName}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{ color: "var(--gold)", fontWeight: 700 }}>{brl(p.priceCents)}</span>
                  <button className="btn btn--ghost" style={{ width: "auto", padding: "5px 12px", fontSize: 12 }}
                    onClick={() => setEditing(p)}>Editar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <ProductForm product={editing} stores={stores}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); router.refresh(); }} />
      )}
    </div>
  );
}

function ProductForm({ product, stores, onClose, onSaved }: {
  product: Product | null; stores: Store[]; onClose: () => void; onSaved: () => void;
}) {
  const isNew = !product;
  const [f, setF] = useState({
    storeId: product?.storeId || stores[0]?.id || "",
    title: product?.title || "",
    slug: product?.slug || "",
    description: product?.description || "",
    price: fromCents(product?.priceCents ?? null),
    compareAt: fromCents(product?.compareAtCents ?? null),
    imageUrl: product?.imageUrl || "",
    active: product?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true); setError("");
    if (!f.title || !f.price) { setError("Título e preço são obrigatórios"); setSaving(false); return; }
    try {
      const url = isNew ? "/api/admin/products" : `/api/admin/products/${product!.id}`;
      const method = isNew ? "POST" : "PATCH";
      const payload: Record<string, unknown> = {
        title: f.title, description: f.description,
        priceCents: toCents(f.price),
        compareAtCents: f.compareAt ? toCents(f.compareAt) : null,
        imageUrl: f.imageUrl, active: f.active,
      };
      if (isNew) { payload.storeId = f.storeId; payload.slug = f.slug; }
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao salvar"); setSaving(false); return; }
      onSaved();
    } catch { setError("Erro de conexão"); setSaving(false); }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div className="card" style={modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
          {isNew ? "Novo produto" : "Editar produto"}
        </h2>

        {isNew && (
          <div className="field">
            <label>Loja</label>
            <select className="input" value={f.storeId} onChange={(e) => setF({ ...f, storeId: e.target.value })}>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div className="field"><label>Título</label>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        {isNew && (
          <div className="field"><label>Slug (URL) — deixe vazio pra gerar do título</label>
            <input className="input" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="meu-produto" /></div>
        )}
        <div className="field"><label>Descrição</label>
          <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div style={{ display: "flex", gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>Preço (R$)</label>
            <input className="input" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="97.00" inputMode="decimal" /></div>
          <div className="field" style={{ flex: 1 }}><label>Preço "de" (opcional)</label>
            <input className="input" value={f.compareAt} onChange={(e) => setF({ ...f, compareAt: e.target.value })} placeholder="147.00" inputMode="decimal" /></div>
        </div>
        <div className="field"><label>URL da imagem</label>
          <input className="input" value={f.imageUrl} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} placeholder="https://..." /></div>

        <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0 16px", fontSize: 14 }}>
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })}
            style={{ width: 18, height: 18, accentColor: "var(--gold)" }} /> Produto ativo
        </label>

        {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--gold" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar produto"}</button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 };
const modal: React.CSSProperties = { width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" };
