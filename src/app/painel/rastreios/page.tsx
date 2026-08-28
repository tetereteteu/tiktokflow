import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PainelShell from "../PainelShell";
import ModuloEmBreve from "../ModuloEmBreve";

export default async function RastreiosPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  return (
    <PainelShell email={session.email}>
      <ModuloEmBreve
        grupo="Logística"
        titulo="Rastreios"
        descricao="Código de rastreio do pedido e a página onde o cliente acompanha a entrega, no domínio da própria loja."
        fara={[
          "Vincular código de rastreio e transportadora a um pedido",
          "Página pública de acompanhamento no domínio da loja",
          "Importação de códigos em lote",
          "Avisar o cliente quando o código é cadastrado",
        ]}
        precisa={[
          "Modelo Shipment no schema, ligado a Order",
          "Módulo Fretes antes: rastreio sem entrega configurada não tem o que acompanhar",
        ]}
      />
    </PainelShell>
  );
}
