"use server"

import { refresh } from "next/cache"
import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { createClient } from "@/libs/supabase/server"
import { categorySchema } from "./schemas"
import type { CategoryActionResult, CategoryFormState } from "./types"

const UNIQUE_VIOLATION = "23505"
const DUPLICATE_NAME = "Ya tienes una categoría de este tipo con ese nombre"
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

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { error } = await supabase
    .from("categories")
    .insert({ ...parsed.data, workspace_id: workspace.id })

  if (error) {
    return toFormError(error, values)
  }

  refresh()
  return { ok: true }
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

  const workspace = await getPersonalWorkspace()
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
  id: string,
  archived: boolean
): Promise<CategoryActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: NOT_FOUND }
  }

  const workspace = await getPersonalWorkspace()
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
  id: string
): Promise<CategoryActionResult> {
  return setArchived(id, true)
}

// El índice único también cubre las archivadas, así que restaurar nunca
// duplica un nombre
export async function restoreCategory(
  id: string
): Promise<CategoryActionResult> {
  return setArchived(id, false)
}
