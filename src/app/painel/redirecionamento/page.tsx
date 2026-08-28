import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PainelShell from "../PainelShell";
import ModuloEmBreve from "../ModuloEmBreve";

export default async function RedirecionamentoPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  return (
    <PainelShell email={session.email}>
      <ModuloEmBreve
        grupo="Checkout"
        titulo="Redirecionamento"
        descricao="Para onde o cliente vai depois de pagar. Hoje todo pedido cai na tela de pós-compra com o upsell."
        fara={[
          "Definir a URL de destino após o pagamento, por loja",
          "Destino alternativo por produto, quando um item precisa de página própria",
          "Preservar os parâmetros de rastreamento na URL de destino, pra não perder a atribuição",
          "Escolher entre ir direto ao destino ou passar antes pelo upsell",
        ]}
        precisa={[
          "Campo de URL de destino em Store, e opcional em Product",
          "Migration versionada",
        ]}
      />
    </PainelShell>
  );
}
