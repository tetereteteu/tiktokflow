"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Store = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  domain: string | null;
  active: boolean;
  metaPixelId: string | null;
  tiktokPixelId: string | null;
  googleAdsId: string | null;
  hasNervaKey: boolean;
  hasWebhookSecret: boolean;
  products: number;
  orders: number;
};

export default function LojasClient({ initialStores }: { initialStores: Store[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Store | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div className="eyebrow">Gestão</div>
          <h1 className="display" style={{ fontSize: 34 }}>Lojas</h1>
        </div>
        <button className="btn btn--gold" style={{ width: "auto" }} onClick={() => setCreating(true)}>
          + Nova loja
        </button>
      </div>

      {initialStores.length === 0 ? (
        <div className="card"><p className="muted">Nenhuma loja ainda. Crie a primeira.</p></div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {initialStores.map((s) => (
            <div key={s.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>{s.name}</h3>
                  <span className={`badge badge--${s.active ? "paid" : "refunded"}`}>
                    {s.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>
                  /{s.slug} · {s.products} produtos · {s.orders} pedidos
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <Tag ok={s.hasNervaKey} label="Nerva" />
                  <Tag ok={s.hasWebhookSecret} label="Webhook" />
                  <Tag ok={!!s.metaPixelId} label="Meta Pixel" />
                  <Tag ok={!!s.tiktokPixelId} label="TikTok Pixel" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a className="btn btn--ghost" style={{ width: "auto", padding: "8px 14px", fontSize: 13 }}
                  href={`/${s.slug}`} target="_blank">Ver loja</a>
                <button className="btn btn--ghost" style={{ width: "auto", padding: "8px 14px", fontSize: 13 }}
                  onClick={() => setEditing(s)}>Editar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <StoreForm
          store={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

function Tag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      fontSize: 11, padding: "2px 8px", borderRadius: 6,
      background: ok ? "rgba(47,185,106,0.14)" : "var(--bg-input)",
      color: ok ? "#43d17f" : "var(--text-dim)",
      border: `1px solid ${ok ? "transparent" : "var(--border)"}`,
    }}>
      {ok ? "✓" : "○"} {label}
    </span>
  );
}

function StoreForm({ store, onClose, onSaved }: {
  store: Store | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !store;
  const [f, setF] = useState({
    name: store?.name || "",
    slug: store?.slug || "",
    description: store?.description || "",
    domain: store?.domain || "",
    active: store?.active ?? true,
    nervaApiKey: "",
    nervaWebhookSecret: "",
    metaPixelId: store?.metaPixelId || "",
    tiktokPixelId: store?.tiktokPixelId || "",
    googleAdsId: store?.googleAdsId || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const webhookBase =
    typeof window !== "undefined" ? window.location.origin : "https://seudominio.com";

  async function save() {
    setSaving(true); setError("");
    try {
      const url = isNew ? "/api/admin/stores" : `/api/admin/stores/${store!.id}`;
      const method = isNew ? "POST" : "PATCH";
      // não enviar apiKey/secret vazios num PATCH (não sobrescreve o que já existe)
      const payload: Record<string, unknown> = {
        name: f.name, slug: f.slug, description: f.description,
        domain: f.domain, active: f.active,
        metaPixelId: f.metaPixelId, tiktokPixelId: f.tiktokPixelId, googleAdsId: f.googleAdsId,
      };
      if (f.nervaApiKey) payload.nervaApiKey = f.nervaApiKey;
      if (f.nervaWebhookSecret) payload.nervaWebhookSecret = f.nervaWebhookSecret;

      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao salvar"); setSaving(false); return; }
      onSaved();
    } catch { setError("Erro de conexão"); setSaving(false); }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div className="card" style={modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
          {isNew ? "Nova loja" : `Editar ${store!.name}`}
        </h2>

        <div className="eyebrow" style={{ marginBottom: 10 }}>Identidade</div>
        <Field label="Nome da loja"><input className="input" value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Slug (URL)"><input className="input" value={f.slug}
          onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="minha-loja" /></Field>
        <Field label="Descrição"><input className="input" value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Domínio próprio (opcional)"><input className="input" value={f.domain}
          onChange={(e) => setF({ ...f, domain: e.target.value })} placeholder="loja.com.br" /></Field>

        <div className="eyebrow" style={{ margin: "18px 0 10px" }}>Gateway Nerva</div>
        <Field label={store?.hasNervaKey ? "API Key (preenchida — deixe em branco pra manter)" : "API Key (sk_live_...)"}>
          <input className="input" value={f.nervaApiKey} type="password"
            onChange={(e) => setF({ ...f, nervaApiKey: e.target.value })}
            placeholder={store?.hasNervaKey ? "••••••••" : "sk_live_..."} />
        </Field>
        <Field label={store?.hasWebhookSecret ? "Webhook secret (preenchido — deixe em branco pra manter)" : "Webhook secret"}>
          <input className="input" value={f.nervaWebhookSecret} type="password"
            onChange={(e) => setF({ ...f, nervaWebhookSecret: e.target.value })}
            placeholder={store?.hasWebhookSecret ? "••••••••" : "secret do webhook"} />
        </Field>
        {!isNew && (
          <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, fontSize: 12, marginBottom: 14 }}>
            <div className="dim" style={{ marginBottom: 4 }}>Cadastre esta URL de webhook no painel da Nerva:</div>
            <code style={{ color: "var(--gold)", wordBreak: "break-all" }}>
              {webhookBase}/api/webhooks/nerva/{store!.id}
            </code>
          </div>
        )}

        <div className="eyebrow" style={{ margin: "18px 0 10px" }}>Pixels de anúncio</div>
        <Field label="Meta Pixel ID"><input className="input" value={f.metaPixelId}
          onChange={(e) => setF({ ...f, metaPixelId: e.target.value })} placeholder="123456789012345" /></Field>
        <Field label="TikTok Pixel ID"><input className="input" value={f.tiktokPixelId}
          onChange={(e) => setF({ ...f, tiktokPixelId: e.target.value })} placeholder="CXXXXXXXXXXXXX" /></Field>
        <Field label="Google Ads ID (opcional)"><input className="input" value={f.googleAdsId}
          onChange={(e) => setF({ ...f, googleAdsId: e.target.value })} placeholder="AW-XXXXXXXXX" /></Field>

        <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0 16px", fontSize: 14 }}>
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })}
            style={{ width: 18, height: 18, accentColor: "var(--gold)" }} />
          Loja ativa
        </label>

        {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--gold" onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar loja"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
  display: "grid", placeItems: "center", padding: 16, zIndex: 50,
};
const modal: React.CSSProperties = {
  width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto",
};
