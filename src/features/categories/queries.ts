import { createClient } from "@/libs/supabase/server"
import type { Database } from "@/types/database"

export type Category = Database["public"]["Tables"]["categories"]["Row"]

// Categorías del sistema con el scope del espacio (Personal o Empresa) y
// propias del espacio (activas y archivadas). Primero las del sistema, luego
// las propias, cada grupo por nombre.
export async function getCategories(workspaceId: string): Promise<Category[]> {
  const supabase = await createClient()
  const [categories, workspace] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
      .order("workspace_id", { ascending: true, nullsFirst: true })
      .order("name", { ascending: true }),
    supabase.from("workspaces").select("type").eq("id", workspaceId).single()
  ])

  if (categories.error || workspace.error) {
    throw new Error("No se pudieron cargar las categorías")
  }

  // Las propias ya tienen el scope de su espacio (trigger set_category_scope)
  return categories.data.filter(
    (category) => category.scope === workspace.data.type
  )
}
