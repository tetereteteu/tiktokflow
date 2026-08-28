// ─────────────────────────────────────────────────────────────
// Destino do cliente depois do pagamento.
//
// A URL é texto de inquilino que vai parar em window.location, então
// o protocolo é validado aqui: `javascript:` numa URL de redirect é
// XSS armazenado, e o campo fica no painel de quem administra a loja.
// Só http e https passam.
//
// Os parâmetros de rastreamento são repassados ao destino porque sem
// eles a atribuição morre no salto: a página de obrigado perde de
// onde a venda veio.
// ─────────────────────────────────────────────────────────────

const PROTOCOLOS = new Set(["http:", "https:"]);

export function montarUrlDestino(
  destino: string | null | undefined,
  params: Record<string, string | null | undefined> = {},
): string | null {
  const cru = (destino ?? "").trim();
  if (!cru) return null;

  let url: URL;
  try {
    url = new URL(cru);
  } catch {
    return null; // relativa ou lixo: não redireciona
  }

  if (!PROTOCOLOS.has(url.protocol)) return null;

  for (const [chave, valor] of Object.entries(params)) {
    const v = (valor ?? "").trim();
    // não sobrescreve o que já veio na URL configurada
    if (v && !url.searchParams.has(chave)) url.searchParams.set(chave, v);
  }

  return url.toString();
}
