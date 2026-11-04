import type { Tone } from "@/components/dashboard/tone"

// Bandas del score (docs/producto.md, "Bandas") para la landing: el medidor de
// score-visual.tsx y la leyenda de score-section.tsx. Módulo sin "use client"
// para que lo lean tanto el servidor como el cliente.
export const SCORE_BANDS: {
  label: string
  from: number
  to: number
  tone: Tone
  color: string
}[] = [
  { label: "Débil", from: 0, to: 39, tone: "danger", color: "var(--danger)" },
  {
    label: "Regular",
    from: 40,
    to: 59,
    tone: "warning",
    color: "var(--warning)"
  },
  { label: "Bueno", from: 60, to: 79, tone: "info", color: "var(--balance)" },
  {
    label: "Excelente",
    from: 80,
    to: 100,
    tone: "success",
    color: "var(--income)"
  }
]
