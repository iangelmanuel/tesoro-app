import { cn } from "@/libs/cn"
import { TONE_BADGE_CLASSES, type Tone } from "./tone"

/**
 * Chip de estado ("Vencido", "Bueno", "En riesgo"…). El color sale de
 * `tone.ts`: con `tone`, sus TONE_BADGE_CLASSES; si no, las clases que llegan
 * en `className` (las de estado de cada feature). Nunca la paleta cruda de
 * Tailwind
 */
export function ToneBadge({
  tone,
  className,
  children
}: {
  /** Tono del chip (fondo y texto de TONE_BADGE_CLASSES) */
  tone?: Tone
  /**
   * Clases extra; sin `tone`, el fondo y el texto. Con `tone`, lo que choque
   * gana aquí (tailwind-merge)
   */
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      data-slot="tone-badge"
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center rounded-4xl px-2.5 text-xs font-medium whitespace-nowrap",
        tone && TONE_BADGE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
