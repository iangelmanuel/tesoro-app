import { z } from "zod"

// Apoyo de los tests de esquemas Zod (SPEC 55b)

/** Fecha pasada fija para los campos que no aceptan fechas futuras */
export const PAST_DATE = "2026-01-10"

/** Fecha futura para probar el rechazo */
export const FUTURE_ISO = "2099-01-01"

/** Un uuid válido para cuentas, categorías o movimientos */
export const SAMPLE_UUID = "3f0e2a4c-1b2d-4c5e-8f9a-0b1c2d3e4f5a"

/** Datos ya convertidos por el esquema, o sus errores por campo */
export function schemaResult(
  schema: z.ZodType,
  input: Record<string, unknown>
) {
  const result = schema.safeParse(input)
  return result.success
    ? result.data
    : { errors: z.flattenError(result.error).fieldErrors }
}
