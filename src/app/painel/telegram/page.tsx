import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PainelShell from "../PainelShell";
import ModuloEmBreve from "../ModuloEmBreve";

export default async function TelegramPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  return (
    <PainelShell email={session.email}>
      <ModuloEmBreve
        grupo="Marketing"
        titulo="Telegram"
        descricao="Funil de venda de acesso a grupo ou canal no Telegram, tocado por bot: apresentação, planos, Pix, upsell e downsell."
        fara={[
          "Cadastrar um bot por loja (token do BotFather) e o grupo ou canal de destino",
          "Montar o funil: mensagem de apresentação, planos e preços",
          "Gerar Pix dentro da conversa, usando o mesmo fluxo de pedido do checkout",
          "Liberar e remover acesso ao grupo conforme o pagamento e a renovação",
          "Upsell e downsell automáticos quando o cliente não fecha",
          "Cobrar o Pix pendente pela própria conversa",
        ]}
        precisa={[
          "Modelos TelegramBot, TelegramPlan e assinatura no schema",
          "Rota de webhook do Telegram",
          "Decisão sobre recorrência: a cobrança da Nerva hoje é avulsa, não assinatura",
        ]}
      />
    </PainelShell>
  );
}
