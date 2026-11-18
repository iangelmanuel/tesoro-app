import { z } from "zod"
import type { ServiceFailure } from "@/libs/service-result"
import { type SnapshotTable, commitOperation } from "../../operations"
import type { McpContext } from "../../types"
import { toolError } from "../result"
import type { McpWorkspace, MissingField } from "../shared"
import { failureRowErrors, writeResult } from "./batch"
import { type RefOption, matchByName } from "./references"

// Piezas de las tools que crean y editan entidades (SPEC 44): cuentas,
// deudas, Me deben, fijos, metas y presupuestos. Una entidad por llamada;
// cada create y update deja su fila en el log para undo_operation.

export const NO_CHANGES = "Envía al menos un campo para cambiar."

/** Pregunta de needs_input para un campo obligatorio que no llegó */
export function missingField(
  field: string,
  question: string,
  options?: { id: string; label: string }[]
): MissingField {
  return { field, question, ...(options ? { options } : {}) }
}

/** Opciones de needs_input a partir de un mapa valor → etiqueta */
export function enumOptions(labels: Record<string, string>) {
  return Object.entries(labels).map(([id, label]) => ({ id, label }))
}

function fieldErrorsResult(
  failure: Pick<ServiceFailure, "error" | "fieldErrors">
) {
  const errors = failureRowErrors(0, failure).map(({ field, message }) => ({
    ...(field ? { field } : {}),
    message
  }))
  return toolError(failure.error ?? errors[0]?.message ?? "Revisa los datos.", {
    errors
  })
}

/** El schema de la UI rechazó los datos: error con cada campo */
export function schemaError(error: z.ZodError) {
  return fieldErrorsResult({
    fieldErrors: z.flattenError(error).fieldErrors
  })
}

/** El servicio rechazó la escritura */
export function serviceError(failure: ServiceFailure) {
  return fieldErrorsResult(failure)
}

/** Solo las claves enviadas (no undefined) */
export function definedKeys<T extends object>(patch: T) {
  return (Object.keys(patch) as (keyof T)[]).filter(
    (key) => patch[key] !== undefined
  )
}

/**
 * Editar con un schema completo: valida la entidad actual con los cambios
 * encima y devuelve solo los campos enviados, ya transformados. Los
 * omitidos quedan igual.
 */
export function parsePatch<S extends z.ZodType<object>>(
  schema: S,
  current: Record<string, unknown>,
  patch: Record<string, unknown>
): { ok: true; data: Partial<z.output<S>> } | { ok: false; error: z.ZodError } {
  const keys = definedKeys(patch)
  const defined = Object.fromEntries(keys.map((key) => [key, patch[key]]))
  const parsed = schema.safeParse({ ...current, ...defined })
  if (!parsed.success) {
    return { ok: false, error: parsed.error }
  }
  const output = parsed.data as Record<string, unknown>
  return {
    ok: true,
    data: Object.fromEntries(
      keys.filter((key) => key in output).map((key) => [key, output[key]])
    ) as Partial<z.output<S>>
  }
}

/**
 * Entidad por id o por nombre para editarla. `id` gana; un nombre que no
 * coincide o coincide con varias vuelve como pregunta con las opciones.
 */
export function resolveEntity(
  items: RefOption[],
  {
    id,
    name,
    field,
    label
  }: {
    id: string | undefined
    name: string | undefined
    field: string
    /** "la cuenta", "el gasto fijo"… */
    label: string
  }
): { value: string } | { missing: MissingField } {
  if (id !== undefined) {
    return { value: id }
  }

  const options = items.map((item) => ({ id: item.id, label: item.name }))
  if (name !== undefined) {
    const matches = matchByName(items, name)
    if (matches.length === 1) {
      return { value: matches[0].id }
    }
    return {
      missing: missingField(
        field,
        matches.length > 1
          ? `"${name}" coincide con varias. ¿Cuál es ${label}?`
          : `No encontré "${name}". ¿Cuál es ${label}?`,
        matches.length > 1
          ? matches.map((item) => ({ id: item.id, label: item.name }))
          : options
      )
    }
  }

  return {
    missing: missingField(field, `¿Cuál es ${label}?`, options)
  }
}

/** Registra un create o un update en el log y arma la respuesta */
export async function commitEntity(
  ctx: McpContext,
  {
    workspace,
    tool,
    table,
    summary,
    before,
    after
  }: {
    workspace: McpWorkspace
    tool: string
    table: SnapshotTable
    summary: string
    before: object | null
    after: { id: string }
  }
) {
  const operationId = await commitOperation(ctx, {
    workspaceId: workspace.id,
    tool,
    summary,
    changes: [{ table, rowId: after.id, before, after }]
  })
  return writeResult(ctx, { operationId, summary, ids: [after.id] })
}
