// ─────────────────────────────────────────────────────────────
// Conexão do gateway de pagamento, por loja.
//
// A credencial é por loja, não global: cada vitrine pode rodar numa
// conta diferente do gateway.
//
// A tela nunca recebe a chave nem o secret — só o booleano de que
// existem. Campo em branco significa "mantém o que está lá", e é por
// isso que dá pra salvar o secret sem redigitar a chave.
// ─────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Loja = { id: string; name: string; temChave: boolean; temSecret: boolean };

export default function GatewaysClient({
  lojas,
  baseUrl,
}: {
  lojas: Loja[];
  baseUrl: string;
}) {
  const router = useRouter();
  const [aberta, setAberta] = useState<string | null>(null);
  const [chave, setChave] = useState("");
  const [secret, setSecret] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiada, setCopiada] = useState<string | null>(null);

  const conectadas = lojas.filter((l) => l.temChave && l.temSecret).length;

  function abrir(id: string) {
    setAberta(aberta === id ? null : id);
    setChave("");
    setSecret("");
    setAviso(null);
  }

  async function salvar(id: string) {
    if (!chave && !secret) {
      setAviso("Preencha ao menos um campo para salvar.");
      return;
    }
    setAviso(null);
    setSalvando(true);
    try {
      const corpo: Record<string, string> = {};
      if (chave) corpo.nervaApiKey = chave;
      if (secret) corpo.nervaWebhookSecret = secret;

      const r = await fetch(`/api/admin/stores/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (!r.ok) {
        setAviso("Falha ao salvar.");
        return;
      }
      setChave("");
      setSecret("");
      setAviso("Salvo.");
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  async function desconectar(l: Loja) {
    if (!confirm(`Desconectar a Nerva de "${l.name}"? O checkout desta loja para de gerar Pix.`))
      return;
    await fetch(`/api/admin/stores/${l.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nervaApiKey: "", nervaWebhookSecret: "" }),
    });
    router.refresh();
  }

  async function copiar(url: string, id: string) {
    await navigator.clipboard.writeText(url);
    setCopiada(id);
    setTimeout(() => setCopiada(null), 1600);
  }

  return (
    <div>
      <div className="eyebrow">Checkout</div>
      <h1 className="display" style={{ fontSize: 34 }}>Gateways</h1>
      <p className="muted" style={{ fontSize: 13, margin: "6px 0 18px", maxWidth: 660, lineHeight: 1.6 }}>
        Quem processa a cobrança. A credencial é por loja: cada vitrine pode rodar numa conta
        diferente do gateway.
      </p>

      <div className="card" style={{ padding: 0, overflow: "hidden", maxWidth: 680 }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <strong style={{ color: "var(--gold-soft)" }}>Nerva</strong>
            <span className="dim" style={{ fontSize: 12.5, marginLeft: 10 }}>
              Pix · {conectadas} de {lojas.length} loja(s) conectada(s)
            </span>
          </div>
        </div>

        {lojas.length === 0 ? (
          <p className="muted" style={{ padding: 18 }}>Nenhuma loja cadastrada ainda.</p>
        ) : (
          lojas.map((l) => {
            const conectada = l.temChave && l.temSecret;
            const webhookUrl = baseUrl
              ? `${baseUrl}/api/webhooks/nerva/${l.id}`
              : "defina APP_BASE_URL";

            return (
              <div key={l.id} style={{ borderTop: "1px solid var(--border)", padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <strong style={{ fontSize: 15 }}>{l.name}</strong>
                    <span
                      className={`badge badge--${conectada ? "paid" : "pending"}`}
                      style={{ marginLeft: 10 }}
                    >
                      {conectada
                        ? "conectada"
                        : l.temChave
                          ? "falta o webhook secret"
                          : l.temSecret
                            ? "falta a API key"
                            : "não conectada"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn--ghost" onClick={() => abrir(l.id)}>
                      {aberta === l.id ? "Fechar" : conectada ? "Editar" : "Conectar"}
                    </button>
                    {(l.temChave || l.temSecret) && (
                      <button className="btn btn--ghost" onClick={() => desconectar(l)}>
                        Desconectar
                      </button>
                    )}
                  </div>
                </div>

                {aberta === l.id && (
                  <div style={{ marginTop: 14 }}>
                    <Campo label={l.temChave ? "API Key (preenchida — em branco mantém a atual)" : "API Key (sk_live_...)"}>
                      <input className="input" type="password" value={chave}
                        placeholder={l.temChave ? "••••••••" : "sk_live_..."}
                        onChange={(e) => setChave(e.target.value)} />
                    </Campo>
                    <Campo label={l.temSecret ? "Webhook secret (preenchido — em branco mantém o atual)" : "Webhook secret"}>
                      <input className="input" type="password" value={secret}
                        placeholder={l.temSecret ? "••••••••" : "secret do webhook"}
                        onChange={(e) => setSecret(e.target.value)} />
                    </Campo>

                    <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, fontSize: 12, marginBottom: 12 }}>
                      <div className="dim" style={{ marginBottom: 4 }}>
                        Cadastre esta URL na aba Webhooks do painel da Nerva:
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <code style={{ color: "var(--gold)", wordBreak: "break-all", flex: 1 }}>{webhookUrl}</code>
                        <button className="btn btn--ghost" type="button"
                          onClick={() => copiar(webhookUrl, l.id)}
                          style={{ width: "auto", padding: "4px 10px", fontSize: 11, flexShrink: 0 }}>
                          {copiada === l.id ? "Copiado!" : "Copiar"}
                        </button>
                      </div>
                    </div>

                    {aviso && (
                      <p style={{ color: aviso === "Salvo." ? "var(--green)" : "var(--red)", fontSize: 13, marginBottom: 10 }}>
                        {aviso}
                      </p>
                    )}

                    <button className="btn btn--gold" onClick={() => salvar(l.id)} disabled={salvando}>
                      {salvando ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <p className="dim" style={{ fontSize: 12.5, margin: "14px 0 0", maxWidth: 660, lineHeight: 1.55 }}>
        Sem a URL de webhook cadastrada no painel da Nerva, o pedido fica pendente para
        sempre, mesmo com o Pix pago: é o webhook que confirma o pagamento, não a resposta da
        cobrança.
      </p>
    </div>
  );
}

const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="field" style={{ marginBottom: 12 }}>
    <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);
