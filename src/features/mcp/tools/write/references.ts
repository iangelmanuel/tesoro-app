import { z } from "zod"
import { normalizeText } from "@/features/imports/detect"
import type { McpContext } from "../../types"
import type { McpWorkspace, MissingField } from "../shared"

// Cuentas y categorías por id o por nombre (SPEC 43). Un nombre que no
// coincide o coincide con varias, o un dato obligatorio que falta, no es un
// error: vuelve como pregunta para el usuario (needs_input) con las opciones
// activas del espacio.

export interface RefOption {
  id: string
  name: string
}

export interface CategoryOption extends RefOption {
  type: string
}

export const accountNameSchema = z
  .string()
  .min(1)
  .max(120)
  .describe("Nombre de la cuenta, si no tienes el id.")

export const categoryNameSchema = z
  .string()
  .min(1)
  .max(120)
  .describe("Nombre de la categoría, si no tienes el id.")

/** Cuentas activas del espacio, por nombre */
export async function activeAccounts(
  ctx: McpContext,
  workspaceId: string
): Promise<RefOption[]> {
  const { data } = await ctx.supabase
    .from("accounts")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("name", { ascending: true })
  return data ?? []
}

/** Categorías activas que ve el espacio: las del sistema y las propias */
export async function activeCategories(
  ctx: McpContext,
  workspace: McpWorkspace
): Promise<CategoryOption[]> {
  const { data } = await ctx.supabase
    .from("categories")
    .select("id, name, type")
    .eq("scope", workspace.type)
    .or(`workspace_id.is.null,workspace_id.eq.${workspace.id}`)
    .is("archived_at", null)
    .order("name", { ascending: true })
  return data ?? []
}

/** Coincidencias exactas (sin tildes ni mayúsculas); si no hay, parciales */
export function matchByName<T extends RefOption>(items: T[], name: string) {
  const target = normalizeText(name)
  const exact = items.filter((item) => normalizeText(item.name) === target)
  if (exact.length > 0) {
    return exact
  }
  return items.filter((item) => normalizeText(item.name).includes(target))
}

function optionsOf(items: RefOption[]) {
  return items.map((item) => ({ id: item.id, label: item.name }))
}

type Resolved = { value: string | null } | { missing: MissingField }

/**
 * Cuenta de una fila. `id` gana sobre `name`; `null` explícito es "fuera de
 * las cuentas" (solo si `nullable`). Sin ninguno: con una sola cuenta activa
 * se usa esa, sin cuentas queda null (si se puede) y con varias se pregunta.
 */
export function resolveAccount(
  accounts: RefOption[],
  {
    id,
    name,
    field,
    row,
    label,
    nullable
  }: {
    id: string | null | undefined
    name: string | undefined
    field: string
    row?: number
    label: string
    nullable: boolean
  }
): Resolved {
  if (id !== undefined && (id !== null || nullable)) {
    return { value: id }
  }

  if (name !== undefined) {
    const matches = matchByName(accounts, name)
    if (matches.length === 1) {
      return { value: matches[0].id }
    }
    return {
      missing: {
        field,
        row,
        question:
          matches.length > 1
            ? `"${name}" coincide con varias cuentas. ¿Cuál es ${label}?`
            : `No hay una cuenta activa llamada "${name}". ¿Cuál es ${label}?`,
        options: optionsOf(matches.length > 1 ? matches : accounts)
      }
    }
  }

  if (accounts.length === 1) {
    return { value: accounts[0].id }
  }
  if (accounts.length === 0 && nullable) {
    return { value: null }
  }
  return {
    missing: {
      field,
      row,
      question:
        accounts.length === 0
          ? `No hay cuentas activas. Crea una en Tesoro para usarla como ${label}.`
          : `¿Cuál es ${label}?`,
      options: optionsOf(accounts)
    }
  }
}

/** Categoría de una fila por id o nombre, entre las de su tipo */
export function resolveCategory(
  categories: CategoryOption[],
  {
    id,
    name,
    type,
    row
  }: {
    id: string | undefined
    name: string | undefined
    type: string
    row?: number
  }
): Resolved {
  if (id !== undefined) {
    return { value: id }
  }

  const ofType = categories.filter((category) => category.type === type)
  const kind = type === "income" ? "ingreso" : "gasto"

  if (name !== undefined) {
    const matches = matchByName(ofType, name)
    if (matches.length === 1) {
      return { value: matches[0].id }
    }
    return {
      missing: {
        field: "category_id",
        row,
        question:
          matches.length > 1
            ? `"${name}" coincide con varias categorías de ${kind}. ¿Cuál es?`
            : `No hay una categoría de ${kind} llamada "${name}". ¿Cuál usamos? (o créala con create_category)`,
        options: optionsOf(matches.length > 1 ? matches : ofType)
      }
    }
  }

  return {
    missing: {
      field: "category_id",
      row,
      question: `¿En qué categoría de ${kind} va?`,
      options: optionsOf(ofType)
    }
  }
}
