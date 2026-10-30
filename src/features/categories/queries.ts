import { createClient } from "@/libs/supabase/server"
import type { Database } from "@/types/database"

export type Category = Database["public"]["Tables"]["categories"]["Row"]

// Categorías del sistema y propias del espacio (activas y archivadas).
// Primero las del sistema, luego las propias, cada grupo por nombre.
export async function getCategories(workspaceId: string): Promise<Category[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
    .order("workspace_id", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true })

  if (error) {
    throw new Error("No se pudieron cargar las categorías")
  }

  return data
}
