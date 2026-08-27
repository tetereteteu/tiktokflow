"use client";

export default function CopyPix({ code }: { code: string }) {
  return (
    <button
      onClick={(e) => {
        navigator.clipboard.writeText(code);
        (e.currentTarget as HTMLButtonElement).textContent = "Copiado ✓";
      }}
      style={{
        background: "none",
        border: "none",
        color: "var(--gold)",
        fontSize: 13,
        cursor: "pointer",
        padding: 0,
        fontFamily: "inherit",
      }}
    >
      Copiar código
    </button>
  );
}
