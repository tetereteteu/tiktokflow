// ─────────────────────────────────────────────────────────────
// Config do Vitest. Ambiente node porque tudo que testamos é
// server-side: assinatura de webhook, conversão de dinheiro e o
// handler da rota. Nada de DOM.
//
// O alias "@" espelha o de tsconfig.json — sem ele os imports
// "@/lib/..." não resolvem dentro do teste. Extensão .mts porque
// o arquivo é ESM; com .ts o Vite avisa que está carregando como
// CommonJS.
// ─────────────────────────────────────────────────────────────

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
