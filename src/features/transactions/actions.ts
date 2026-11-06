"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"
import { getOldestUnreceivedOccurrences } from "@/features/recurring-incomes/queries"
import {
  type WorkspaceType,
  requireWritableWorkspace
} from "@/features/workspaces/queries"
import { revalidateWorkspacePages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import { type VerifyEntry, getVerifyEntries } from "./queries"
import {
  createTransactionSchema,
  parseAmount,
  transactionSchema
} from "./schemas"
import type { TransactionActionResult, TransactionFormState } from "./types"

const NOT_FOUND = "No se encontró el movimiento"
const DEFAULT_ERROR = "No se pudo guardar el movimiento. Intenta de nuevo"
const INVALID_CATEGORY = "Elige una categoría válida para este tipo"
const ARCHIVED_CATEGORY = "Esta categoría está archivada. Elige otra"
const RECURRING_NOT_FOUND = "No se encontró el gasto fijo"
const ALREADY_PAID = "Este pago ya está registrado"
const RECURRING_MUST_BE_EXPENSE = "El pago de un gasto fijo debe ser un gasto"
const ARCHIVED_ACCOUNT = "La cuenta está archivada"
const INVALID_ACCOUNT = "Elige una cuenta válida"
const SAME_TRANSFER_ACCOUNT = "Elige una cuenta distinta a la que paga"
const INCOME_NOT_FOUND = "No se encontró el ingreso fijo"
const ALREADY_RECEIVED = "Este ingreso ya está registrado. Intenta de nuevo"
const LINKED_DEBT_ENTRY =
  "Este movimiento es un pago de deuda: edítalo desde su diálogo de pago"
const UNIQUE_VIOLATION = "23505"

const FIELDS = [
  "type",
  "amount",
  "occurred_on",
  "occurred_time",
  "category_id",
  "description",
  "note",
  "account_id",
  "counterparty",
  "invoice_ref",
  "recurring_expense_id",
  "recurring_due_on",
  "recurring_income_id",
  "transfer_from",
  "transfer_amount"
] as const

const idSchema = z.uuid()

// Códigos de Postgres que pueden llegar pese a la validación con Zod
const PG_ERROR_MESSAGES: Record<string, TransactionFormState> = {
  // check_transaction_category y los check de la tabla
  "23514": { fieldErrors: { category_id: [INVALID_CATEGORY] } },
  // FK de category_id
  "23503": { fieldErrors: { category_id: [INVALID_CATEGORY] } },
  // RLS
  "42501": { error: "No tienes permiso para modificar este movimiento" }
}

function readValues(formData: FormData) {
  return Object.fromEntries(
    FIELDS.map((key) => {
      const value = formData.get(key)
      return [key, typeof value === "string" ? value : ""]
    })
  ) as Record<(typeof FIELDS)[number], string>
}

function toFormError(
  error: PostgrestError,
  values: Record<string, string>
): TransactionFormState {
  // Índice único por ocurrencia: el pago ya existe (p. ej. doble clic)
  if (error.code === UNIQUE_VIOLATION) {
    return { error: ALREADY_PAID, values }
  }
  // check_account_active y la FK compuesta de la cuenta, antes que los
  // códigos genéricos de la categoría
  if (error.message.includes(ARCHIVED_ACCOUNT)) {
    return { fieldErrors: { account_id: [ARCHIVED_ACCOUNT] }, values }
  }
  if (error.code === "23503" && error.message.includes("account_id")) {
    return { fieldErrors: { account_id: [INVALID_ACCOUNT] }, values }
  }
  // El traspaso desde la misma cuenta que paga lo frena transfers_check
  if (error.message.includes("transfers_check")) {
    return { fieldErrors: { transfer_from: [SAME_TRANSFER_ACCOUNT] }, values }
  }
  return {
    ...(PG_ERROR_MESSAGES[error.code] ?? { error: DEFAULT_ERROR }),
    values
  }
}

function parseForm<T>(
  formData: FormData,
  schema: z.ZodType<T, unknown>
): { values: Record<string, string>; parsed: z.ZodSafeParseResult<T> } {
  const values = readValues(formData)
  const parsed = schema.safeParse({
    ...values,
    amount: parseAmount(values.amount)
  })
  return { values, parsed }
}

// Contraparte y factura solo existen en Empresa
function workspaceFields<
  T extends { counterparty: unknown; invoice_ref: unknown }
>(data: T, type: WorkspaceType): T {
  return type === "business"
    ? data
    : { ...data, counterparty: null, invoice_ref: null }
}

function toValidationError(
  error: z.ZodError,
  values: Record<string, string>
): TransactionFormState {
  const { formErrors, fieldErrors } = z.flattenError(error)
  return { error: formErrors[0], fieldErrors, values }
}

// El gasto fijo debe ser del workspace Personal del usuario y la ocurrencia
// no debe tener pago. El trigger y el índice único lo garantizan en la BD;
// esto da un mensaje claro antes de insertar.
async function validateRecurring(
  workspaceId: string,
  recurringExpenseId: string,
  dueOn: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data: expense } = await supabase
    .from("recurring_expenses")
    .select("id")
    .eq("id", recurringExpenseId)
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  if (!expense) {
    return RECURRING_NOT_FOUND
  }

  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("recurring_expense_id", recurringExpenseId)
    .eq("recurring_due_on", dueOn)

  return (count ?? 0) > 0 ? ALREADY_PAID : null
}

