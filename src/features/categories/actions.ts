"use server"

import { refresh } from "next/cache"
import { z } from "zod"
import { requireWritableWorkspace } from "@/features/workspaces/queries"
import { readFormValues } from "@/libs/form-data"
import { createClient } from "@/libs/supabase/server"
import { categorySchema } from "./schemas"
import {
  NOT_FOUND,
  createCategoryRecord,
  moveCategoryRecord,
  setCategoryArchived,
  updateCategoryRecord
} from "./service"
import type { CategoryActionResult, CategoryFormState } from "./types"

const FIELDS = ["workspace_id", "id", "name", "type", "icon", "color"] as const

const updateCategorySchema = categorySchema.omit({ type: true })
const idSchema = z.uuid()

export async function createCategory(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  const form = readFormValues(formData, FIELDS)
  const values = { name: form.name }
  const parsed = categorySchema.safeParse({
    name: form.name,
    type: form.type,
    icon: form.icon,
    color: form.color
  })

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requireWritableWorkspace(form.workspace_id)
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
  const form = readFormValues(formData, FIELDS)
  const values = { name: form.name }
  const id = idSchema.safeParse(form.id)
  const parsed = updateCategorySchema.safeParse({
    name: form.name,
    icon: form.icon,
    color: form.color
  })

  if (!id.success) {
    return { error: NOT_FOUND, values }
  }
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requireWritableWorkspace(form.workspace_id)
  const result = await updateCategoryRecord(
    await createClient(),
    workspace,
    id.data,
    parsed.data
  )

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
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
  const result = await setCategoryArchived(
    await createClient(),
    workspace,
    parsedId.data,
    archived
  )

  if (!result.ok) {
    return { error: result.error }
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

export async function restoreCategory(
  workspaceId: string,
  id: string
): Promise<CategoryActionResult> {
  return setArchived(workspaceId, id, false)
}

// Reordena las categorías propias activas de un tipo (SPEC 45)
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
  const result = await moveCategoryRecord(
    await createClient(),
    workspace,
    parsedId.data,
    parsedTarget.data
  )

  if (!result.ok) {
    return { error: result.error }
  }

  refresh()
  return {}
}
