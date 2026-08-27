"use client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/painel/login");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="btn btn--ghost"
      style={{ width: "auto", padding: "8px 14px", fontSize: 13 }}
    >
      Sair
    </button>
  );
}
