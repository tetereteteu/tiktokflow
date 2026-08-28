// ─────────────────────────────────────────────────────────────
// Para onde o cliente vai depois de pagar.
//
// Vazio mantém o comportamento atual: ele fica no checkout, vendo o
// upsell. Preenchido, é levado ao destino — depois do upsell, ou
// direto, se o pulo estiver ligado.
// ─────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Produto = { id: string; title: string; redirectUrl: string | null };
type Loja = {
  id: string; name: string;
  redirectUrl: string | null; redirectSkipUpsell: boolean;
  temUpsell: boolean; produtos: Produto[];
};

export default function RedirecionamentoClient({ lojas }: { lojas: Loja[] }) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(lojas[0]?.id ?? "");
  const loja = lojas.find((l) => l.id === storeId);

  const [url, setUrl] = useState(loja?.redirectUrl ?? "");
  const [pular, setPular] = useState(loja?.redirectSkipUpsell ?? false);
  const [porProduto, setPorProduto] = useState<Record<string, string>>(
    Object.fromEntries((loja?.produtos ?? []).map((p) => [p.id, p.redirectUrl ?? ""])),
  );
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  function trocarLoja(id: string) {
    const l = lojas.find((x) => x.id === id);
    setStoreId(id);
    setUrl(l?.redirectUrl ?? "");
    setPular(l?.redirectSkipUpsell ?? false);
    setPorProduto(Object.fromEntries((l?.produtos ?? []).map((p) => [p.id, p.redirectUrl ?? ""])));
    setAviso(null);
  }

  async function salvar() {
    setAviso(null);
    setSalvando(true);
    try {
      const r = await fetch(`/api/admin/stores/${storeId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ redirectUrl: url, redirectSkipUpsell: pular }),
      });
      if (!r.ok) { setAviso("Falha ao salvar a loja."); return; }

      // Só manda o que mudou, pra não reescrever produto à toa.
      const mudados = (loja?.produtos ?? []).filter(
        (p) => (porProduto[p.id] ?? "") !== (p.redirectUrl ?? ""),
      );
      for (const p of mudados) {
        await fetch(`/api/admin/products/${p.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ redirectUrl: porProduto[p.id] }),
        });
      }

      setAviso("Salvo.");
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="eyebrow">Checkout</div>
      <h1 className="display" style={{ fontSize: 34 }}>Redirecionamento</h1>
      <p className="muted" style={{ fontSize: 13, margin: "6px 0 18px", maxWidth: 660, lineHeight: 1.6 }}>
        Para onde o cliente vai depois de pagar. Em branco, ele continua no checkout, onde
        já vê a oferta pós-compra.
      </p>

      <div className="field" style={{ maxWidth: 320, marginBottom: 18 }}>
        <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 5 }}>Loja</label>
        <select className="input" value={storeId} onChange={(e) => trocarLoja(e.target.value)}>
          {lojas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 20, maxWidth: 660 }}>
        <div className="field" style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 5 }}>
            Destino da loja
          </label>
          <input
            className="input" value={url} placeholder="https://seusite.com/obrigado"
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="dim" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
            Precisa começar com <code>http://</code> ou <code>https://</code>. Endereço
            inválido é ignorado e o cliente fica no checkout, em vez de cair numa página
            quebrada.
          </p>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>
          <input type="checkbox" checked={pular} onChange={(e) => setPular(e.target.checked)} />
          Ir direto ao destino, sem mostrar o upsell
        </label>
        {loja?.temUpsell && pular && (
          <p style={{ color: "var(--amber)", fontSize: 12.5, lineHeight: 1.5, marginBottom: 8 }}>
            Esta loja tem oferta pós-compra ativa. Com o pulo ligado, ela deixa de ser exibida
            — e a receita dela some junto.
          </p>
        )}
        <p className="dim" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
          Os parâmetros de rastreamento (UTMs, ttclid, fbclid, gclid) e o número do pedido vão
          junto na URL. Sem eles, a página de destino não sabe de onde veio a venda.
        </p>

        {(loja?.produtos.length ?? 0) > 0 && (
          <>
            <h2 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-dim)", margin: "18px 0 10px" }}>
              Destino por produto (opcional)
            </h2>
            <div style={{ display: "grid", gap: 10 }}>
              {loja!.produtos.map((p) => (
                <div key={p.id} className="field">
                  <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>
                    {p.title}
                  </label>
                  <input
                    className="input"
                    value={porProduto[p.id] ?? ""}
                    placeholder="usa o destino da loja"
                    onChange={(e) => setPorProduto({ ...porProduto, [p.id]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {aviso && (
          <p style={{ color: aviso === "Salvo." ? "var(--green)" : "var(--red)", fontSize: 13, margin: "14px 0 0" }}>
            {aviso}
          </p>
        )}

        <button className="btn btn--gold" onClick={salvar} disabled={salvando} style={{ marginTop: 16 }}>
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
