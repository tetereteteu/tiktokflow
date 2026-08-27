"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Bump = { id: string; title: string; description: string | null; priceCents: number; active: boolean; storeId: string; storeName: string };
type Upsell = { id: string; title: string; description: string | null; priceCents: number; compareAtCents: number | null; active: boolean; storeId: string; storeName: string; productTitle: string };
type Product = { id: string; title: string; storeId: string };
type Store = { id: string; name: string };

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const toCents = (v: string) => Math.round(parseFloat(v.replace(",", ".")) * 100) || 0;

export default function OfertasClient({ bumps, upsells, products, stores }: {
  bumps: Bump[]; upsells: Upsell[]; products: Product[]; stores: Store[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"bumps" | "upsells">("bumps");
  const [creatingBump, setCreatingBump] = useState(false);
  const [creatingUpsell, setCreatingUpsell] = useState(false);

  async function del(kind: "bumps" | "upsells", id: string) {
    if (!confirm("Excluir?")) return;
    await fetch(`/api/admin/${kind}?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="eyebrow">Conversão</div>
      <h1 className="display" style={{ fontSize: 34, marginBottom: 14 }}>Ofertas</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <TabBtn active={tab === "bumps"} onClick={() => setTab("bumps")} label="Order Bumps" />
        <TabBtn active={tab === "upsells"} onClick={() => setTab("upsells")} label="Upsells" />
      </div>

      {tab === "bumps" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p className="muted" style={{ fontSize: 13, maxWidth: 480 }}>
              Oferta extra dentro do checkout. O cliente marca uma caixa e o valor soma no Pix.
            </p>
            <button className="btn btn--gold" style={{ width: "auto" }} disabled={stores.length === 0}
              onClick={() => setCreatingBump(true)}>+ Order bump</button>
          </div>
          {bumps.length === 0 ? (
            <div className="card"><p className="muted">Nenhum order bump ainda.</p></div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {bumps.map((b) => (
                <div key={b.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600 }}>{b.title}</h3>
                    {b.description && <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>{b.description}</div>}
                    <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>{b.storeName}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ color: "var(--gold)", fontWeight: 700 }}>+{brl(b.priceCents)}</span>
                    <button className="btn btn--ghost" style={{ width: "auto", padding: "6px 12px", fontSize: 13 }}
                      onClick={() => del("bumps", b.id)}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "upsells" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p className="muted" style={{ fontSize: 13, maxWidth: 480 }}>
              Oferta mostrada DEPOIS do pagamento. Se o cliente aceitar, gera um novo Pix — sem redigitar os dados.
            </p>
            <button className="btn btn--gold" style={{ width: "auto" }} disabled={products.length === 0}
              onClick={() => setCreatingUpsell(true)}>+ Upsell</button>
          </div>
          {upsells.length === 0 ? (
            <div className="card"><p className="muted">Nenhum upsell ainda.</p></div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {upsells.map((u) => (
                <div key={u.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600 }}>{u.title}</h3>
                    <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>Entrega: {u.productTitle}</div>
                    <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>{u.storeName}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ color: "var(--gold)", fontWeight: 700 }}>{brl(u.priceCents)}</span>
                    <button className="btn btn--ghost" style={{ width: "auto", padding: "6px 12px", fontSize: 13 }}
                      onClick={() => del("upsells", u.id)}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {creatingBump && <BumpForm stores={stores}
        onClose={() => setCreatingBump(false)}
        onSaved={() => { setCreatingBump(false); router.refresh(); }} />}
      {creatingUpsell && <UpsellForm stores={stores} products={products}
        onClose={() => setCreatingUpsell(false)}
        onSaved={() => { setCreatingUpsell(false); router.refresh(); }} />}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
      border: `1px solid ${active ? "var(--gold)" : "var(--border)"}`,
      background: active ? "var(--gold-dim)" : "var(--bg-card)",
      color: active ? "var(--gold)" : "var(--text-muted)", fontFamily: "inherit",
    }}>{label}</button>
  );
}

function BumpForm({ stores, onClose, onSaved }: { stores: Store[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ storeId: stores[0]?.id || "", title: "", description: "", price: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!f.title || !f.price) { setError("Título e preço são obrigatórios"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/admin/bumps", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: f.storeId, title: f.title, description: f.description, priceCents: toCents(f.price) }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro"); setSaving(false); return; }
      onSaved();
    } catch { setError("Erro de conexão"); setSaving(false); }
  }
  return (
    <Modal onClose={onClose} title="Novo order bump">
      <div className="field"><label>Loja</label>
        <select className="input" value={f.storeId} onChange={(e) => setF({ ...f, storeId: e.target.value })}>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></div>
      <div className="field"><label>Título</label>
        <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Leve também o brinde X" /></div>
      <div className="field"><label>Descrição</label>
        <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <div className="field"><label>Preço adicional (R$)</label>
        <input className="input" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="29.90" inputMode="decimal" /></div>
      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <Actions onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
}

function UpsellForm({ stores, products, onClose, onSaved }: { stores: Store[]; products: Product[]; onClose: () => void; onSaved: () => void }) {
  const [storeId, setStoreId] = useState(stores[0]?.id || "");
  const storeProducts = products.filter((p) => p.storeId === storeId);
  const [f, setF] = useState({ productId: "", title: "", description: "", price: "", compareAt: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!f.productId || !f.title || !f.price) { setError("Produto, título e preço são obrigatórios"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/admin/upsells", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, productId: f.productId, title: f.title, description: f.description,
          priceCents: toCents(f.price), compareAtCents: f.compareAt ? toCents(f.compareAt) : null }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro"); setSaving(false); return; }
      onSaved();
    } catch { setError("Erro de conexão"); setSaving(false); }
  }
  return (
    <Modal onClose={onClose} title="Novo upsell">
      <div className="field"><label>Loja</label>
        <select className="input" value={storeId} onChange={(e) => { setStoreId(e.target.value); setF({ ...f, productId: "" }); }}>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></div>
      <div className="field"><label>Produto que o upsell entrega</label>
        <select className="input" value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}>
          <option value="">Selecione...</option>
          {storeProducts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select></div>
      <div className="field"><label>Título da oferta</label>
        <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Adicione o upgrade X" /></div>
      <div className="field"><label>Descrição</label>
        <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <div style={{ display: "flex", gap: 12 }}>
        <div className="field" style={{ flex: 1 }}><label>Preço (R$)</label>
          <input className="input" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="47.00" inputMode="decimal" /></div>
        <div className="field" style={{ flex: 1 }}><label>Preço "de" (opcional)</label>
          <input className="input" value={f.compareAt} onChange={(e) => setF({ ...f, compareAt: e.target.value })} placeholder="97.00" inputMode="decimal" /></div>
      </div>
      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <Actions onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }} onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
function Actions({ onClose, onSave, saving }: { onClose: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn--gold" onClick={onSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
    </div>
  );
}
