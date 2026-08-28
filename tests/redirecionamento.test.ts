// ─────────────────────────────────────────────────────────────
// URL de destino pós-pagamento.
//
// O campo é preenchido no painel e vai para window.location, então
// a validação de protocolo é uma guarda de segurança, não formatação:
// `javascript:` ali é XSS armazenado.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { montarUrlDestino } from "@/lib/redirecionamento";

describe("montarUrlDestino", () => {
  it("devolve a URL quando não há parâmetros", () => {
    expect(montarUrlDestino("https://obrigado.com")).toBe("https://obrigado.com/");
  });

  it.each([null, undefined, "", "   "])("sem destino (%s) não redireciona", (v) => {
    expect(montarUrlDestino(v)).toBeNull();
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
  ])("BLOQUEIA protocolo perigoso: %s", (u) => {
    expect(montarUrlDestino(u)).toBeNull();
  });

  it("rejeita URL relativa ou texto solto", () => {
    expect(montarUrlDestino("/obrigado")).toBeNull();
    expect(montarUrlDestino("obrigado.com")).toBeNull();
  });

  it("aceita http além de https", () => {
    expect(montarUrlDestino("http://obrigado.com")).toBe("http://obrigado.com/");
  });

  it("repassa o rastreamento — sem isso a atribuição morre no salto", () => {
    const u = montarUrlDestino("https://obrigado.com", {
      utm_source: "tiktok", ttclid: "abc123", order: "ped-1",
    });
    const p = new URL(u!).searchParams;
    expect(p.get("utm_source")).toBe("tiktok");
    expect(p.get("ttclid")).toBe("abc123");
    expect(p.get("order")).toBe("ped-1");
  });

  it("ignora parâmetro vazio, nulo ou só espaço", () => {
    const u = montarUrlDestino("https://obrigado.com", {
      utm_source: "", ttclid: null, gclid: undefined, fbclid: "  ",
    });
    expect(new URL(u!).search).toBe("");
  });

  it("não sobrescreve parâmetro que já estava na URL configurada", () => {
    const u = montarUrlDestino("https://obrigado.com/?utm_source=direto", {
      utm_source: "tiktok",
    });
    expect(new URL(u!).searchParams.get("utm_source")).toBe("direto");
  });

  it("preserva caminho e query originais", () => {
    const u = montarUrlDestino("https://obrigado.com/vip?plano=ouro", { order: "p1" });
    const url = new URL(u!);
    expect(url.pathname).toBe("/vip");
    expect(url.searchParams.get("plano")).toBe("ouro");
    expect(url.searchParams.get("order")).toBe("p1");
  });

  it("escapa valor com caractere especial", () => {
    const u = montarUrlDestino("https://obrigado.com", { utm_campaign: "a b&c=d" });
    expect(new URL(u!).searchParams.get("utm_campaign")).toBe("a b&c=d");
  });
});
