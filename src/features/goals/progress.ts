import { todayISO } from "@/libs/dates"

export type GoalStatus = "completed" | "archived" | "on_track" | "at_risk"

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  completed: "Cumplida",
  archived: "Archivada",
  on_track: "En camino",
  at_risk: "En riesgo"
}

/** Campos de una meta que usan los cálculos */
export interface GoalProgressInput {
  target_amount: number
  target_date: string | null
  status: "active" | "completed" | "archived"
  created_at: string
  saved: number
}

const DAY_MS = 24 * 60 * 60 * 1000

// Días entre dos fechas YYYY-MM-DD, sin zona horaria de por medio
function daysBetween(from: string, to: string) {
  return (Date.parse(to) - Date.parse(from)) / DAY_MS
}

/** Progreso entero, truncado. Puede pasar de 100. */
export function goalPercent(saved: number, target: number) {
  return Math.max(Math.floor((saved / target) * 100), 0)
}

/** Lo que falta para la meta, nunca negativo */
export function goalRemaining(saved: number, target: number) {
  return Math.max(target - saved, 0)
}

/**
 * Meses desde el siguiente al actual hasta el de la fecha objetivo,
 * contando ambos; mínimo 1. Hoy 30 oct y objetivo 15 dic → 2.
 */
export function monthsRemaining(targetDate: string, today = todayISO()) {
  const [targetYear, targetMonth] = targetDate.split("-").map(Number)
  const [year, month] = today.split("-").map(Number)
  return Math.max(targetYear * 12 + targetMonth - (year * 12 + month), 1)
}

/** Fecha de creación de la meta en America/Bogota (YYYY-MM-DD) */
export function goalStartDate(createdAt: string) {
  return todayISO(new Date(createdAt))
}

/**
 * Lo que debería llevar ahorrado hoy con avance lineal desde la creación,
 * con tope en el objetivo. Si la fecha objetivo no es posterior al inicio,
 * el esperado es el objetivo completo.
 */
export function expectedSaved(
  goal: Pick<GoalProgressInput, "target_amount" | "created_at">,
  targetDate: string,
  today = todayISO()
) {
  const start = goalStartDate(goal.created_at)
  const total = daysBetween(start, targetDate)

  if (total <= 0) {
    return goal.target_amount
  }

  const elapsed = Math.max(daysBetween(start, today), 0)
  return Math.min((goal.target_amount * elapsed) / total, goal.target_amount)
}

/** Aporte mensual sugerido, o null sin fecha objetivo o sin faltante */
export function suggestedMonthly(
  goal: Pick<GoalProgressInput, "target_amount" | "target_date" | "saved">,
  today = todayISO()
) {
  const remaining = goalRemaining(goal.saved, goal.target_amount)

  if (goal.target_date === null || remaining <= 0) {
    return null
  }
  return remaining / monthsRemaining(goal.target_date, today)
}

/** Estado de la meta, o null si está activa y no tiene fecha objetivo */
export function goalStatus(
  goal: GoalProgressInput,
  today = todayISO()
): GoalStatus | null {
  if (goal.status !== "active") {
    return goal.status
  }
  if (goal.target_date === null) {
    return null
  }
  return goal.saved >= expectedSaved(goal, goal.target_date, today)
    ? "on_track"
    : "at_risk"
}

/** Activa, con fecha objetivo pasada y faltante */
export function isOverdue(goal: GoalProgressInput, today = todayISO()) {
  return (
    goal.status === "active" &&
    goal.target_date !== null &&
    goal.target_date < today &&
    goal.saved < goal.target_amount
  )
}

/** Activa y con lo ahorrado ≥ objetivo */
export function isReached(goal: GoalProgressInput) {
  return goal.status === "active" && goal.saved >= goal.target_amount
}

/**
 * Orden de las metas activas: fecha objetivo más cercana primero y las que
 * no tienen fecha al final; empates por creación
 */
export function compareByTargetDate(
  a: Pick<GoalProgressInput, "target_date" | "created_at">,
  b: Pick<GoalProgressInput, "target_date" | "created_at">
) {
  if (a.target_date !== b.target_date) {
    if (a.target_date === null) return 1
    if (b.target_date === null) return -1
    return a.target_date < b.target_date ? -1 : 1
  }
  return a.created_at.localeCompare(b.created_at)
}
