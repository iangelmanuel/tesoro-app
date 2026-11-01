// Textos de ayuda en contexto (ícono (i) de HelpHint). Una o dos frases en
// tuteo, sin jerga: qué es y cuándo está bien. Se reusan en todas las
// pantallas; si cambia una definición en docs/producto.md, se cambia aquí
export const HELP = {
  score:
    "Un puntaje de 0 a 100 que resume la salud de tus finanzas. Mira tu ahorro, tus deudas, tu colchón, tus presupuestos, tus metas y qué tan seguido registras. Desde 60 es Bueno y desde 80, Excelente.",
  utilization:
    "Cuánto de tu cupo de tarjetas estás usando. Por debajo del 30 % está bien; cerca del 100 % pesa en tu score.",
  savingsRate:
    "La parte de tus ingresos que te quedó después de gastar. Si es negativa, gastaste más de lo que entró. Un 20 % o más es una meta sana.",
  accumulatedBalance:
    "Todo lo que te ha entrado menos todo lo que has gastado desde tu primer registro. No es el saldo de tus cuentas: no cuenta traspasos ni saldos iniciales."
} as const

export type HelpKey = keyof typeof HELP

/** Nombre corto de cada concepto, para la etiqueta accesible del (i) */
export const HELP_LABELS: Record<HelpKey, string> = {
  score: "el score",
  utilization: "la utilización de tarjetas",
  savingsRate: "la tasa de ahorro",
  accumulatedBalance: "el balance acumulado"
}
