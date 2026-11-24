/**
 * Pagos y avances de tarjeta y aportes de metas que llevan cuenta (SPEC 16).
 * Mueven capital, no son ingreso ni gasto: quedan fuera de los totales. Se
 * editan con el diálogo de la deuda o la meta (SPEC 26).
 */
export const ACCOUNT_MOVEMENT_KINDS = [
  "debt_payment",
  "debt_advance",
  "goal_contribution"
] as const

/**
 * Opciones del selector de tipo que no son un tipo de movimiento: abren otro
 * formulario dentro del diálogo (traspaso, pagos y aportes)
 */
export const FORM_PANELS = [
  "transfer",
  "debt_payment",
  "receivable",
  "recurring",
  "goal"
] as const

/** Filas por página de Verificar movimientos (SPEC 19) */
export const VERIFY_PAGE_SIZE = 50
