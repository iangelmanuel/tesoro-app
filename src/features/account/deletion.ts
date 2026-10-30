import { SITE } from "@/config/site"
import { todayISO } from "@/libs/dates"

const DAY_MS = 24 * 60 * 60 * 1000

const LONG_DATE = new Intl.DateTimeFormat(SITE.site.locale, {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric"
})

/**
 * Día de la purga en America/Bogota (YYYY-MM-DD): `deletion_requested_at` +
 * los días de gracia. Recibe el valor de `user.app_metadata`.
 */
export function deletionDate(requestedAt: string) {
  const purgeAt = new Date(
    new Date(requestedAt).getTime() + SITE.accountDeletionGraceDays * DAY_MS
  )
  return todayISO(purgeAt)
}

/** "29 de noviembre de 2026" a partir de un YYYY-MM-DD */
export function formatDeletionDate(date: string) {
  const [year, month, day] = date.split("-").map(Number)
  return LONG_DATE.format(new Date(Date.UTC(year, month - 1, day)))
}

/** ISO de la marca de borrado del usuario, o null si no está marcado */
export function deletionRequestedAt(user: {
  app_metadata: Record<string, unknown>
}) {
  const value = user.app_metadata.deletion_requested_at
  return typeof value === "string" ? value : null
}
