"use server"

import { refresh } from "next/cache"
import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"
import { requireWritableWorkspace } from "@/features/workspaces/queries"
import { moveErrorMessage } from "@/libs/move-error"
import { createClient } from "@/libs/supabase/server"
import { categorySchema } from "./schemas"
import { DUPLICATE_NAME, createCategoryRecord } from "./service"
import type { CategoryActionResult, CategoryFormState } from "./types"

const UNIQUE_VIOLATION = "23505"
const NOT_FOUND = "No se encontró la categoría"
const DEFAULT_ERROR = "No se pudo guardar la categoría. Intenta de nuevo"

const updateCategorySchema = categorySchema.omit({ type: true })
const idSchema = z.uuid()

function readString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

function toFormError(
  error: PostgrestError,
  values: CategoryFormState["values"]
): CategoryFormState {
  if (error.code === UNIQUE_VIOLATION) {
    return { fieldErrors: { name: [DUPLICATE_NAME] }, values }
  }
  return { error: DEFAULT_ERROR, values }
}

export async function createCategory(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  const values = { name: readString(formData, "name") }
  const parsed = categorySchema.safeParse({
    name: values.name,
    type: readString(formData, "type"),
    icon: readString(formData, "icon"),
    color: readString(formData, "color")
  })

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requireWritableWorkspace(
    readString(formData, "workspace_id")
  )
  const result = await createCategoryRecord(
    await createClient(),
    workspace,
    parsed.data
  )

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
  }

  refresh()
  return { ok: true, category: result.after }
}

// El tipo no se cambia: los movimientos de la categoría dependen de él
export async function updateCategory(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  const values = { name: readString(formData, "name") }
  const id = idSchema.safeParse(readString(formData, "id"))
  const parsed = updateCategorySchema.safeParse({
    name: values.name,
    icon: readString(formData, "icon"),
    color: readString(formData, "color")
  })

  if (!id.success) {
    return { error: NOT_FOUND, values }
  }
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requireWritableWorkspace(
    readString(formData, "workspace_id")
  )
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("categories")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return toFormError(error, values)
  }
  if (data.length === 0) {
    return { error: NOT_FOUND, values }
  }

  refresh()
  return { ok: true }
}

async function setArchived(
  workspaceId: string,
  id: string,
  archived: boolean
): Promise<CategoryActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: NOT_FOUND }
  }

  const workspace = await requireWritableWorkspace(workspaceId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("categories")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", parsedId.data)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return {
      error: archived
        ? "No se pudo archivar la categoría. Intenta de nuevo"
        : "No se pudo restaurar la categoría. Intenta de nuevo"
    }
  }
  if (data.length === 0) {
    return { error: NOT_FOUND }
  }

  refresh()
  return {}
}

export async function archiveCategory(
  workspaceId: string,
  id: string
): Promise<CategoryActionResult> {
  return setArchived(workspaceId, id, true)
}

// El índice único también cubre las archivadas, así que restaurar nunca
// duplica un nombre
export async function restoreCategory(
  workspaceId: string,
  id: string
): Promise<CategoryActionResult> {
  return setArchived(workspaceId, id, false)
}

// Reordena las categorías propias activas de un tipo (SPEC 45): la
// categoría toma el lugar de la destino. Los selects siguen este orden
export async function moveCategory(
  workspaceId: string,
  id: string,
  targetId: string
): Promise<CategoryActionResult> {
  const parsedId = idSchema.safeParse(id)
  const parsedTarget = idSchema.safeParse(targetId)

  if (!parsedId.success || !parsedTarget.success) {
    return { error: NOT_FOUND }
  }

  const workspace = await requireWritableWorkspace(workspaceId)
  const supabase = await createClient()
  const { error } = await supabase.rpc("move_category", {
    p_workspace_id: workspace.id,
    p_id: parsedId.data,
    p_target_id: parsedTarget.data
  })

  if (error) {
    return { error: moveErrorMessage(error) }
  }

  refresh()
  return {}
}
