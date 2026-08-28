// ─────────────────────────────────────────────────────────────
// Leitura tolerante da lista de Business Centers.
//
// O formato da resposta de /bc/get/ não está fixado em documentação
// citável, e a maioria dos BCs em uso não é brasileira — herdar a
// moeda do BC é o que evita recusa por moeda incompatível. Estes
// testes travam o comportamento: acha o que der, null no resto,
// nunca estoura.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { normalizarBcs } from "@/lib/tiktok-ads";

describe("normalizarBcs", () => {
  it("lê o formato com bc_info aninhado", () => {
    const r = normalizarBcs({
      list: [{ bc_info: { bc_id: "7001", name: "Agência US", currency: "USD", timezone: "America/New_York", country: "US" }, user_role: "ADMIN" }],
    });
    expect(r).toEqual([
      { bcId: "7001", nome: "Agência US", moeda: "USD", fuso: "America/New_York", pais: "US" },
    ]);
  });

  it("lê o formato plano, sem bc_info", () => {
    const r = normalizarBcs({ list: [{ bc_id: "7002", name: "BC BR", currency: "BRL" }] });
    expect(r[0].bcId).toBe("7002");
    expect(r[0].moeda).toBe("BRL");
    expect(r[0].fuso).toBeNull();
  });

  it("aceita nomes alternativos de campo", () => {
    const r = normalizarBcs({ bc_list: [{ id: "7003", bc_name: "Outro", time_zone: "Europe/Lisbon", registered_area: "PT" }] });
    expect(r[0]).toEqual({ bcId: "7003", nome: "Outro", moeda: null, fuso: "Europe/Lisbon", pais: "PT" });
  });

  it("descarta item sem id — sem id não dá pra criar conta nele", () => {
    expect(normalizarBcs({ list: [{ name: "sem id" }, { bc_id: "7004" }] }).map((b) => b.bcId))
      .toEqual(["7004"]);
  });

  it("ignora string vazia e devolve null em vez de campo em branco", () => {
    const r = normalizarBcs({ list: [{ bc_id: "7005", name: "  ", currency: "" }] });
    expect(r[0].nome).toBeNull();
    expect(r[0].moeda).toBeNull();
  });

  it.each([null, undefined, {}, { list: null }, { list: "x" }, { list: [null, 3, "a"] }])(
    "devolve lista vazia sem estourar em: %s",
    (entrada) => {
      expect(normalizarBcs(entrada)).toEqual([]);
    },
  );
});
