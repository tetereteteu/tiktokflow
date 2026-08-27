"use client";

import { useEffect } from "react";
import { collectTracking } from "@/lib/tracking";

// Ao carregar a vitrine (geralmente o primeiro toque vindo do anúncio),
// captura e persiste os UTMs/click IDs no localStorage, pra não perder
// a atribuição quando o cliente for pro checkout.
export default function TrackingCapture() {
  useEffect(() => {
    collectTracking();
  }, []);
  return null;
}
