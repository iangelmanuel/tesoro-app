import type { PostgrestError } from "@supabase/supabase-js"

// Mensaje de las RPC de reordenar (SPEC 19 y 45) para un toast
export function moveErrorMessage(error: PostgrestError) {
  if (error.code === "42501") {
    return "No tienes permiso para reordenar en este espacio"
  }
  if (error.message.includes("mismo día")) {
    return "Solo se puede reordenar dentro del mismo día"
  }
  if (error.message.includes("mismo tipo")) {
    return "Solo se puede reordenar dentro del mismo tipo"
  }
  return "No se pudo reordenar. Intenta de nuevo"
}
