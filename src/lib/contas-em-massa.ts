// ─────────────────────────────────────────────────────────────
// Criação de contas de anúncio em lote, até um alvo por Business
// Center.
//
// Roda em segundo plano (`void rodarLote(id)`), igual ao disparo da
// Conversions API no webhook: um lote com esperas entre tentativas
// leva muito mais que o tempo de uma requisição HTTP. O progresso
// vive no banco e a tela consulta de lá.
//
// SOBRE A INSISTÊNCIA
// O dono do projeto observou que negações às vezes passam numa
// tentativa seguinte, então nada desiste na primeira. O que muda é
// a espera entre tentativas (ver classificarErro/esperaMs em
// tiktok-ads.ts): rajada é o que dispara o rate limit do TikTok e
// gera MAIS negação, então insistir devagar rende mais que insistir
// rápido.
//
// Duas paradas são definitivas, e existem pra insistência não virar
// desperdício silencioso:
//   COTA    — o BC bateu o limite de contas. Nenhuma tentativa cria
//             a 29ª; continuar só marca a conta.
//   NEGOCIO — esgotou maxTentativas. Como o payload é idêntico para
//             todas as contas do lote, o que reprova uma reprova as
//             28: para o BC inteiro e mostra o motivo, em vez de
//             repetir o mesmo erro 28 vezes.
// ─────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import {
  classificarErro,
  countBcAdvertisers,
  createBcAdvertiser,
  esperaMs,
  type NovaContaInput,
} from "@/lib/tiktok-ads";

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Lê o id da conta na resposta, que varia de formato entre versões. */
function extrairAdvertiserId(data: unknown): string | null {
  const d = data as Record<string, unknown> | null;
  if (!d) return null;
  if (typeof d.advertiser_id === "string") return d.advertiser_id;
  if (Array.isArray(d.advertiser_ids) && typeof d.advertiser_ids[0] === "string")
    return d.advertiser_ids[0] as string;
  return null;
}

/** O lote foi parado pela tela? Consultado a cada tentativa. */
async function foiParado(batchId: string): Promise<boolean> {
  const b = await prisma.adAccountBatch.findUnique({
    where: { id: batchId },
    select: { status: true },
  });
  return b?.status === "PARADO";
}

export async function rodarLote(batchId: string): Promise<void> {
  try {
    const lote = await prisma.adAccountBatch.findUnique({
      where: { id: batchId },
      include: { store: { select: { tiktokBusinessToken: true } } },
    });
    if (!lote) return;

    const token = lote.store.tiktokBusinessToken;
    if (!token) {
      await encerrar(batchId, "Loja sem token de Marketing API do TikTok.");
      return;
    }

    const notas: string[] = [];

    for (const bcId of lote.bcIds) {
      if (await foiParado(batchId)) {
        notas.push("Parado pelo painel.");
        break;
      }

      // Quantas já existem define quantas faltam: re-rodar o lote não
      // duplica conta, completa o que falta.
      const { result: contagem, total: existentes } = await countBcAdvertisers(token, bcId);
      if (!contagem.ok) {
        notas.push(`BC ${bcId}: não deu pra contar as contas (${contagem.message}).`);
        continue;
      }

      const faltam = lote.alvoPorBc - existentes;
      if (faltam <= 0) {
        notas.push(`BC ${bcId}: já tem ${existentes} de ${lote.alvoPorBc}, nada a criar.`);
        continue;
      }

      let criadas = 0;
      let motivoParada: string | null = null;

      for (let k = 1; k <= faltam; k++) {
        if (await foiParado(batchId)) {
          motivoParada = "parado pelo painel";
          break;
        }

        const nome = `${lote.nomePrefixo} ${String(existentes + k).padStart(2, "0")}`;
        const conta = await prisma.adAccount.create({
          data: { batchId, bcId, nome },
        });

        const molde: NovaContaInput = {
          bcId,
          name: nome,
          currency: lote.currency,
          timezone: lote.timezone,
          company: lote.company,
          industry: lote.industry,
          registeredArea: lote.registeredArea,
          contactEmail: lote.contactEmail ?? undefined,
          contactName: lote.contactName ?? undefined,
          contactNumber: lote.contactNumber ?? undefined,
          licenseNo: lote.licenseNo ?? undefined,
          qualificationImageIds: lote.qualificationImageIds,
          promotionLink: lote.promotionLink ?? undefined,
          taxId: lote.taxId ?? undefined,
          billingAddress: lote.billingAddress ?? undefined,
        };

        let tentativa = 0;
        let criada = false;

        // Sem teto para erro transitório: rede, servidor e rate limit
        // repetem enquanto a espera cresce. O teto vale pra NEGOCIO.
        for (;;) {
          if (await foiParado(batchId)) {
            motivoParada = "parado pelo painel";
            break;
          }

          tentativa++;
          const r = await createBcAdvertiser(token, molde);

          if (r.ok) {
            await prisma.adAccount.update({
              where: { id: conta.id },
              data: {
                status: "CRIADA",
                tentativas: tentativa,
                externalAdvertiserId: extrairAdvertiserId(r.data),
                ultimaClasse: null,
                ultimoErro: null,
              },
            });
            criada = true;
            criadas++;
            break;
          }

          const classe = classificarErro(r);
          await prisma.adAccount.update({
            where: { id: conta.id },
            data: { tentativas: tentativa, ultimaClasse: classe, ultimoErro: r.message },
          });

          if (classe === "COTA") {
            motivoParada = `BC atingiu o limite de contas (${r.message})`;
            break;
          }
          if (classe === "NEGOCIO" && tentativa >= lote.maxTentativas) {
            motivoParada = `recusa persistente após ${tentativa} tentativas: ${r.message}`;
            break;
          }

          await dormir(esperaMs(classe, tentativa));
        }

        if (!criada) {
          await prisma.adAccount.update({
            where: { id: conta.id },
            data: { status: "ERRO" },
          });
        }
        if (motivoParada) break; // o que barra uma barra as próximas
      }

      notas.push(
        `BC ${bcId}: ${existentes} existentes, ${criadas} criada(s)` +
          (motivoParada ? ` — parou: ${motivoParada}` : " — alvo atingido"),
      );
      if (motivoParada === "parado pelo painel") break;
    }

    await encerrar(batchId, notas.join("\n"));
  } catch (e) {
    // Nada aqui pode escapar: o lote roda solto, sem ninguém pra pegar.
    await encerrar(
      batchId,
      `Falha inesperada: ${e instanceof Error ? e.message : String(e)}`,
    ).catch(() => {});
  }
}

async function encerrar(batchId: string, observacao: string): Promise<void> {
  await prisma.adAccountBatch.update({
    where: { id: batchId },
    data: { status: "CONCLUIDO", observacao },
  });
}
