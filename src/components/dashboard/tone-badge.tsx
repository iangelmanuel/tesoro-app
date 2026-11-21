import { cn } from "@/libs/cn"

/**
 * Chip de estado ("Vencido", "Bueno", "En riesgo"…). El color sale de
 * `tone.ts` (TONE_BADGE_CLASSES o las clases de estado de cada feature),
 * nunca de la paleta cruda de Tailwind
 */
export function ToneBadge({
  className,
  children
}: {
  /** Fondo y texto del tono */
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      data-slot="tone-badge"
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center rounded-4xl px-2.5 text-xs font-medium whitespace-nowrap",
        className
      )}
    >
      {children}
    </span>
  )
}
