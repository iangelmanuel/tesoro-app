import type { DebtStatus } from "@/features/debts/calculations"
import type { DebtEntry } from "@/features/debts/queries"
import type { DebtKind, ReceivableSchedule } from "@/features/debts/schemas"
import type { IncomeAllocation } from "@/features/recurring-incomes/types"
import type { Database } from "@/types/database"
import type { ACCOUNT_MOVEMENT_KINDS, FORM_PANELS } from "./constants"
import type { TransactionType } from "./filters"

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"]
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"]

/** Valores con los que se prellena un movimiento nuevo */
export interface TransactionInitialValues {
  /** Tipo preseleccionado (gasto por defecto) */
  type?: TransactionType
  amount?: number
  category_id?: string
  occurred_on?: string
  description?: string
  /** Cuenta prellenada (la cuenta por defecto de un ingreso fijo) */
  account_id?: string | null
  /** Ingreso fijo elegido en el select (Marcar recibido) */
  recurring_income_id?: string
  /** Nota copiada de otro movimiento (Duplicar, SPEC 49) */
  note?: string
  /** Cliente o proveedor copiado de otro movimiento (Empresa, SPEC 49) */
  counterparty?: string | null
}

/** Ocurrencia de gasto fijo que paga el movimiento nuevo */
export interface RecurringOccurrenceLink {
  recurringExpenseId: string
  dueOn: string
}

/** Opciones del selector que no son un tipo de movimiento */
export type FormPanel = (typeof FORM_PANELS)[number]

export interface TransactionFormState {
  /** true cuando la acción terminó bien */
  ok?: boolean
  /** Error general (movimiento no encontrado, error de la BD, etc.) */
  error?: string
  /** Errores de validación por campo */
  fieldErrors?: Partial<Record<string, string[]>>
  /** Valores enviados, para no vaciar el formulario si hay error */
  values?: Record<string, string>
  /** Reparto guardado entre las ocurrencias de un ingreso fijo (SPEC 38) */
  allocations?: IncomeAllocation[]
}

export interface TransactionActionResult {
  error?: string
}

/** Movimiento con su categoría (Resumen y reportes) */
export type TransactionWithCategory = TransactionRow & {
  category: Pick<CategoryRow, "id" | "name" | "icon" | "color" | "archived_at">
}

/** Campos de un movimiento que usa el diálogo de edición */
export type EditableTransaction = Pick<
  TransactionRow,
  | "id"
  | "type"
  | "amount"
  | "occurred_on"
  | "occurred_time"
  | "category_id"
  | "description"
  | "note"
  | "account_id"
  | "counterparty"
  | "invoice_ref"
  | "recurring_expense_id"
  | "recurring_income_id"
> & {
  /** Lo que este ingreso cubrió de cada ocurrencia de su ingreso fijo (SPEC 38) */
  recurring_income_allocations: IncomeAllocation[]
}

/**
 * Abono enlazado a un movimiento: pago de préstamo o cobro de una cuenta por
 * cobrar (SPEC 26). Es la fuente de verdad: el movimiento se edita y elimina
 * desde el diálogo del pago. Trae lo que ese diálogo prellena del abono; la
 * cuenta, la descripción y la categoría salen del movimiento. Al guardar, la
 * nota del abono pasa también al movimiento (SPEC 42).
 */
export type LinkedDebtEntry = Pick<
  DebtEntry,
  | "id"
  | "debt_id"
  | "workspace_id"
  | "kind"
  | "amount"
  | "occurred_on"
  | "occurred_time"
  | "note"
  | "transaction_id"
  | "is_extra_payment"
> & {
  debt_kind: DebtKind
  /** Estado y tipo de cobro de la deuda: deciden si se duplica (SPEC 49) */
  debt_status: DebtStatus
  debt_schedule: ReceivableSchedule | null
}

/** Hora y posición manual dentro del día, comunes a toda fila de Movimientos */
export interface LedgerOrder {
  /** "HH:MM:SS" desde Postgres; null si el usuario no la puso */
  occurred_time: string | null
  /** 0 = fila nueva (arriba del día); 1..n tras reordenar. No se edita */
  day_position: number
}

/**
 * Fila de Movimientos: un ingreso o gasto, un traspaso o un ajuste de saldo.
 * La categoría y la cuenta se resuelven en la tabla con las listas que la
 * página ya carga.
 */
export type LedgerEntry = LedgerOrder &
  (
    | {
        kind: TransactionType
        transaction: EditableTransaction
        /** Abono enlazado, si el movimiento es un pago de deuda */
        debt_entry: LinkedDebtEntry | null
      }
    | {
        kind: "transfer"
        id: string
        amount: number
        occurred_on: string
        note: string | null
        from_account_id: string
        to_account_id: string
      }
    | {
        kind: "adjustment"
        id: string
        /** > 0 sube el saldo */
        amount: number
        occurred_on: string
        note: string | null
        account_id: string
      }
    | {
        kind: AccountMovementKind
        id: string
        /** En un aporte de meta, < 0 es un retiro */
        amount: number
        occurred_on: string
        note: string | null
        account_id: string
        /** Nombre de la deuda o la meta */
        name: string
        /** Deuda o meta de origen; el diálogo de edición la necesita */
        parent_id: string
        /** Pago de tarjeta que es un abono extra (no cubre el mínimo) */
        is_extra_payment: boolean
        /** La deuda o la meta sigue activa: se puede duplicar (SPEC 49) */
        parent_active: boolean
      }
  )

/** Pago o avance de tarjeta, o aporte de meta, con cuenta (SPEC 16) */
export type AccountMovementKind = (typeof ACCOUNT_MOVEMENT_KINDS)[number]

/** Totales de ingresos y gastos del periodo filtrado */
export interface TransactionTotals {
  income: number
  expense: number
  balance: number
}

/**
 * Fila de Verificar movimientos (SPEC 19): plana y de solo lectura. `kind` es
 * el de ledger_entries; en un aporte de meta, el signo del monto distingue
 * aporte y retiro.
 */
export interface VerifyEntry {
  key: string
  kind: string
  amount: number
  occurred_on: string
  occurred_time: string | null
  account_id: string | null
  to_account_id: string | null
  /** Descripción del movimiento o nombre de la deuda o la meta */
  title: string
  note: string | null
}
