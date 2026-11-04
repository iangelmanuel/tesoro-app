"use client"

import { useRef, useState } from "react"
import { cn } from "@heroui/react"
import { m } from "motion/react"
import { FeatureClip } from "./feature-clip"
import { ScrollSettle } from "./reveal"

type TourItem = {
  title: string
  description: string
  slug: string
  sources: { mp4: string; webm: string; poster: string }
}

// Recorrido de funciones (SPEC 24): una lista de pestañas y un clip grande de
// la función elegida, en vez de una grilla de tarjetas iguales con clips
// ilegibles. Pestañas accesibles: flechas, Inicio y Fin mueven el foco.
export function FeatureTour({ items }: { items: TourItem[] }) {
  const [active, setActive] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const current = items[active] ?? items[0]

  function focusTab(index: number) {
    const next = (index + items.length) % items.length
    setActive(next)
    tabs.current[next]?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const keys: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowRight: index + 1,
      ArrowUp: index - 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: items.length - 1
    }
    const target = keys[event.key]
    if (target === undefined) return
    event.preventDefault()
    focusTab(target)
  }

  if (!current) return null

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-10">
      <div
        role="tablist"
        aria-label="Funciones de Tesoro"
        aria-orientation="vertical"
        className="order-2 flex flex-col gap-1 lg:order-1"
      >
        {items.map((item, index) => {
          const selected = index === active
          return (
            <button
              key={item.slug}
              ref={(element) => {
                tabs.current[index] = element
              }}
              id={`tour-tab-${item.slug}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="tour-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "relative flex min-h-11 flex-col gap-1 rounded-3xl px-5 py-4 text-left transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none",
                selected
                  ? "bg-surface shadow-(--surface-shadow)"
                  : "hover:bg-default/60"
              )}
            >
              <span
                className={cn(
                  "font-medium",
                  selected ? "text-foreground" : "text-muted"
                )}
              >
                {item.title}
              </span>
              {selected && (
                <m.span
                  className="text-sm text-pretty text-muted"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  {item.description}
                </m.span>
              )}
            </button>
          )
        })}
      </div>

      <div
        id="tour-panel"
        role="tabpanel"
        aria-labelledby={`tour-tab-${current.slug}`}
        className="order-1 lg:order-2"
      >
        <ScrollSettle>
          <FeatureClip
            key={current.slug}
            sources={current.sources}
          />
        </ScrollSettle>
      </div>
    </div>
  )
}
