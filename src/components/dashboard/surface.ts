// Superficies del dashboard sin borde: las separa el contraste
// fondo/superficie, como a las tarjetas de HeroUI (`Card`)

/** Lista suelta sobre el fondo: una tarjeta con filas separadas */
export const SURFACE_LIST =
  "flex flex-col divide-y divide-separator overflow-hidden rounded-3xl bg-surface shadow-(--surface-shadow)"

/** Fila de SURFACE_LIST */
export const SURFACE_ROW = "px-5 py-4"

/** Lista dentro de una tarjeta: sin caja propia */
export const CARD_LIST = "flex flex-col divide-y divide-separator"

/** Fila de CARD_LIST */
export const CARD_ROW = "py-3 first:pt-0 last:pb-0"

/** Tarjeta de un elemento en una grilla (deuda, meta, cuenta por cobrar) */
export const SURFACE_ITEM =
  "rounded-3xl bg-surface p-5 shadow-(--surface-shadow)"

/**
 * Tarjeta de grilla clicable completa (SPEC 25): el botón de detalle lleva
 * CARD_LINK y se estira con ::after sobre toda la tarjeta. Un solo elemento
 * interactivo abre el detalle; el hover y el foco se pintan en la tarjeta
 */
export const SURFACE_ITEM_CLICKABLE =
  "relative transition-colors hover:bg-surface-secondary has-[[data-card-link]:focus-visible]:ring-[3px] has-[[data-card-link]:focus-visible]:ring-focus/50"

/** Botón de detalle estirado (lleva además `data-card-link`) */
export const CARD_LINK =
  "cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-3xl after:content-['']"

/** Controles dentro de una tarjeta clicable (⋮, acciones): por encima del
 *  enlace estirado, así su clic no abre el detalle */
export const CARD_OVER_LINK = "relative z-10"

/** Aviso corto sobre el fondo ("Estás al día con tus pagos") */
export const SURFACE_NOTE =
  "rounded-3xl bg-surface p-4 text-center text-sm text-muted shadow-(--surface-shadow)"

/** Pill de control sobre el fondo (selector de mes, grupo de flechas): el
 *  mismo gris que las tarjetas y las tablas */
export const CONTROL_SURFACE = "bg-surface"

/** Botón de barra de herramientas (Verificar, Categorías, Filtros, mes
 *  anterior/siguiente): `variant="ghost"` más este relleno, para que
 *  concuerde con las tarjetas vecinas y con la pill del mes */
export const CONTROL_BUTTON = "bg-surface hover:bg-surface-secondary"
