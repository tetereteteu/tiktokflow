"use client";

// ─────────────────────────────────────────────────────────────
// BI — tiles de destaque, receita × gasto no tempo, receita por
// produto e origem do tráfego.
//
// Decisões de visualização:
//  • Receita e gasto são os DOIS em reais, então dividem UM eixo.
//    Dois eixos y inventariam uma correlação que não existe.
//  • Paleta categórica validada contra a superfície real do painel
//    (#14141c): azul #3987e5 e laranja #d95926 passam banda de
//    luminosidade, croma, separação para daltonismo e contraste.
//  • Cor nunca carrega sentido sozinha: legenda sempre presente,
//    rótulo direto nas pontas e uma tabela-espelho em cada gráfico.
//  • Grade e eixos são fio de cabelo sólido — tracejado lê como
//    projeção ou limite, e aqui é só grade.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import Link from "next/link";

type Serie = { data: string; receita: number; gasto: number };
type Produto = { titulo: string; receita: number; qtd: number };
type Origem = { nome: string; pedidos: number; pagos: number; receita: number };
type Resumo = {
  receitaCents: number; liquidoCents: number; gastoCents: number; lucroCents: number;
  freteCents: number;
  pedidos: number; pagos: number; cliques: number; ticketCents: number;
  maiorCents: number; menorCents: number;
  pendentes: number; expirados: number; estornados: number;
};

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brlCurto = (c: number) => {
  const v = c / 100;
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};
const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export default function BiClient({
  dias, lojas, lojaId, resumo, serie, produtos, origens,
}: {
  dias: number;
  lojas: { id: string; name: string }[];
  lojaId: string | null;
  resumo: Resumo;
  serie: Serie[];
  produtos: Produto[];
  origens: Origem[];
}) {
  const [tabela, setTabela] = useState(false);

  const roas = resumo.gastoCents > 0 ? resumo.receitaCents / resumo.gastoCents : null;
  const conversao = resumo.pedidos > 0 ? (resumo.pagos / resumo.pedidos) * 100 : null;
  const cpa = resumo.pagos > 0 && resumo.gastoCents > 0 ? Math.round(resumo.gastoCents / resumo.pagos) : null;

  const q = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const d = patch.dias ?? String(dias);
    const l = patch.loja !== undefined ? patch.loja : lojaId;
    if (d !== "30") p.set("dias", d);
    if (l) p.set("loja", l);
    const s = p.toString();
    return `/painel/bi${s ? `?${s}` : ""}`;
  };

  return (
    <div className="viz">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div className="eyebrow">Inteligência</div>
          <h1 className="display" style={{ fontSize: 34 }}>BI</h1>
        </div>
      </div>

      {/* UMA linha de filtros acima de tudo que ela escopa */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[7, 30, 90].map((d) => (
            <Link key={d} href={q({ dias: String(d) })} className="viz-pill" data-on={d === dias}>
              {d} dias
            </Link>
          ))}
        </div>
        {lojas.length > 1 && (
          <div style={{ display: "flex", gap: 4 }}>
            <Link href={q({ loja: null })} className="viz-pill" data-on={!lojaId}>Todas</Link>
            {lojas.map((l) => (
              <Link key={l.id} href={q({ loja: l.id })} className="viz-pill" data-on={lojaId === l.id}>
                {l.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* destaques */}
      <div className="viz-tiles">
        <Tile label="Receita paga" valor={brl(resumo.receitaCents)} nota={`${resumo.pagos} pedidos pagos`} forte />
        <Tile label="Gasto em anúncio" valor={brl(resumo.gastoCents)}
          nota={resumo.gastoCents === 0 ? "importe em Anúncios" : `${resumo.cliques} cliques`} />
        <Tile label="Lucro estimado" valor={brl(resumo.lucroCents)}
          nota="líquido do gateway − anúncio"
          cor={resumo.lucroCents >= 0 ? "#0ca30c" : "#d03b3b"} />
        <Tile label="ROAS" valor={roas === null ? "—" : `${roas.toFixed(2)}×`}
          nota={roas === null ? "sem gasto no período" : "receita ÷ gasto"} />
        <Tile label="Frete cobrado" valor={brl(resumo.freteCents)}
          nota="fora da receita — é repasse à transportadora" />
        <Tile label="Ticket médio" valor={brl(resumo.ticketCents)}
          nota={resumo.pagos ? `maior ${brl(resumo.maiorCents)}` : "—"} />
        <Tile label="Conversão" valor={conversao === null ? "—" : `${conversao.toFixed(1)}%`}
          nota={`${resumo.pagos} de ${resumo.pedidos} pedidos`} />
        <Tile label="Custo por venda" valor={cpa === null ? "—" : brl(cpa)}
          nota={cpa === null ? "sem gasto ou sem venda" : "gasto ÷ vendas"} />
        <Tile label="Não converteram" valor={String(resumo.pendentes + resumo.expirados)}
          nota={`${resumo.pendentes} pendentes · ${resumo.expirados} expirados`} />
      </div>

      {/* receita × gasto */}
      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Receita e gasto por dia</h2>
            <p className="dim" style={{ fontSize: 12, marginTop: 2 }}>
              Os dois em reais, no mesmo eixo — a distância entre as linhas é o lucro do dia.
            </p>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Legenda cor="var(--series-1)" texto="Receita" />
            <Legenda cor="var(--series-2)" texto="Gasto" />
            <button className="viz-pill" data-on={tabela} onClick={() => setTabela(!tabela)}>
              {tabela ? "Ver gráfico" : "Ver tabela"}
            </button>
          </div>
        </div>
        {tabela ? <TabelaSerie serie={serie} /> : <Linhas serie={serie} />}
      </div>

      <div className="viz-2col">
        {/* receita por produto — série única, uma cor só */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Receita por produto</h2>
          <p className="dim" style={{ fontSize: 12, margin: "2px 0 14px" }}>
            {produtos.length ? "Só pedidos pagos no período." : "Nenhuma venda paga no período."}
          </p>
          {produtos.length > 0 && <Barras produtos={produtos} />}
        </div>

        {/* origem — muitas categorias: tabela é a forma certa */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Origem do tráfego</h2>
          <p className="dim" style={{ fontSize: 12, margin: "2px 0 14px" }}>
            Por <code>utm_source</code> e <code>utm_campaign</code> capturados no checkout.
          </p>
          {origens.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Sem pedidos no período.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="viz-table">
                <thead>
                  <tr><th>Origem · campanha</th><th>Pedidos</th><th>Pagos</th><th>Receita</th></tr>
                </thead>
                <tbody>
                  {origens.map((o) => (
                    <tr key={o.nome}>
                      <td>{o.nome}</td>
                      <td className="num">{o.pedidos}</td>
                      <td className="num">{o.pagos}</td>
                      <td className="num">{brl(o.receita)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .viz {
          --surface-1: #14141c;
          --ink-1: #f4f4f7;
          --ink-2: #c3c2b7;
          --ink-muted: #898781;
          --grid: #2c2c2a;
          --axis: #383835;
          --series-1: #3987e5;
          --series-2: #d95926;
        }
        .viz-pill {
          display: inline-block; padding: 6px 13px; border-radius: 8px; font-size: 13px;
          border: 1px solid var(--border); background: var(--bg-input);
          color: var(--text-muted); cursor: pointer; font-weight: 500;
        }
        .viz-pill[data-on="true"] {
          border-color: var(--gold); background: var(--gold-dim); color: var(--gold);
        }
        .viz-tiles {
          display: grid; gap: 10px;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        }
        .viz-2col { display: grid; gap: 14px; margin-top: 14px; grid-template-columns: 1fr 1fr; }
        @media (max-width: 900px) { .viz-2col { grid-template-columns: 1fr; } }
        .viz-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .viz-table th {
          text-align: left; font-weight: 600; color: var(--ink-muted); font-size: 11px;
          text-transform: uppercase; letter-spacing: .08em; padding: 0 10px 8px 0;
          border-bottom: 1px solid var(--grid); white-space: nowrap;
        }
        .viz-table td { padding: 8px 10px 8px 0; border-bottom: 1px solid var(--grid); color: var(--ink-2); }
        .viz-table td.num, .viz-table th:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
        .viz-table tr:last-child td { border-bottom: none; }
      `}</style>
    </div>
  );
}

// ---- destaque: número é o gráfico ----

function Tile({ label, valor, nota, forte, cor }: {
  label: string; valor: string; nota?: string; forte?: boolean; cor?: string;
}) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-muted)", fontWeight: 600 }}>
        {label}
      </div>
      {/* figuras proporcionais: tabular-nums deixa número grande frouxo */}
      <div style={{ fontSize: forte ? 27 : 23, fontWeight: 700, marginTop: 7, color: cor ?? "var(--ink-1)", lineHeight: 1.15 }}>
        {valor}
      </div>
      {nota && <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 5 }}>{nota}</div>}
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-2)" }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: cor, flexShrink: 0 }} />
      {texto}
    </span>
  );
}

// ---- linhas: receita × gasto ----

function Linhas({ serie }: { serie: Serie[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 720, H = 250;
  const ML = 54, MR = 16, MT = 14, MB = 30; // MB reserva a faixa do eixo x
  const pw = W - ML - MR, ph = H - MT - MB;

  const max = Math.max(1, ...serie.map((s) => Math.max(s.receita, s.gasto)));
  const topo = Math.ceil(max / 4) * 4 || 1;
  const x = (i: number) => ML + (serie.length <= 1 ? pw / 2 : (i / (serie.length - 1)) * pw);
  const y = (v: number) => MT + ph - (v / topo) * ph;
  const linha = (k: "receita" | "gasto") =>
    serie.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s[k]).toFixed(1)}`).join(" ");

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * topo);
  const ultimo = serie.length - 1;

  // Rótulos do eixo x: um a cada `passo`, mais a última data sempre.
  // O filtro descarta o marcado logo antes do fim — senão os dois
  // últimos ficam colados e o texto se sobrepõe.
  const passo = Math.max(1, Math.ceil(serie.length / 8));
  const marcados = serie
    .map((_, i) => i)
    .filter((i) => i % passo === 0 && i < ultimo - passo / 2);
  if (ultimo >= 0) marcados.push(ultimo);
  const alvo = hover ?? ultimo;
  const p = serie[alvo];

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        aria-label="Receita e gasto por dia, em reais"
        style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - ML) / pw) * (serie.length - 1));
          setHover(Math.max(0, Math.min(serie.length - 1, i)));
        }}>
        {/* grade: fio de cabelo sólido, um tom acima da superfície */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={ML - 8} y={y(t) + 4} textAnchor="end" fontSize={10}
              fill="var(--ink-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
              {brlCurto(t)}
            </text>
          </g>
        ))}
        <line x1={ML} x2={W - MR} y1={y(0)} y2={y(0)} stroke="var(--axis)" strokeWidth={1} />

        {marcados.map((i) => (
          <text key={serie[i].data} x={x(i)} y={H - 10} textAnchor="middle" fontSize={10}
            fill="var(--ink-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
            {diaCurto(serie[i].data)}
          </text>
        ))}

        {/* marcas finas: 2px */}
        <path d={linha("gasto")} fill="none" stroke="var(--series-2)" strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round" />
        <path d={linha("receita")} fill="none" stroke="var(--series-1)" strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round" />

        {/* crosshair + marcadores com anel da superfície */}
        {p && (
          <g>
            <line x1={x(alvo)} x2={x(alvo)} y1={MT} y2={MT + ph} stroke="var(--axis)" strokeWidth={1} />
            <circle cx={x(alvo)} cy={y(p.gasto)} r={5} fill="var(--series-2)"
              stroke="var(--surface-1)" strokeWidth={2} />
            <circle cx={x(alvo)} cy={y(p.receita)} r={5} fill="var(--series-1)"
              stroke="var(--surface-1)" strokeWidth={2} />
          </g>
        )}
      </svg>

      {/* rótulo direto no ponto lido — o valor nunca depende só do tooltip */}
      {p && (
        <div style={{
          display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, fontSize: 12,
          color: "var(--ink-2)", borderTop: "1px solid var(--grid)", paddingTop: 10,
        }}>
          <span style={{ color: "var(--ink-muted)" }}>
            {hover === null ? "Último dia" : "Dia"} {diaCurto(p.data)}
          </span>
          <Legenda cor="var(--series-1)" texto={`Receita ${brl(p.receita)}`} />
          <Legenda cor="var(--series-2)" texto={`Gasto ${brl(p.gasto)}`} />
          <span style={{ color: p.receita - p.gasto >= 0 ? "#0ca30c" : "#d03b3b" }}>
            Lucro {brl(p.receita - p.gasto)}
          </span>
        </div>
      )}
    </div>
  );
}

function TabelaSerie({ serie }: { serie: Serie[] }) {
  const linhas = serie.filter((s) => s.receita > 0 || s.gasto > 0);
  if (linhas.length === 0) return <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>Sem movimento no período.</p>;
  return (
    <div style={{ overflowX: "auto", marginTop: 12, maxHeight: 300 }}>
      <table className="viz-table">
        <thead><tr><th>Dia</th><th>Receita</th><th>Gasto</th><th>Lucro</th></tr></thead>
        <tbody>
          {linhas.map((s) => (
            <tr key={s.data}>
              <td style={{ fontVariantNumeric: "tabular-nums" }}>{diaCurto(s.data)}</td>
              <td className="num">{brl(s.receita)}</td>
              <td className="num">{brl(s.gasto)}</td>
              <td className="num" style={{ color: s.receita - s.gasto >= 0 ? "#0ca30c" : "#d03b3b" }}>
                {brl(s.receita - s.gasto)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- barras horizontais: série única, uma cor só ----

function Barras({ produtos }: { produtos: Produto[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...produtos.map((p) => p.receita), 1);

  return (
    <div style={{ display: "grid", gap: 2 }}>
      {produtos.map((p, i) => {
        const pct = (p.receita / max) * 100;
        return (
          <div key={p.titulo + i}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ padding: "5px 0", cursor: "default" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.titulo}
              </span>
              {/* rótulo FORA da barra: nunca corta texto dentro da marca */}
              <span style={{ color: hover === i ? "var(--ink-1)" : "var(--ink-muted)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                {brl(p.receita)} · {p.qtd}×
              </span>
            </div>
            <div style={{ height: 10, background: "var(--bg-input)", borderRadius: 5 }}>
              <div style={{
                width: `${Math.max(pct, 1.5)}%`, height: "100%", borderRadius: 5,
                background: "var(--series-1)", opacity: hover === null || hover === i ? 1 : 0.55,
                transition: "opacity .12s",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
