import type { WorkspaceType } from "./types"

// Contrato de los servicios de escritura (SPEC 34): los usan las Server
// Actions y el MCP. Reciben un espacio ya resuelto con permiso de escritura
// y devuelven las filas tocadas o los errores para el formulario.

/** Espacio ya resuelto con permiso de escritura */
export interface ServiceWorkspace {
  id: string
  type: WorkspaceType
}

/** Falla de un servicio: error general o por campo */
export interface ServiceFailure {
  ok: false
  error?: string
  fieldErrors?: Partial<Record<string, string[]>>
}

/** Resultado de un servicio: `{ ok: true, … }` o una falla */
export type ServiceResult<T> = ({ ok: true } & T) | ServiceFailure

/** Arma una falla de servicio */
export const fail = (failure: Omit<ServiceFailure, "ok">): ServiceFailure => ({
  ok: false,
  ...failure
})
