// ─────────────────────────────────────────────────────────────
// Feed CSV de catálogo.
//
// A regra de preço é o ponto sensível: "price" é o cheio e
// "sale_price" o promocional. Inverter faz o anúncio anunciar
// desconto ao contrário — e não gera erro em lugar nenhum, só
// aparece na plataforma.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { csv, reais, linhaFeed, CABECALHO, type ProdutoFeed } from "@/lib/feed-catalogo";

const ctx = {
  baseUrl: "https://tkkplus.online",
  storeSlug: "loja-demo",
  storeName: "Loja Demo",
  productType: "Verão",
};

const base: ProdutoFeed = {
  id: "p1", title: "Camiseta", slug: "camiseta",
  description: "Algodão", priceCents: 9700, compareAtCents: null, imageUrl: null,
};

const colunas = (p: ProdutoFeed) => linhaFeed(p, ctx).split(",");

describe("csv", () => {
  it("passa texto simples sem aspas", () => {
    expect(csv("Camiseta")).toBe("Camiseta");
  });
  it("põe aspas quando há vírgula", () => {
    expect(csv("Camiseta, azul")).toBe('"Camiseta, azul"');
  });
  it("duplica aspas internas", () => {
    expect(csv('Tamanho "M"')).toBe('"Tamanho ""M"""');
  });
  it("achata quebra de linha — quebra virava linha nova no CSV", () => {
    expect(csv("linha1\nlinha2")).toBe("linha1 linha2");
    expect(csv("linha1\r\nlinha2")).toBe("linha1 linha2");
  });
  it("null e undefined viram vazio", () => {
    expect(csv(null)).toBe("");
    expect(csv(undefined)).toBe("");
  });
});

describe("reais", () => {
  it.each([[9700, "97.00 BRL"], [1999, "19.99 BRL"], [7, "0.07 BRL"], [0, "0.00 BRL"]])(
    "%i centavos vira %s", (c, esperado) => expect(reais(c)).toBe(esperado),
  );
});

describe("linhaFeed", () => {
  it("sem preço comparativo: price é o real e sale_price fica vazio", () => {
    const c = colunas(base);
    expect(c[5]).toBe("97.00 BRL"); // price
    expect(c[6]).toBe("");          // sale_price
  });

  it("com promoção: price é o cheio e sale_price o com desconto", () => {
    const c = colunas({ ...base, compareAtCents: 14700 });
    expect(c[5]).toBe("147.00 BRL");
    expect(c[6]).toBe("97.00 BRL");
  });

  it("compareAt menor que o preço é ignorado — não existe desconto negativo", () => {
    const c = colunas({ ...base, compareAtCents: 5000 });
    expect(c[5]).toBe("97.00 BRL");
    expect(c[6]).toBe("");
  });

  it("compareAt igual ao preço não vira promoção", () => {
    const c = colunas({ ...base, compareAtCents: 9700 });
    expect(c[6]).toBe("");
  });

  it("o link aponta pro checkout do produto, não pra página de produto", () => {
    expect(colunas(base)[7]).toBe("https://tkkplus.online/loja-demo/checkout/camiseta");
  });

  it("sem descrição, usa o título", () => {
    expect(colunas({ ...base, description: null })[2]).toBe("Camiseta");
  });

  it("product_type recebe a coleção", () => {
    expect(colunas(base)[10]).toBe("Verão");
  });

  it("título com vírgula não desloca as colunas", () => {
    const linha = linhaFeed({ ...base, title: "Camiseta, azul" }, ctx);
    // com aspas, o split ingênuo quebra — o que importa é a linha ter o campo citado
    expect(linha).toContain('"Camiseta, azul"');
    expect(linha.split(",").length).toBeGreaterThan(CABECALHO.split(",").length);
  });

  it("o cabeçalho tem 11 colunas", () => {
    expect(CABECALHO.split(",")).toHaveLength(11);
    expect(colunas(base)).toHaveLength(11);
  });
});
