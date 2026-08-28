import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PainelShell from "../PainelShell";
import ModuloEmBreve from "../ModuloEmBreve";

export default async function ColecoesPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  return (
    <PainelShell email={session.email}>
      <ModuloEmBreve
        grupo="Vitrine"
        titulo="Coleções"
        descricao="Agrupamento de produtos dentro de uma loja — serve pra montar a vitrine em seções e pra segmentar o feed de catálogo por tema."
        fara={[
          "Criar coleção com nome, slug e descrição, vinculada a uma loja",
          "Adicionar e reordenar produtos dentro da coleção",
          "Exibir a vitrine em seções por coleção em /{loja}",
          "Gerar feed de catálogo filtrado por coleção, pra rodar campanha só de um tema",
        ]}
        precisa={[
          "Modelo Collection no schema.prisma, com relação N:N para Product",
          "Migration versionada (npm run db:migrate)",
        ]}
      />
    </PainelShell>
  );
}
