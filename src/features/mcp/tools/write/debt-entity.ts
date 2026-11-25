import { loadDebt } from "@/features/debts/debt-loader"
import type { DebtKind } from "@/features/debts/debt-schemas"
import { DEBT_NOT_FOUND, RECEIVABLE_NOT_FOUND } from "@/features/debts/errors"
import type { ReceivableSchedule } from "@/features/debts/receivable-schemas"
import {
  createDebtRecord,
  loadDebtRow,
  parseDebtInput,
  updateDebtRecord
} from "@/features/debts/service"
import type { McpContext } from "../../types"
import { toolError } from "../result"
import { type McpWorkspace, needsInput } from "../shared"
import { missingRequired, notApplicable, pickFields } from "./debt-fields"
import {
  NO_CHANGES,
  commitEntity,
  definedKeys,
  duplicateName,
  habitualAccount,
  resolveEntity,
  serviceError
} from "./entities"

// Crear y editar deudas (tarjetas y préstamos) y cuentas por cobrar (Me
// deben) desde el MCP (SPEC 44), con el servicio de las actions
// (debts/service.ts). Solo Personal. Lo comparten create_debt,
// update_debt, create_receivable y update_receivable.

/** Crea una deuda o cuenta por cobrar, o pregunta lo que falta */
export async function createDebtEntity(
  ctx: McpContext,
  {
    workspace,
    kind,
    schedule,
    values,
    account,
    tool,
    confirmDuplicate
  }: {
    workspace: McpWorkspace
    kind: DebtKind
    schedule: ReceivableSchedule | null
    values: Record<string, unknown>
    account: { account_id?: string | null; account?: string }
    tool: string
    confirmDuplicate: boolean | undefined
  }
) {
  const missing = [
    ...notApplicable(values, kind, schedule),
    ...missingRequired(values, kind, schedule)
  ]

  const habitual = await habitualAccount(ctx, workspace, account)
  if ("missing" in habitual) {
    missing.push(habitual.missing)
  }

  // Duplicados entre las activas del mismo tipo: deudas o Me deben
  const query = ctx.supabase
    .from("debts")
    .select("id, name")
    .eq("workspace_id", workspace.id)
    .eq("status", "active")
  const { data: active } = await (kind === "receivable"
    ? query.eq("kind", "receivable")
    : query.neq("kind", "receivable"))
  const duplicate = duplicateName(
    active ?? [],
    typeof values.name === "string" ? values.name : undefined,
    {
      label:
        kind === "receivable"
          ? "una cuenta por cobrar activa"
          : "una deuda activa",
      confirmed: confirmDuplicate
    }
  )
  if (duplicate) {
    missing.push(duplicate)
  }
  if (missing.length > 0 || "missing" in habitual) {
    return needsInput(missing)
  }

  const parsed = parseDebtInput(kind, schedule, {
    ...pickFields(values, kind, schedule),
    account_id: habitual.value ?? null
  })
  if (!parsed.success) {
    return serviceError({ ok: false, fieldErrors: parsed.fieldErrors })
  }

  const result = await createDebtRecord(
    ctx.supabase,
    workspace,
    kind,
    parsed.data
  )
  if (!result.ok) {
    return serviceError(result)
  }

  const noun = kind === "receivable" ? "Cuenta por cobrar" : "Deuda"
  return commitEntity(ctx, {
    workspace,
    tool,
    table: "debts",
    summary: `${noun} "${result.after.name}" creada en ${workspace.name}`,
    before: null,
    after: result.after
  })
}

/** Edita una deuda o cuenta por cobrar con los campos enviados */
export async function updateDebtEntity(
  ctx: McpContext,
  {
    workspace,
    id,
    name,
    receivable,
    values,
    account,
    tool
  }: {
    workspace: McpWorkspace
    id: string | undefined
    name: string | undefined
    receivable: boolean
    values: Record<string, unknown>
    account: { account_id?: string | null; account?: string }
    tool: string
  }
) {
  const notFound = receivable ? RECEIVABLE_NOT_FOUND : DEBT_NOT_FOUND
  if (
    definedKeys(values).length === 0 &&
    account.account_id === undefined &&
    account.account === undefined
  ) {
    return toolError(NO_CHANGES)
  }

  let debtId = id
  if (!debtId) {
    const query = ctx.supabase
      .from("debts")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .order("name", { ascending: true })
    const { data } = await (receivable
      ? query.eq("kind", "receivable")
      : query.neq("kind", "receivable"))
    const resolved = resolveEntity(data ?? [], {
      id: undefined,
      name,
      field: receivable ? "receivable_id" : "debt_id",
      label: receivable ? "la cuenta por cobrar" : "la deuda"
    })
    if ("missing" in resolved) {
      return needsInput([resolved.missing])
    }
    debtId = resolved.value
  }

  const [debt, current] = await Promise.all([
    loadDebt(ctx.supabase, workspace.id, debtId),
    loadDebtRow(ctx.supabase, workspace.id, debtId)
  ])
  if (!debt || !current || (debt.kind === "receivable") !== receivable) {
    return toolError(notFound)
  }

  const missing = notApplicable(values, debt.kind, debt.schedule)
  const habitual = await habitualAccount(ctx, workspace, account)
  if ("missing" in habitual) {
    missing.push(habitual.missing)
  }
  if (missing.length > 0 || "missing" in habitual) {
    return needsInput(missing)
  }

  // Lo guardado con los cambios encima: los campos omitidos quedan igual
  const stored = pickFields(
    current as unknown as Record<string, unknown>,
    debt.kind,
    debt.schedule
  )
  if (stored.counterparty === null) {
    stored.counterparty = ""
  }
  const defined = Object.fromEntries(
    definedKeys(values).map((key) => [key, values[key]])
  )
  const parsed = parseDebtInput(debt.kind, debt.schedule, {
    ...stored,
    ...defined,
    account_id:
      habitual.value === undefined ? current.account_id : habitual.value
  })
  if (!parsed.success) {
    return serviceError({ ok: false, fieldErrors: parsed.fieldErrors })
  }

  const result = await updateDebtRecord(ctx.supabase, debt, parsed.data)
  if (!result.ok) {
    return serviceError(result)
  }

  const noun = receivable ? "Cuenta por cobrar" : "Deuda"
  return commitEntity(ctx, {
    workspace,
    tool,
    table: "debts",
    summary: `${noun} "${result.after.name}" editada en ${workspace.name}`,
    before: result.before,
    after: result.after,
    related: result.history
      ? [
          {
            table: "receivable_installment_history",
            rowId: result.history.id,
            before: null,
            after: result.history
          }
        ]
      : []
  })
}
