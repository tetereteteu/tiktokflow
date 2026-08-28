import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PainelShell from "../PainelShell";
import ModuloEmBreve from "../ModuloEmBreve";

export default async function CampanhasPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  return (
    <PainelShell email={session.email}>
      <ModuloEmBreve
        grupo="Anúncios"
        titulo="Campanhas em massa"
        descricao="Publicar a mesma campanha em várias contas de anúncio de uma vez, a partir de um modelo salvo."
        fara={[
          "Salvar modelo de campanha: objetivo, orçamento, segmentação e criativo",
          "Escolher várias contas anunciantes e publicar em todas de uma vez",
          "Definir quantas campanhas, conjuntos e anúncios por conta",
          "Acompanhar o que subiu e o que falhou, por conta, com o erro legível",
        ]}
        precisa={[
          "O módulo TikTok Ads já cria uma campanha — falta o modelo salvo e o disparo múltiplo",
          "A campanha continua nascendo desativada, como hoje: publicar em lote já ativo queima verba num clique errado",
        ]}
      />
    </PainelShell>
  );
}
