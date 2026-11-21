import type { Database } from "@/types/database"

/** Tipo de espacio: `personal` (Personal) o `business` (Empresa) */
export type WorkspaceType = Database["public"]["Enums"]["workspace_type"]
