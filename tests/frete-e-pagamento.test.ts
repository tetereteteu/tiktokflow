// ─────────────────────────────────────────────────────────────
// Frete e configuração de cobrança.
//
// As duas regras aqui mexem em dinheiro: o frete entra no total que
// o cliente paga, e a expiração fora do intervalo faz a Nerva
// recusar a cobrança — o cliente vê "erro ao gerar Pix" e vai embora,
// sem nada aparecer no log.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { calcularFrete, type FaixaFrete } from "@/lib/frete";
import {
  limitarExpiracao, montarDescricaoFatura,
  EXPIRACAO_MIN, EXPIRACAO_MAX, EXPIRACAO_PADRAO,
} from "@/lib/pagamentos";

const pac: FaixaFrete = { id: "f1", nome: "PAC", priceCents: 1990, ativo: true };

describe("calcularFrete", () => {
  it("sem faixa escolhida não cobra frete", () => {
    expect(calcularFrete({ faixa: null, subtotalCents: 9700 }))
      .toEqual({ cents: 0, nome: null, gratis: false });
  });

  it("faixa inativa não cobra — desativar tem que valer na hora", () => {
    expect(calcularFrete({ faixa: { ...pac, ativo: false }, subtotalCents: 9700 }).cents).toBe(0);
  });

  it("cobra o valor da faixa", () => {
    expect(calcularFrete({ faixa: pac, subtotalCents: 9700 }))
      .toEqual({ cents: 1990, nome: "PAC", gratis: false });
  });

  it("zera acima do limite de frete grátis", () => {
    const r = calcularFrete({ faixa: pac, subtotalCents: 20000, freteGratisAcimaCents: 15000 });
    expect(r.cents).toBe(0);
    expect(r.gratis).toBe(true);
    expect(r.nome).toBe("PAC (grátis)");
  });

  it("no valor exato do limite já é grátis", () => {
    expect(calcularFrete({ faixa: pac, subtotalCents: 15000, freteGratisAcimaCents: 15000 }).cents).toBe(0);
  });

  it("um centavo abaixo do limite ainda cobra", () => {
    expect(calcularFrete({ faixa: pac, subtotalCents: 14999, freteGratisAcimaCents: 15000 }).cents).toBe(1990);
  });

  it.each([null, undefined, 0, -1])(
    "limite %s desliga a regra — campo zerado não pode tornar tudo grátis",
    (limite) => {
      expect(calcularFrete({ faixa: pac, subtotalCents: 999999, freteGratisAcimaCents: limite as number }).cents)
        .toBe(1990);
    },
  );

  it("frete negativo é tratado como zero", () => {
    expect(calcularFrete({ faixa: { ...pac, priceCents: -500 }, subtotalCents: 100 }).cents).toBe(0);
  });

  it("devolve o nome pra virar cópia no pedido", () => {
    expect(calcularFrete({ faixa: pac, subtotalCents: 100 }).nome).toBe("PAC");
  });
});

describe("limitarExpiracao", () => {
  it("mantém valor dentro do intervalo", () => {
    expect(limitarExpiracao(1800)).toBe(1800);
  });
  it("puxa para o mínimo quando é curto demais", () => {
    expect(limitarExpiracao(60)).toBe(EXPIRACAO_MIN);
    expect(limitarExpiracao(0)).toBe(EXPIRACAO_MIN);
    expect(limitarExpiracao(-10)).toBe(EXPIRACAO_MIN);
  });
  it("puxa para o máximo quando passa de 24h", () => {
    expect(limitarExpiracao(999999)).toBe(EXPIRACAO_MAX);
  });
  it.each([null, undefined, "abc", NaN, {}])(
    "valor inválido (%s) cai no padrão em vez de derrubar a cobrança", (v) => {
      expect(limitarExpiracao(v)).toBe(EXPIRACAO_PADRAO);
    },
  );
  it("aceita os limites exatos", () => {
    expect(limitarExpiracao(EXPIRACAO_MIN)).toBe(EXPIRACAO_MIN);
    expect(limitarExpiracao(EXPIRACAO_MAX)).toBe(EXPIRACAO_MAX);
  });
});

describe("montarDescricaoFatura", () => {
  it("sem descrição da loja usa o produto", () => {
    expect(montarDescricaoFatura(null, "Camiseta")).toBe("Camiseta");
  });
  it("junta o order bump, como antes", () => {
    expect(montarDescricaoFatura("", "Camiseta", "Meia")).toBe("Camiseta + Meia");
  });
  it("descrição da loja vence o nome do produto", () => {
    expect(montarDescricaoFatura("LOJA XYZ", "Camiseta", "Meia")).toBe("LOJA XYZ");
  });
  it("espaço em branco não conta como descrição", () => {
    expect(montarDescricaoFatura("   ", "Camiseta")).toBe("Camiseta");
  });
  it("corta em 120 caracteres — fatura tem limite", () => {
    expect(montarDescricaoFatura("x".repeat(300), "Camiseta")).toHaveLength(120);
    expect(montarDescricaoFatura(null, "y".repeat(300))).toHaveLength(120);
  });
});
