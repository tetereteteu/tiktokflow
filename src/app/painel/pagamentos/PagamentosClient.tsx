// ─────────────────────────────────────────────────────────────
// Ajustes da cobrança, por loja.
//
// São os dois campos que hoje realmente chegam ao gateway: a
// validade do Pix e o texto que aparece na cobrança. O resto dos
// métodos depende de um segundo gateway, e a tela diz isso em vez de
// mostrar chave que não liga em nada.
// ─────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Loja = {
  id: string; name: string;
  pixExpiraSegundos: number; faturaDescricao: string | null; conectada: boolean;
};

const OPCOES = [
  { v: 900, t: "15 minutos" },
  { v: 1800, t: "30 minutos" },
  { v: 3600, t: "1 hora" },
  { v: 10800, t: "3 horas" },
  { v: 86400, t: "24 horas" },
];

export default function PagamentosClient({ lojas }: { lojas: Loja[] }) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(lojas[0]?.id ?? "");
  const loja = lojas.find((l) => l.id === storeId);

  const [expira, setExpira] = useState(String(loja?.pixExpiraSegundos ?? 3600));
  const [descricao, setDescricao] = useState(loja?.faturaDescricao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  function trocar(id: string) {
    const l = lojas.find((x) => x.id === id);
    setStoreId(id);
    setExpira(String(l?.pixExpiraSegundos ?? 3600));
    setDescricao(l?.faturaDescricao ?? "");
    setAviso(null);
  }

  async function salvar() {
    setAviso(null);
    setSalvando(true);
    try {
      const r = await fetch(`/api/admin/stores/${storeId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pixExpiraSegundos: Number(expira),
          faturaDescricao: descricao,
        }),
      });
      setAviso(r.ok ? "Salvo." : "Falha ao salvar.");
      if (r.ok) router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="eyebrow">Checkout</div>
      <h1 className="display" style={{ fontSize: 34 }}>Pagamentos</h1>
      <p className="muted" style={{ fontSize: 13, margin: "6px 0 18px", maxWidth: 660, lineHeight: 1.6 }}>
        Como a cobrança é feita em cada loja.
      </p>

      <div className="field" style={{ maxWidth: 320, marginBottom: 18 }}>
        <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 5 }}>Loja</label>
        <select className="input" value={storeId} onChange={(e) => trocar(e.target.value)}>
          {lojas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {loja && !loja.conectada && (
        <div className="card" style={{ padding: 14, marginBottom: 16, maxWidth: 660 }}>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
            Esta loja ainda não tem gateway conectado — nada aqui vai ter efeito até você
            conectar em <Link href="/painel/gateways" style={{ color: "var(--gold-soft)" }}>Gateways</Link>.
          </p>
        </div>
      )}

      <div className="card" style={{ padding: 20, maxWidth: 660 }}>
        <div className="field" style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 5 }}>
            Validade do Pix
          </label>
          <select className="input" value={expira} onChange={(e) => setExpira(e.target.value)}>
            {OPCOES.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
          <p className="dim" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
            Quanto tempo o código Pix continua válido. Curto demais derruba quem ia pagar
            depois; longo demais enche a tela de Recuperação de pendente que não vai pagar.
          </p>
        </div>

        <div className="field" style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 5 }}>
            Descrição na cobrança
          </label>
          <input
            className="input" value={descricao}
            placeholder="em branco, usa o nome do produto"
            onChange={(e) => setDescricao(e.target.value)}
          />
          <p className="dim" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
            É o texto que o comprador vê na cobrança. Nome que ele não reconhece vira
            contestação. Até 120 caracteres.
          </p>
        </div>

        {aviso && (
          <p style={{ color: aviso === "Salvo." ? "var(--green)" : "var(--red)", fontSize: 13, marginBottom: 10 }}>
            {aviso}
          </p>
        )}
        <button className="btn btn--gold" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>

      <div className="card" style={{ padding: 18, marginTop: 18, maxWidth: 660 }}>
        <h2 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 10 }}>
          Métodos de pagamento
        </h2>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          Só <strong>Pix</strong>, pela Nerva. Cartão, boleto e parcelamento dependem de um
          segundo gateway integrado — sem ele, ligar um botão aqui não mudaria nada no
          checkout, só criaria a impressão de que muda.
        </p>
      </div>
    </div>
  );
}
