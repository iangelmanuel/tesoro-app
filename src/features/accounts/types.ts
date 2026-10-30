import type { Database } from "@/types/database"

export type AccountKind = Database["public"]["Enums"]["account_kind"]

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"]

export type AccountWithBalance = AccountRow & {
  balance: number
  scheduled_balance: number
  last_activity_on: string | null
}

export type LedgerKind = "income" | "expense" | "transfer" | "adjustment"

export interface AccountFormState {
  /** true cuando la acción terminó bien */
  ok?: boolean
  /** Error general (cuenta no encontrada, error de la BD, etc.) */
  error?: string
  /** Errores de validación por campo */
  fieldErrors?: Partial<Record<string, string[]>>
  /** Valores enviados, para no vaciar el formulario si hay error */
  values?: Record<string, string>
}

export type TransferFormState = AccountFormState

export type AdjustAccountFormState = AccountFormState

export interface AccountActionResult {
  error?: string
}
