import { redirect } from "next/navigation";

// A raiz do domínio manda pro painel. As vitrines ficam em /{slug}.
export default function Home() {
  redirect("/painel");
}
