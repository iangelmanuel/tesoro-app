// Colores de estado (chips y barras) desde los tokens de HeroUI, no desde la
// paleta cruda de Tailwind: así siguen el tema y los cambios de tokens. Los
// pares *-soft / *-soft-foreground dan ≥ 6.3:1 (docs/ui.md)

export type Tone = "success" | "warning" | "danger" | "info" | "neutral"

/** Fondo y texto de un chip de estado */
export const TONE_BADGE_CLASSES: Record<Tone, string> = {
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  danger: "bg-danger-soft text-danger-soft-foreground",
  // Sin token info en HeroUI: el tinte de --balance con texto normal
  info: "bg-(--balance)/15 text-foreground",
  neutral: "bg-default text-muted"
}

/** Relleno de una barra de progreso según su estado */
export const TONE_BAR_CLASSES: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-(--balance)",
  neutral: "bg-muted"
}

/** Texto de una cifra según su estado (AA sobre la superficie) */
export const TONE_TEXT_CLASSES: Record<Tone, string> = {
  success: "text-(--income)",
  warning: "text-warning",
  danger: "text-(--expense)",
  info: "text-(--balance)",
  neutral: "text-muted"
}