interface IncomeLink {
  recurring_income_id: string | null
  recurring_income_due_on: string | null
}

const NO_INCOME_LINK: IncomeLink = {
  recurring_income_id: null,
  recurring_income_due_on: null
}

// Enlace de un ingreso a un ingreso fijo activo del espacio (SPEC 30): con
// calendario, a su ocurrencia no recibida más antigua (las atrasadas
// primero); sin ocurrencias no recibidas o "Sin fecha fija", a la fuente sin
// ocurrencia. El cliente nunca elige la ocurrencia.
async function resolveIncomeLink(
  workspaceId: string,
  recurringIncomeId: string
): Promise<IncomeLink | { error: string }> {
  const supabase = await createClient()
  const { data: income } = await supabase
    .from("recurring_incomes")
    .select("id, frequency")
    .eq("id", recurringIncomeId)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .maybeSingle()

  if (!income) {
    return { error: INCOME_NOT_FOUND }
  }
  if (income.frequency === "none") {
    return { recurring_income_id: income.id, recurring_income_due_on: null }
  }

  const oldest = await getOldestUnreceivedOccurrences(workspaceId)
  return {
    recurring_income_id: income.id,
    recurring_income_due_on: oldest.get(income.id) ?? null
  }
}

// La categoría debe existir, ser visible para el usuario (RLS), tener el tipo
// del movimiento y el scope del espacio, y estar activa. Una archivada solo se
// acepta si ya era la categoría actual del movimiento que se edita.
async function validateCategory(
  categoryId: string,
  type: string,
  scope: WorkspaceType,
  currentCategoryId?: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("categories")
    .select("type, scope, archived_at")
    .eq("id", categoryId)
    .maybeSingle()

  if (!data || data.type !== type || data.scope !== scope) {
    return INVALID_CATEGORY
  }
  if (data.archived_at !== null && categoryId !== currentCategoryId) {
    return ARCHIVED_CATEGORY
  }
  return null
}

