import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PainelShell from "../PainelShell";
import ModuloEmBreve from "../ModuloEmBreve";

export default async function FretesPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  return (
    <PainelShell email={session.email}>
      <ModuloEmBreve
        grupo="Logística"
        titulo="Fretes"
        descricao="Tabela de frete por loja, somada ao valor do pedido no checkout."
        fara={[
          "Cadastro manual de faixas de frete: nome, prazo, valor e imagem",
          "Cálculo pelos Correios (nacional) a partir do CEP",
          "Frete grátis acima de um valor",
          "Somar o frete ao total antes de gerar o Pix",
        ]}
        precisa={[
          "Modelo ShippingRate no schema e campo de frete em Order",
          "Coleta de CEP e endereço no checkout — hoje o formulário não pede endereço",
          "Cuidado no BI: o valor do pedido passa a ter duas parcelas (produto e frete), e receita não pode contar frete como faturamento de produto",
        ]}
      />
    </PainelShell>
  );
}
