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
    "Todo lo que te ha entrado menos todo lo que has gastado desde tu primer registro. No es el saldo de tus cuentas: no cuenta traspasos ni saldos iniciales.",
  maintenanceFee:
    "Lo que el banco le suma cada mes al saldo de tu tarjeta. Tesoro lo registra solo el día de cobro y no toca tus cuentas: lo pagas dentro del pago de la tarjeta.",
  reconciliation:
    "Compara el saldo que ves en tu banco o billetera con el que calcula Tesoro en esa fecha y crea un ajuste por la diferencia. Con una fecha pasada, el saldo de hoy también cambia por los movimientos posteriores.",
  upcomingIncomes:
    "Lo que esperas recibir este mes, más lo que no te llegó en los dos meses anteriores. Atrasado quiere decir que ya pasó el día de pago y no has registrado el ingreso.",
  noFixedDate:
    "Para proyectos o inversiones que pagan cuando pagan. No tienen fechas ni estados: Tesoro suma lo que registras con ellos en el mes y en el año."
} as const

export type HelpKey = keyof typeof HELP

/** Nombre corto de cada concepto, para la etiqueta accesible del (i) */
export const HELP_LABELS: Record<HelpKey, string> = {
  score: "el score",
  utilization: "la utilización de tarjetas",
  savingsRate: "la tasa de ahorro",
  accumulatedBalance: "el balance acumulado",
  maintenanceFee: "la cuota de manejo",
  reconciliation: "la conciliación",
  upcomingIncomes: "los próximos ingresos",
  noFixedDate: "los ingresos sin fecha fija"
}