export async function createTransaction(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const { values, parsed } = parseForm(formData, createTransactionSchema)

  if (!parsed.success) {
    return toValidationError(parsed.error, values)
  }

  const { recurring_expense_id, recurring_due_on } = parsed.data
  if (recurring_expense_id !== null && parsed.data.type !== "expense") {
    return { error: RECURRING_MUST_BE_EXPENSE, values }
  }

  const workspace = await requireWritableWorkspace(formData.get("workspace_id"))

  const categoryError = await validateCategory(
    parsed.data.category_id,
    parsed.data.type,
    workspace.type
  )
  if (categoryError) {
    return { fieldErrors: { category_id: [categoryError] }, values }
  }

  if (recurring_expense_id !== null && recurring_due_on !== null) {
    const recurringError = await validateRecurring(
      workspace.id,
      recurring_expense_id,
      recurring_due_on
    )
    if (recurringError) {
      return { error: recurringError, values }
    }
  }

  const { transfer_from, transfer_amount, recurring_income_id, ...fields } =
    parsed.data
  const row = workspaceFields(fields, workspace.type)

  // Ingreso fijo: solo en ingresos de Personal; en otro caso se ignora
  let incomeLink = NO_INCOME_LINK
  if (
    recurring_income_id !== null &&
    row.type === "income" &&
    workspace.type === "personal"
  ) {
    const resolved = await resolveIncomeLink(workspace.id, recurring_income_id)
    if ("error" in resolved) {
      return { error: resolved.error, values }
    }
    incomeLink = resolved
  }

  const supabase = await createClient()
  const insertRow = (link: IncomeLink) =>
    supabase
      .from("transactions")
      .insert({ ...row, ...link, workspace_id: workspace.id })

  // Con traspaso, el traspaso y el movimiento se guardan juntos (RPC); sin
  // él basta el insert directo
  let { error } =
    transfer_from !== null && row.account_id !== null
      ? await supabase.rpc("record_transaction", {
          p_workspace_id: workspace.id,
          p_type: row.type,
          p_amount: row.amount,
          p_category_id: row.category_id,
          p_occurred_on: row.occurred_on,
          p_occurred_time: row.occurred_time ?? undefined,
          p_description: row.description,
          p_note: row.note ?? undefined,
          p_account_id: row.account_id,
          p_recurring_expense_id: row.recurring_expense_id ?? undefined,
          p_recurring_due_on: row.recurring_due_on ?? undefined,
          p_counterparty: row.counterparty ?? undefined,
          p_invoice_ref: row.invoice_ref ?? undefined,
          p_transfer_from: transfer_from,
          p_transfer_amount: transfer_amount ?? undefined
        })
      : await insertRow(incomeLink)

  // Otro movimiento recibió la misma ocurrencia a la vez: se reintenta una
  // vez con la siguiente no recibida
  if (
    error?.code === UNIQUE_VIOLATION &&
    incomeLink.recurring_income_due_on !== null &&
    incomeLink.recurring_income_id !== null
  ) {
    const retry = await resolveIncomeLink(
      workspace.id,
      incomeLink.recurring_income_id
    )
    if (
      "error" in retry ||
      retry.recurring_income_due_on === incomeLink.recurring_income_due_on
    ) {
      return { error: ALREADY_RECEIVED, values }
    }
    ;({ error } = await insertRow(retry))
  }

  if (error) {
    return toFormError(error, values)
  }

  revalidateWorkspacePages(workspace)
  return { ok: true }
}

export async function updateTransaction(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  // transactionSchema no incluye el enlace al gasto fijo: editar lo conserva.
  // El de ingreso fijo sí se puede cambiar (SPEC 30)
  const { values, parsed } = parseForm(formData, transactionSchema)
  // Sin el campo (formularios sin select) el enlace se conserva
  const incomeFieldSent = formData.has("recurring_income_id")
  const id = idSchema.safeParse(formData.get("id"))

  if (!id.success) {
    return { error: NOT_FOUND, values }
  }
  if (!parsed.success) {
    return toValidationError(parsed.error, values)
  }

  const workspace = await requireWritableWorkspace(formData.get("workspace_id"))
  const supabase = await createClient()
  const { data: current } = await supabase
    .from("transactions")
    .select(
      "category_id, recurring_expense_id, recurring_income_id, debt_entries(id)"
    )
    .eq("id", id.data)
    .eq("workspace_id", workspace.id)
    .maybeSingle()

  if (!current) {
    return { error: NOT_FOUND, values }
  }
  // El abono manda sobre su movimiento (SPEC 26): editarlo aquí lo desfasaría
  if (current.debt_entries) {
    return { error: LINKED_DEBT_ENTRY, values }
  }
  if (current.recurring_expense_id !== null && parsed.data.type !== "expense") {
    return { error: RECURRING_MUST_BE_EXPENSE, values }
  }

  const categoryError = await validateCategory(
    parsed.data.category_id,
    parsed.data.type,
    workspace.type,
    current.category_id
  )
  if (categoryError) {
    return { fieldErrors: { category_id: [categoryError] }, values }
  }

  // Enlace al ingreso fijo:
  // - un gasto, o Empresa, no lleva enlace;
  // - sin el campo o con la misma fuente, se conserva (aunque cambien monto,
  //   fecha o cuenta);
  // - "Otro ingreso" lo quita y la ocurrencia vuelve a su estado calculado;
  // - otra fuente re-enlaza a su ocurrencia no recibida más antigua.
  const { recurring_income_id, ...fields } = parsed.data
  let incomeLink: IncomeLink | null = null
  if (parsed.data.type !== "income" || workspace.type !== "personal") {
    incomeLink = current.recurring_income_id === null ? null : NO_INCOME_LINK
  } else if (
    incomeFieldSent &&
    recurring_income_id !== current.recurring_income_id
  ) {
    if (recurring_income_id === null) {
      incomeLink = NO_INCOME_LINK
    } else {
      const resolved = await resolveIncomeLink(
        workspace.id,
        recurring_income_id
      )
      if ("error" in resolved) {
        return { error: resolved.error, values }
      }
      incomeLink = resolved
    }
  }

  const { data, error } = await supabase
    .from("transactions")
    .update({
      ...workspaceFields(fields, workspace.type),
      ...(incomeLink ?? {})
    })
    .eq("id", id.data)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return toFormError(error, values)
  }
  if (data.length === 0) {
    return { error: NOT_FOUND, values }
  }

  revalidateWorkspacePages(workspace)
  return { ok: true }
}

