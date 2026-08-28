// ─────────────────────────────────────────────────────────────
// Sobe um certificado para o Business Center e devolve o image_id.
//
// O arquivo passa por aqui em vez de ir do browser direto ao TikTok
// porque o token de Marketing API é da loja e não pode ser exposto
// ao cliente.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canManageStore } from "@/lib/admin";
import { uploadBcImage } from "@/lib/tiktok-ads";

const TAMANHO_MAX = 10 * 1024 * 1024; // 10 MB
const TIPOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Envio inválido" }, { status: 400 });

  const storeId = String(form.get("storeId") ?? "");
  const bcId = String(form.get("bcId") ?? "").trim();
  const arquivo = form.get("arquivo");

  if (!storeId || !(await canManageStore(session, storeId)))
    return NextResponse.json({ error: "Sem acesso a esta loja" }, { status: 403 });
  if (!bcId)
    return NextResponse.json({ error: "Informe o Business Center" }, { status: 400 });
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return NextResponse.json({ error: "Selecione um arquivo" }, { status: 400 });
  if (arquivo.size > TAMANHO_MAX)
    return NextResponse.json({ error: "Arquivo acima de 10 MB" }, { status: 400 });
  if (arquivo.type && !TIPOS.includes(arquivo.type))
    return NextResponse.json(
      { error: `Tipo não aceito: ${arquivo.type}. Use JPG, PNG, WEBP ou PDF.` },
      { status: 400 },
    );

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { tiktokBusinessToken: true },
  });
  if (!store?.tiktokBusinessToken)
    return NextResponse.json(
      { error: "Cadastre o token de Marketing API do TikTok nesta loja antes." },
      { status: 400 },
    );

  const r = await uploadBcImage(
    store.tiktokBusinessToken, bcId, arquivo, arquivo.name || "certificado",
  );
  if (!r.ok)
    return NextResponse.json({ error: r.message, code: r.code }, { status: 502 });

  const imageId = r.data?.image_id;
  if (!imageId)
    return NextResponse.json(
      { error: "O TikTok aceitou o arquivo mas não devolveu o id da imagem." },
      { status: 502 },
    );

  return NextResponse.json({ imageId, nome: arquivo.name });
}
