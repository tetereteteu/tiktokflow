// ─────────────────────────────────────────────────────────────
// Configuração de pagamento por loja.
//
// A Nerva aceita expiração de 300 a 86400 segundos e recusa a
// cobrança fora disso. Limitar aqui, e não confiar no formulário,
// evita que um número digitado errado no painel derrube a venda
// inteira — que é falha silenciosa: o cliente vê "erro ao gerar Pix"
// e vai embora.
// ─────────────────────────────────────────────────────────────

export const EXPIRACAO_MIN = 300; // 5 min
export const EXPIRACAO_MAX = 86_400; // 24 h
export const EXPIRACAO_PADRAO = 3_600; // 1 h

export function limitarExpiracao(segundos: unknown): number {
  // null, undefined e "" precisam ser barrados ANTES do Number():
  // Number(null) é 0, o que cairia no mínimo de 5 minutos em vez do
  // padrão de 1 hora. Pix expirando cedo demais derruba conversão.
  if (segundos === null || segundos === undefined || segundos === "") {
    return EXPIRACAO_PADRAO;
  }
  const n = Math.round(Number(segundos));
  if (!Number.isFinite(n)) return EXPIRACAO_PADRAO;
  return Math.min(Math.max(n, EXPIRACAO_MIN), EXPIRACAO_MAX);
}

/**
 * Texto que aparece na cobrança. Sem descrição própria da loja, usa
 * o nome do produto (com o bump junto, quando houver) — o mesmo que
 * o checkout já fazia.
 */
export function montarDescricaoFatura(
  descricaoDaLoja: string | null | undefined,
  tituloProduto: string,
  tituloBump?: string | null,
): string {
  const proprio = (descricaoDaLoja ?? "").trim();
  if (proprio) return proprio.slice(0, 120);

  const base = tituloBump ? `${tituloProduto} + ${tituloBump}` : tituloProduto;
  return base.slice(0, 120);
}
