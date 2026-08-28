import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PainelShell from "../PainelShell";
import ModuloEmBreve from "../ModuloEmBreve";

export default async function MetaAdsPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  return (
    <PainelShell email={session.email}>
      <ModuloEmBreve
        grupo="Anúncios"
        titulo="Meta Ads"
        descricao="O equivalente do módulo de TikTok para a Meta: catálogo de produtos e vídeos alimentando campanha de catálogo."
        fara={[
          "Conectar conta de anúncio e catálogo da Meta, por loja",
          "Publicar o feed que o app já serve em /catalog/{loja}/feed.csv",
          "Subir vídeos e vincular ao catálogo",
          "Criar campanha de catálogo pelo painel",
        ]}
        precisa={[
          "Token de Marketing API da Meta por loja — é outro token, diferente do metaAccessToken que hoje só dispara a CAPI de conversão",
          "Mesma regra do TikTok: campanha nasce desativada",
        ]}
      />
    </PainelShell>
  );
}
