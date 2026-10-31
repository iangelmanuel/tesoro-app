"use server"

import type { Route } from "next"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"
import { SITE } from "@/config/site"
import { workspaceBasePath } from "@/features/workspaces/paths"
import { requireWritableWorkspace } from "@/features/workspaces/queries"
import { revalidateWorkspacePages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import { businessSchema } from "./schemas"
import type { BusinessFormState } from "./types"

const FIELDS = ["name", "tax_id", "sector"] as const

const NOT_FOUND = "No se encontró la empresa"
const DEFAULT_ERROR = "No se pudo guardar la empresa. Intenta de nuevo"
// Mensaje del trigger check_business_limit
const LIMIT_REACHED = "Alcanzaste el límite de empresas"
const INVALID_TAX_ID = "Revisa el formato del NIT"

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
): BusinessFormState {
  if (error.message.includes(LIMIT_REACHED)) {
    return { error: LIMIT_REACHED, values }
  }
  // Check de business_profiles.tax_id, por si el cliente se salta Zod
  if (error.code === "23514" && error.message.includes("tax_id")) {
    return { fieldErrors: { tax_id: [INVALID_TAX_ID] }, values }
  }
  if (error.code === "42501") {
    return { error: "No tienes permiso para modificar esta empresa", values }
  }
  return { error: DEFAULT_ERROR, values }
}

// Crea el espacio y su perfil en una transacción (create_business) y lleva
// al Resumen de la empresa. La BD aplica el límite de empresas
export async function createBusiness(
  _prevState: BusinessFormState,
  formData: FormData
): Promise<BusinessFormState> {
  const values = readValues(formData)
  const parsed = businessSchema.safeParse(values)

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const supabase = await createClient()
  const { data: id, error } = await supabase.rpc("create_business", {
    p_name: parsed.data.name,
    // La RPC acepta null aunque los tipos generados digan string
    p_tax_id: parsed.data.tax_id as string,
    p_sector: parsed.data.sector
  })

  if (error) {
    return toFormError(error, values)
  }

  // El aside y /dashboard/business cambian al tener una empresa
  revalidatePath(SITE.routes.dashboardBusiness, "layout")
  redirect(workspaceBasePath({ id, type: "business" }) as Route)
}

// Nombre en workspaces (único campo editable por el usuario) y NIT y sector
// en business_profiles
export async function updateBusiness(
  _prevState: BusinessFormState,
  formData: FormData
): Promise<BusinessFormState> {
  const values = readValues(formData)
  const parsed = businessSchema.safeParse(values)

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requireWritableWorkspace(formData.get("workspace_id"))
  if (workspace.type !== "business") {
    return { error: NOT_FOUND, values }
  }

  const supabase = await createClient()
  const { data: profile, error: profileError } = await supabase
    .from("business_profiles")
    .update({ tax_id: parsed.data.tax_id, sector: parsed.data.sector })
    .eq("workspace_id", workspace.id)
    .select("workspace_id")

  if (profileError) {
    return toFormError(profileError, values)
  }
  if (profile.length === 0) {
    return { error: NOT_FOUND, values }
  }

  const { error } = await supabase
    .from("workspaces")
    .update({ name: parsed.data.name })
    .eq("id", workspace.id)

  if (error) {
    return toFormError(error, values)
  }

  revalidateWorkspacePages(workspace)
  return { ok: true }
}
