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
  capiOwn: boolean;
  metaTestEventCode: string | null;
  tiktokTestEventCode: string | null;
  hasMetaToken: boolean;
  hasTiktokToken: boolean;
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
                  <Tag ok={s.capiOwn} label="CAPI própria" />
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
    capiOwn: store?.capiOwn ?? false,
    metaAccessToken: "",
    metaTestEventCode: store?.metaTestEventCode || "",
    tiktokAccessToken: "",
    tiktokTestEventCode: store?.tiktokTestEventCode || "",
    metaPixelId: store?.metaPixelId || "",
    tiktokPixelId: store?.tiktokPixelId || "",
    googleAdsId: store?.googleAdsId || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ meta: Check; tiktok: Check } | null>(null);

  // Testa as credenciais com o que está NO FORMULÁRIO — dá pra conferir
  // antes de salvar. O que estiver em branco cai no que já está gravado.
  async function testCapi() {
    if (!store) return;
    setTesting(true); setTestResult(null); setError("");
    try {
      const res = await fetch(`/api/admin/stores/${store.id}/capi-test`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metaPixelId: f.metaPixelId,
          tiktokPixelId: f.tiktokPixelId,
          metaAccessToken: f.metaAccessToken,
          tiktokAccessToken: f.tiktokAccessToken,
          tiktokTestEventCode: f.tiktokTestEventCode,
        }),
      });
      const data = await res.json();
      if (res.ok) setTestResult(data); else setError(data.error || "Falha no teste");
    } catch { setError("Erro de conexão"); }
    setTesting(false);
  }

  const webhookBase =
    typeof window !== "undefined" ? window.location.origin : "https://seudominio.com";
  const webhookUrl = store ? `${webhookBase}/api/webhooks/nerva/${store.id}` : "";
  const [copied, setCopied] = useState(false);

  // navigator.clipboard só existe em contexto seguro (HTTPS); o fallback cobre o resto.
  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = webhookUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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
      payload.capiOwn = f.capiOwn;
      payload.metaTestEventCode = f.metaTestEventCode;
      payload.tiktokTestEventCode = f.tiktokTestEventCode;
      if (f.nervaApiKey) payload.nervaApiKey = f.nervaApiKey;
      if (f.nervaWebhookSecret) payload.nervaWebhookSecret = f.nervaWebhookSecret;
      if (f.metaAccessToken) payload.metaAccessToken = f.metaAccessToken;
      if (f.tiktokAccessToken) payload.tiktokAccessToken = f.tiktokAccessToken;

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
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <code style={{ color: "var(--gold)", wordBreak: "break-all", flex: 1 }}>{webhookUrl}</code>
              <button className="btn btn--ghost" type="button" onClick={copyWebhook}
                style={{ width: "auto", padding: "4px 10px", fontSize: 11, flexShrink: 0 }}>
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        )}

        <div className="eyebrow" style={{ margin: "18px 0 10px" }}>Pixels de anúncio</div>
        <Field label="Meta Pixel ID"><input className="input" value={f.metaPixelId}
          onChange={(e) => setF({ ...f, metaPixelId: e.target.value })} placeholder="123456789012345" /></Field>
        <Field label="TikTok Pixel ID"><input className="input" value={f.tiktokPixelId}
          onChange={(e) => setF({ ...f, tiktokPixelId: e.target.value })} placeholder="CXXXXXXXXXXXXX" /></Field>
        <Field label="Google Ads ID (opcional)"><input className="input" value={f.googleAdsId}
          onChange={(e) => setF({ ...f, googleAdsId: e.target.value })} placeholder="AW-XXXXXXXXX" /></Field>

        <div className="eyebrow" style={{ margin: "18px 0 10px" }}>
          Conversions API própria (server-side, sem o gateway)
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12, fontSize: 14 }}>
          <input type="checkbox" checked={f.capiOwn}
            onChange={(e) => setF({ ...f, capiOwn: e.target.checked })}
            style={{ width: 18, height: 18, accentColor: "var(--gold)", marginTop: 2 }} />
          <span>
            Disparar a compra daqui
            <span className="dim" style={{ display: "block", fontSize: 12, marginTop: 2 }}>
              Ao ligar, <b>desligue</b> a integração de Meta/TikTok no painel da Nerva —
              senão a mesma venda vai pelos dois caminhos.
            </span>
          </span>
        </label>
        <Field label={store?.hasMetaToken
          ? "Meta — token da Conversions API (preenchido — deixe em branco pra manter)"
          : "Meta — token da Conversions API"}>
          <input className="input" value={f.metaAccessToken} type="password"
            onChange={(e) => setF({ ...f, metaAccessToken: e.target.value })}
            placeholder={store?.hasMetaToken ? "••••••••" : "EAA..."} />
        </Field>
        <Field label="Meta — código de teste (opcional, TESTxxxxx)">
          <input className="input" value={f.metaTestEventCode}
            onChange={(e) => setF({ ...f, metaTestEventCode: e.target.value })} placeholder="TEST12345" />
        </Field>
        <Field label={store?.hasTiktokToken
          ? "TikTok — token da Events API (preenchido — deixe em branco pra manter)"
          : "TikTok — token da Events API"}>
          <input className="input" value={f.tiktokAccessToken} type="password"
            onChange={(e) => setF({ ...f, tiktokAccessToken: e.target.value })}
            placeholder={store?.hasTiktokToken ? "••••••••" : "token da Events API"} />
        </Field>
        <Field label="TikTok — código de teste (só pra usar o botão abaixo)">
          <input className="input" value={f.tiktokTestEventCode}
            onChange={(e) => setF({ ...f, tiktokTestEventCode: e.target.value })} placeholder="TEST00000" />
        </Field>
        {!isNew && (
          <div style={{ marginBottom: 16 }}>
            <button className="btn btn--ghost" type="button" disabled={testing} onClick={testCapi}
              style={{ width: "auto", padding: "8px 14px", fontSize: 13 }}>
              {testing ? "Testando..." : "Testar credenciais"}
            </button>
            <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
              O Meta é só uma leitura do pixel; o TikTok usa o código de teste.
              Nenhuma compra falsa entra no seu relatório.
            </div>
            {testResult && (
              <div style={{ marginTop: 10, fontSize: 12, display: "grid", gap: 4 }}>
                <ResultLine label="Meta" r={testResult.meta} />
                <ResultLine label="TikTok" r={testResult.tiktok} />
              </div>
            )}
          </div>
        )}

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

type Check = { ok: boolean; detail: string };

function ResultLine({ label, r }: { label: string; r: Check }) {
  return (
    <div style={{ color: r.ok ? "#43d17f" : "var(--text-dim)" }}>
      {r.ok ? "✓" : "✕"} {label}: {r.detail}
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
