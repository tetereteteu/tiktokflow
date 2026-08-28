// ─────────────────────────────────────────────────────────────
// Cálculo do frete do pedido.
//
// O valor NUNCA vem do browser: o checkout manda só o id da faixa e
// o servidor resolve o preço aqui. Preço de frete vindo do cliente
// seria preço escolhido pelo comprador.
//
// O nome é devolvido junto pra virar cópia no pedido: a tabela de
// frete muda com o tempo, e o pedido antigo precisa continuar
// mostrando o que foi cobrado.
// ─────────────────────────────────────────────────────────────

export interface FaixaFrete {
  id: string;
  nome: string;
  priceCents: number;
  ativo: boolean;
}

export interface ResultadoFrete {
  cents: number;
  nome: string | null;
  gratis: boolean;
}

export function calcularFrete(params: {
  faixa: FaixaFrete | null | undefined;
  /** produto + bump, SEM frete — senão o frete ajudaria a atingir o próprio limite */
  subtotalCents: number;
  freteGratisAcimaCents?: number | null;
}): ResultadoFrete {
  const { faixa, subtotalCents, freteGratisAcimaCents } = params;

  if (!faixa || !faixa.ativo) return { cents: 0, nome: null, gratis: false };

  // Zero ou nulo desliga a regra. Sem essa guarda, um campo limpo
  // como "0" tornaria todo frete grátis sem ninguém pedir.
  const limite =
    typeof freteGratisAcimaCents === "number" && freteGratisAcimaCents > 0
      ? freteGratisAcimaCents
      : null;

  if (limite !== null && subtotalCents >= limite) {
    return { cents: 0, nome: `${faixa.nome} (grátis)`, gratis: true };
  }

  return { cents: Math.max(0, Math.round(faixa.priceCents)), nome: faixa.nome, gratis: false };
}
