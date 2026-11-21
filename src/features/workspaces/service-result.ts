import type { WorkspaceType } from "@/features/workspaces/queries"

// Contrato de los servicios de escritura (SPEC 34): los usan las Server
// Actions y el MCP. Reciben un espacio ya resuelto con permiso de escritura
// y devuelven las filas tocadas o los errores para el formulario.

export interface ServiceWorkspace {
  id: string
  type: WorkspaceType
}

export interface ServiceFailure {
  ok: false
  error?: string
  fieldErrors?: Partial<Record<string, string[]>>
}

export type ServiceResult<T> = ({ ok: true } & T) | ServiceFailure

export const fail = (failure: Omit<ServiceFailure, "ok">): ServiceFailure => ({
  ok: false,
  ...failure
})
