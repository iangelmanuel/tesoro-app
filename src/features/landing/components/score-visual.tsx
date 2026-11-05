"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRightIcon } from "lucide-react"
import { TONE_BADGE_CLASSES } from "@/components/dashboard/tone"
import { cx as cn } from "@/libs/cx"
import { SCORE_BANDS } from "./score-bands"

// Ejemplo del score (datos ficticios). El medidor lleva las 4 bandas como
// tramos del arco y un marcador que recorre el arco una sola vez al entrar en
// pantalla. Sin JS o con reduced motion el marcador ya está en el valor, y
// nunca queda a medio camino al volver hacia arriba.

const SCORE = 78

const RECOMMENDATIONS = [
  {
    title: "Paga primero la tarjeta con mayor tasa",
    detail: "Ahorras intereses sin cambiar lo que pagas cada mes.",
    action: "Ir a Deudas"
  },
  {
    title: "Tu colchón cubre 1,5 meses de gastos",
    detail: "Un aporte fijo a tu meta de ahorro lo lleva a 3 meses.",
    action: "Ir a Metas"
  }
]

// Medio círculo de centro (60, 60) y radio 48: 0 a la izquierda, 100 a la
// derecha
const R = 48
function point(value: number) {
  const angle = Math.PI * (1 - value / 100)
  return { x: 60 + R * Math.cos(angle), y: 60 - R * Math.sin(angle) }
}
function arc(from: number, to: number) {
  const a = point(from)
  const b = point(to)
  return `M${a.x.toFixed(2)} ${a.y.toFixed(2)}A${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}

const ACTIVE = SCORE_BANDS.find(
  (band) => SCORE >= band.from && SCORE <= band.to
)

export function LandingScoreVisual() {
  const ref = useRef<HTMLDivElement>(null)
  // El servidor pinta el valor final; el cliente lo baja a 0 si aún no está
  // en pantalla y lo anima una vez al verlo (requestAnimationFrame, sin
  // librerías: el medidor no suma JS)
  const [value, setValue] = useState(SCORE)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    // El primer aviso del observer dice si ya está en pantalla (entonces se
    // queda en el valor final); si no, baja a 0 y anima al verlo
    let frame = 0
    let first = true
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        if (first) {
          first = false
          if (entry.isIntersecting) {
            observer.disconnect()
            return
          }
          setValue(0)
          return
        }
        if (!entry.isIntersecting) return
        observer.disconnect()
        const start = performance.now() + 150
        const tick = (now: number) => {
          const t = Math.min(1, Math.max(0, (now - start) / 1400))
          setValue(SCORE * (1 - Math.pow(1 - t, 4)))
          if (t < 1) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
      },
      { threshold: 0.5 }
    )
    observer.observe(element)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  const marker = point(value)

  return (
    <figure>
      <figcaption className="sr-only">
        Ejemplo de score financiero con datos ficticios: {SCORE} de 100, banda{" "}
        {ACTIVE?.label}, y dos recomendaciones: pagar primero la tarjeta con
        mayor tasa y subir el colchón de emergencia a 3 meses.
      </figcaption>
      <div
        aria-hidden="true"
        className="flex flex-col gap-6 rounded-3xl bg-surface p-5 shadow-(--surface-shadow) sm:p-7"
      >
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="font-medium text-foreground">Salud financiera</span>
          <span>Datos de ejemplo</span>
        </div>

        <div
          ref={ref}
          className="flex flex-col items-center gap-3"
        >
          <svg
            viewBox="0 0 120 66"
            className="w-full max-w-72"
          >
            {SCORE_BANDS.map((band) => (
              <path
                key={band.label}
                d={arc(band.from + (band.from ? 1.2 : 0), band.to)}
                fill="none"
                stroke={band.color}
                strokeWidth="9"
                strokeLinecap="butt"
                opacity={band === ACTIVE ? 1 : 0.28}
              />
            ))}
            <circle
              r="6.5"
              cx={marker.x}
              cy={marker.y}
              fill="var(--surface)"
              stroke="var(--foreground)"
              strokeWidth="2.5"
            />
            <text
              x="60"
              y="58"
              textAnchor="middle"
              className="fill-foreground text-[24px] font-semibold tabular-nums"
            >
              {SCORE}
            </text>
          </svg>
          <div className="flex items-center gap-2 text-sm">
            {ACTIVE && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  TONE_BADGE_CLASSES[ACTIVE.tone]
                )}
              >
                {ACTIVE.label}
              </span>
            )}
            <span className="text-muted">+4 pts vs. el mes anterior</span>
          </div>
        </div>

        <ul className="flex flex-col divide-y divide-separator">
          {RECOMMENDATIONS.map((item) => (
            <li
              key={item.title}
              className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
            >
              <span className="text-sm font-medium">{item.title}</span>
              <span className="text-sm text-pretty text-muted">
                {item.detail}
              </span>
              <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-(--income)">
                {item.action}
                <ArrowRightIcon className="size-3.5" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  )
}
