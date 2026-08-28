// ─────────────────────────────────────────────────────────────
// Tela de módulo que existe na navegação mas ainda não tem
// funcionalidade.
//
// Não é placeholder vazio de propósito: cada uma declara o que o
// módulo vai fazer e o que falta pra construir. Assim a estrutura
// do painel fica navegável e legível antes da implementação, e a
// própria tela serve de especificação na hora de implementar.
//
// Ao implementar um módulo, troque este componente pela tela real
// e marque `pronto: true` no GRUPOS de PainelShell.tsx — é isso
// que apaga a etiqueta "em breve" da lateral.
// ─────────────────────────────────────────────────────────────

export default function ModuloEmBreve({
  grupo,
  titulo,
  descricao,
  fara,
  precisa,
}: {
  grupo: string;
  titulo: string;
  descricao: string;
  fara: string[];
  precisa?: string[];
}) {
  return (
    <div>
      <div className="eyebrow">{grupo}</div>
      <h1 className="display" style={{ fontSize: 34 }}>
        {titulo}
      </h1>
      <p
        className="muted"
        style={{ fontSize: 13, margin: "6px 0 20px", maxWidth: 640, lineHeight: 1.6 }}
      >
        {descricao}
      </p>

      <div className="card" style={{ padding: 24, maxWidth: 640 }}>
        <span
          style={{
            display: "inline-block",
            padding: "3px 10px",
            borderRadius: 999,
            border: "1px solid var(--border-strong)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--text-dim)",
          }}
        >
          Ainda não implementado
        </span>

        <Bloco titulo="O que este módulo vai fazer" itens={fara} />
        {precisa && precisa.length > 0 && (
          <Bloco titulo="O que falta para construir" itens={precisa} dim />
        )}
      </div>
    </div>
  );
}

function Bloco({
  titulo,
  itens,
  dim,
}: {
  titulo: string;
  itens: string[];
  dim?: boolean;
}) {
  return (
    <div style={{ marginTop: 20 }}>
      <h2
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: dim ? "var(--text-dim)" : "var(--gold-soft)",
          marginBottom: 10,
        }}
      >
        {titulo}
      </h2>
      <ul style={{ display: "grid", gap: 9, paddingLeft: 0, listStyle: "none" }}>
        {itens.map((t) => (
          <li
            key={t}
            style={{
              display: "flex",
              gap: 10,
              fontSize: 13.5,
              lineHeight: 1.55,
              color: dim ? "var(--text-dim)" : "var(--text-muted)",
            }}
          >
            <span style={{ color: "var(--border-strong)", flex: "none" }}>—</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