export async function deleteTransaction(
  workspaceId: string,
  id: string
): Promise<TransactionActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: NOT_FOUND }
  }

  const workspace = await requireWritableWorkspace(workspaceId)
  const supabase = await createClient()

  // Un pago de deuda se elimina con su abono (deleteEntry): borrar solo el
  // movimiento dejaría el abono contando en la deuda (SPEC 26)
  const { data: link, error: linkError } = await supabase
    .from("debt_entries")
    .select("id")
    .eq("transaction_id", parsedId.data)
    .maybeSingle()

  if (linkError) {
    return { error: "No se pudo eliminar el movimiento. Intenta de nuevo" }
  }
  if (link) {
    return { error: LINKED_DEBT_ENTRY }
  }

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", parsedId.data)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return { error: "No se pudo eliminar el movimiento. Intenta de nuevo" }
  }
  if (data.length === 0) {
    return { error: NOT_FOUND }
  }

  revalidateWorkspacePages(workspace)
  return {}
}

const LEDGER_KINDS = [
  "income",
  "expense",
  "transfer",
  "adjustment",
  "debt_payment",
  "debt_advance",
  "goal_contribution"
] as const

const moveSchema = z.object({
  kind: z.enum(LEDGER_KINDS),
  id: z.uuid(),
  targetKind: z.enum(LEDGER_KINDS),
  targetId: z.uuid()
})

const MOVE_DEFAULT_ERROR = "No se pudo reordenar el movimiento"
const MOVE_FORBIDDEN = "No tienes permiso para reordenar en este espacio"
const MOVE_OTHER_DAY = "Solo se puede reordenar dentro del mismo día"

// Mueve una fila a la posición de otra del mismo día. Cubre movimientos,
// traspasos, ajustes, pagos de tarjeta, avances y aportes: el orden es el de
// la lista unificada (SPEC 19).
export async function moveLedgerEntry(
  workspaceId: string,
  kind: string,
  id: string,
  targetKind: string,
  targetId: string
): Promise<TransactionActionResult> {
  const parsed = moveSchema.safeParse({ kind, id, targetKind, targetId })

  if (!parsed.success) {
    return { error: NOT_FOUND }
  }

  const workspace = await requireWritableWorkspace(workspaceId)
  const supabase = await createClient()
  const { error } = await supabase.rpc("move_ledger_entry", {
    p_workspace_id: workspace.id,
    p_kind: parsed.data.kind,
    p_id: parsed.data.id,
    p_target_kind: parsed.data.targetKind,
    p_target_id: parsed.data.targetId
  })

  if (error) {
    if (error.code === "42501") {
      return { error: MOVE_FORBIDDEN }
    }
    if (error.message.includes("mismo día")) {
      return { error: MOVE_OTHER_DAY }
    }
    return { error: MOVE_DEFAULT_ERROR }
  }

  revalidateWorkspacePages(workspace)
  return {}
}

const verifySchema = z.object({
  workspaceId: z.uuid(),
  accountId: z.uuid().nullable(),
  offset: z.number().int().min(0).max(100_000)
})

// Página de Verificar movimientos. Solo lectura: RLS limita las filas al dueño
// del espacio, así que no hace falta resolver el espacio con permiso de
// escritura.
export async function loadVerifyEntries(
  workspaceId: string,
  accountId: string | null,
  offset: number
): Promise<{ rows: VerifyEntry[]; hasMore: boolean } | { error: string }> {
  const parsed = verifySchema.safeParse({ workspaceId, accountId, offset })

  if (!parsed.success) {
    return { error: "No se pudieron cargar los movimientos" }
  }

  try {
    return await getVerifyEntries(parsed.data.workspaceId, {
      accountId: parsed.data.accountId ?? undefined,
      offset: parsed.data.offset
    })
  } catch {
    return { error: "No se pudieron cargar los movimientos" }
  }
}
