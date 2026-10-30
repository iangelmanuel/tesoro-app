import type {
  CategoryColorKey,
  CategoryIconKey
} from "@/features/categories/constants"
import type { AccountKind } from "./types"

export const ACCOUNT_KINDS = [
  "cash",
  "bank",
  "wallet",
  "other"
] as const satisfies readonly AccountKind[]

// Etiqueta, icono y color por defecto de cada tipo. El icono y el color se
// pueden cambiar con el picker de categorías.
export const ACCOUNT_KIND_META = {
  cash: { label: "Efectivo", icon: "banknote", color: "emerald" },
  bank: { label: "Banco", icon: "landmark", color: "blue" },
  wallet: { label: "Billetera digital", icon: "wallet", color: "violet" },
  other: { label: "Otra", icon: "wallet", color: "slate" }
} as const satisfies Record<
  AccountKind,
  { label: string; icon: CategoryIconKey; color: CategoryColorKey }
>

// Valor del filtro ?account= para los movimientos sin cuenta
export const NO_ACCOUNT = "none"
