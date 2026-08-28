import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PainelShell from "../PainelShell";
import ModuloEmBreve from "../ModuloEmBreve";

export default async function PagamentosPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  return (
    <PainelShell email={session.email}>
      <ModuloEmBreve
        grupo="Checkout"
        titulo="Pagamentos"
        descricao="Quais meios de pagamento cada loja aceita e qual gateway processa cada um. Hoje o checkout gera só Pix, pela Nerva."
        fara={[
          "Ligar e desligar meio de pagamento por loja: Pix, cartão, boleto",
          "Escolher qual gateway processa cada meio, por loja ou por domínio",
          "Parcelamento: número de parcelas e quem absorve a taxa",
          "Descrição que aparece na fatura do cliente",
          "Retentativa automática quando o gateway recusa",
        ]}
        precisa={[
          "Módulo Gateways concluído — não há o que escolher com um gateway só",
          "Campos de cartão no checkout: hoje o formulário coleta só o que o Pix exige (CPF, nome, e-mail, telefone)",
        ]}
      />
    </PainelShell>
  );
}
