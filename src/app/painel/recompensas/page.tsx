import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PainelShell from "../PainelShell";
import ModuloEmBreve from "../ModuloEmBreve";

export default async function RecompensasPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  return (
    <PainelShell email={session.email}>
      <ModuloEmBreve
        grupo="Marketing"
        titulo="Recompensas"
        descricao="Gamificação do faturamento: marcos que o lojista desbloqueia conforme vende."
        fara={[
          "Faixas de faturamento com marco visível no painel (R$ 50 mil, 100 mil, 500 mil, 1 milhão)",
          "Barra de progresso da faixa atual, alimentada pelos pedidos pagos",
          "Registro da data em que cada marco foi batido",
          "Aviso no painel quando um marco é alcançado",
        ]}
        precisa={[
          "Modelos Reward e RewardUnlock no schema",
          "Definição das faixas e do que cada uma entrega — é decisão de negócio, não de código",
        ]}
      />
    </PainelShell>
  );
}
