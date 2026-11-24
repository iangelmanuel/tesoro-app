import { amountInput } from "@/components/forms/amount-format"
import type { Category } from "@/features/categories/queries"
import { OTHER_INCOME } from "@/features/recurring-incomes/constants"
import type { WorkspaceType } from "@/features/workspaces/types"
import { FORM_PANELS } from "./constants"
import type { TransactionType } from "./filters"
import type {
  EditableTransaction,
  FormPanel,
  TransactionInitialValues
} from "./types"

// Valores iniciales, textos y prellenados del diálogo de movimiento. Puro: lo
// usan TransactionDialog y useTransactionForm, y se prueba sin React.

/** Textos que cambian entre Personal y Empresa */
export const TRANSACTION_COPY = {
  personal: {
    expense: "Salida",
    income: "Entrada",
    description: "Registra una entrada o una salida de tu espacio Personal.",
    placeholder: { expense: "Mercado de la semana", income: "Salario" }
  },
  business: {
    expense: "Salida",
    income: "Entrada",
    description: "Registra una entrada o una salida de tu empresa.",
    placeholder: { expense: "Compra de insumos", income: "Venta del día" }
  }
} as const

/** El valor del selector de tipo abre otro formulario (traspaso, pagos) */
export function isFormPanel(value: unknown): value is FormPanel {
  return FORM_PANELS.some((panel) => panel === value)
}

/** Título y descripción del diálogo: editar, registrar un pago o nuevo */
export function transactionDialogText(
  mode: { isEditing: boolean; isPayment: boolean },
  workspaceType: WorkspaceType
) {
  if (mode.isEditing) {
    return {
      title: "Editar movimiento",
      description: "Cambia los datos del movimiento."
    }
  }
  if (mode.isPayment) {
    return {
      title: "Registrar pago",
      description: "Confirma los datos del pago. Puedes ajustar el monto."
    }
  }
  return {
    title: "Nuevo movimiento",
    description: TRANSACTION_COPY[workspaceType].description
  }
}

/** Título del toast al guardar */
export function savedToastTitle(mode: {
  isEditing: boolean
  isPayment: boolean
}) {
  if (mode.isEditing) return "Movimiento actualizado"
  return mode.isPayment ? "Pago registrado" : "Movimiento registrado"
}

/** Campos que el select "Ingreso fijo" prellena (SPEC 30 y 41) */
export interface PrefillFields {
  amount: string
  category: string
  account: string
  description: string
}

const EMPTY_PREFILL: PrefillFields = {
  amount: "",
  category: "",
  account: "",
  description: ""
}

/** Estado inicial del formulario de movimiento */
export interface TransactionFormFields extends PrefillFields {
  type: TransactionType
  date: string
  time: string
  incomeSourceId: string
  /**
   * La categoría prellenada ya no está activa (regla del SPEC 02): el campo
   * queda vacío y se avisa
   */
  initialCategoryUnavailable: boolean
  /** Lo último que se prellenó, para saber si el usuario lo cambió */
  prefilled: PrefillFields
}

/**
 * Valores iniciales: los del movimiento que se edita, o el prellenado de uno
 * nuevo. Sin fecha, `today`.
 */
export function initialTransactionFields(
  {
    transaction,
    initialValues,
    categories
  }: {
    transaction?: EditableTransaction
    initialValues?: TransactionInitialValues
    categories: Pick<Category, "id" | "archived_at">[]
  },
  today: string
): TransactionFormFields {
  const initialCategory = categories.find(
    (category) => category.id === initialValues?.category_id
  )
  const initialCategoryUnavailable =
    initialValues?.category_id !== undefined &&
    (initialCategory === undefined || initialCategory.archived_at !== null)

  const fields: PrefillFields = {
    amount: transaction
      ? amountInput(transaction.amount)
      : amountInput(initialValues?.amount),
    category:
      transaction?.category_id ??
      (initialCategoryUnavailable ? "" : (initialValues?.category_id ?? "")),
    account: transaction?.account_id ?? initialValues?.account_id ?? "",
    description: transaction?.description ?? initialValues?.description ?? ""
  }

  return {
    ...fields,
    type: transaction?.type ?? initialValues?.type ?? "expense",
    date: transaction?.occurred_on ?? initialValues?.occurred_on ?? today,
    time: transaction?.occurred_time?.slice(0, 5) ?? "",
    incomeSourceId:
      transaction?.recurring_income_id ??
      initialValues?.recurring_income_id ??
      OTHER_INCOME,
    initialCategoryUnavailable,
    // Si ya viene un ingreso fijo elegido, lo prellenado son estos valores
    prefilled: initialValues?.recurring_income_id ? fields : EMPTY_PREFILL
  }
}

/**
 * Prellenado al elegir un ingreso fijo: cada campo toma el valor nuevo solo
 * si está vacío o sigue igual a lo último prellenado
 */
export function applyPrefill(
  current: PrefillFields,
  prefilled: PrefillFields,
  next: PrefillFields
): PrefillFields {
  const pick = (key: keyof PrefillFields) =>
    current[key] === "" || current[key] === prefilled[key]
      ? next[key]
      : current[key]
  return {
    amount: pick("amount"),
    category: pick("category"),
    account: pick("account"),
    description: pick("description")
  }
}

/**
 * Categorías del select: activas del tipo elegido, más la actual del
 * movimiento editado aunque esté archivada, para poder guardar sin cambiarla
 */
export function transactionCategoryOptions<
  T extends Pick<Category, "id" | "type" | "archived_at">
>(categories: T[], type: TransactionType, currentCategoryId?: string) {
  return categories.filter(
    (category) =>
      category.type === type &&
      (category.archived_at === null || category.id === currentCategoryId)
  )
}
