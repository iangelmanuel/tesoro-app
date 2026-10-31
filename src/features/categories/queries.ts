import { getWorkspace } from "@/features/workspaces/queries"
import { createClient } from "@/libs/supabase/server"
import type { Database } from "@/types/database"

export type Category = Database["public"]["Tables"]["categories"]["Row"]

// Categorías del sistema con el scope del espacio (Personal o Empresa) y
// propias del espacio (activas y archivadas). Primero las del sistema, luego
// las propias, cada grupo por nombre. Las propias ya tienen el scope de su
// espacio (trigger set_category_scope).
export async function getCategories(workspaceId: string): Promise<Category[]> {
  const workspace = await getWorkspace(workspaceId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("scope", workspace.type)
    .or(`workspace_id.is.null,workspace_id.eq.${workspace.id}`)
    .order("workspace_id", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true })

  if (error) {
    throw new Error("No se pudieron cargar las categorías")
  }

  return data
}
