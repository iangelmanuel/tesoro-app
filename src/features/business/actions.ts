"use server"

import type { Route } from "next"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { SITE } from "@/config/site"
import { workspaceBasePath } from "@/features/workspaces/paths"
import { requireWritableWorkspace } from "@/features/workspaces/queries"
import { readFormValues } from "@/libs/form-data"
import { createClient } from "@/libs/supabase/server"
import { businessSchema } from "./schemas"
import {
  NOT_FOUND,
  cancelBusinessDeletionRecord,
  createBusinessRecord,
  requestBusinessDeletionRecord,
  updateBusinessRecord
} from "./service"
import type { BusinessFormState } from "./types"

const FIELDS = ["name", "tax_id", "sector"] as const

const NAME_MISMATCH = "El nombre no coincide"

// Crea la empresa y lleva a su Resumen
export async function createBusiness(
  _prevState: BusinessFormState,
  formData: FormData
): Promise<BusinessFormState> {
  const values = readFormValues(formData, FIELDS)
  const parsed = businessSchema.safeParse(values)

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const result = await createBusinessRecord(await createClient(), parsed.data)

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
  }

  // El aside y /dashboard/business cambian al tener una empresa
  revalidatePath(SITE.routes.dashboardBusiness, "layout")
  redirect(workspaceBasePath({ id: result.id, type: "business" }) as Route)
}

// Edita nombre, NIT y sector de la empresa
export async function updateBusiness(
  _prevState: BusinessFormState,
  formData: FormData
): Promise<BusinessFormState> {
  const values = readFormValues(formData, FIELDS)
  const parsed = businessSchema.safeParse(values)

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requireWritableWorkspace(formData.get("workspace_id"))
  if (workspace.type !== "business") {
    return { error: NOT_FOUND, values }
  }

  const result = await updateBusinessRecord(
    await createClient(),
    workspace,
    parsed.data
  )

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
  }

  // El nombre también se ve en el aside, que vive en el layout de /dashboard:
  // se revalida desde ahí, lo que incluye las páginas de la empresa
  revalidatePath(SITE.routes.dashboard, "layout")
  return { ok: true }
}

// Programa el borrado (30 días de gracia). El nombre se vuelve a comparar en
// el servidor aunque el botón del diálogo ya lo exija
export async function requestBusinessDeletion(
  _prevState: BusinessFormState,
  formData: FormData
): Promise<BusinessFormState> {
  const values = readFormValues(formData, ["confirmName"])

  const workspace = await requireWritableWorkspace(formData.get("workspace_id"))
  if (workspace.type !== "business") {
    return { error: NOT_FOUND, values }
  }
  if (values.confirmName.trim() !== workspace.name) {
    return { fieldErrors: { confirmName: [NAME_MISMATCH] }, values }
  }

  const result = await requestBusinessDeletionRecord(
    await createClient(),
    workspace
  )

  if (!result.ok) {
    return { error: result.error, values }
  }

  // El layout de la empresa pasa a la pantalla de restaurar
  revalidatePath(SITE.routes.dashboard, "layout")
  redirect(workspaceBasePath(workspace) as Route)
}

// Quita la marca y vuelve al Resumen. No usa requireWritableWorkspace: la
// empresa está marcada para borrarse justamente
export async function cancelBusinessDeletion(
  workspaceId: string
): Promise<{ error?: string }> {
  const parsedId = z.uuid().safeParse(workspaceId)
  if (!parsedId.success) {
    return { error: NOT_FOUND }
  }

  const result = await cancelBusinessDeletionRecord(
    await createClient(),
    parsedId.data
  )

  if (!result.ok) {
    return { error: result.error }
  }

  revalidatePath(SITE.routes.dashboard, "layout")
  redirect(workspaceBasePath({ id: parsedId.data, type: "business" }) as Route)
}
