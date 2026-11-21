"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { HelpKey } from "@/config/help"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { cn } from "@/libs/cn"
import { HelpHint } from "./help-hint"

interface DetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nombre del elemento (el título del panel) */
  title: string
  /** Ícono o avatar a la izquierda del título (metas) */
  leading?: React.ReactNode
  /** Estado con `tone.ts` (chips) */
  status?: React.ReactNode
  /** La cifra clave: monto, saldo pendiente o progreso */
  figure?: React.ReactNode
  /** Lo que acompaña la cifra ("Mensual", "de $ 2.000.000") */
  figureCaption?: React.ReactNode
  /** Texto bajo el título cuando no hay cifra (Categorías) */
  description?: React.ReactNode
  /** Lo que importa hoy: próximo pago o cobro, lo pagado, lo que falta */
  summary?: React.ReactNode
  /** La acción del momento (registrar pago, recibir, aportar), a todo el
   *  ancho y antes del historial para que se vea sin desplazar */
  action?: React.ReactNode
  /** Historial (y listas de periodos o cuotas) */
  history?: React.ReactNode
  /** Configuración: categoría, frecuencia, vigencia, proyección */
  details?: React.ReactNode
  /** Editar, pausar, archivar y eliminar, siempre al final */
  footer?: React.ReactNode
  /** Mientras llegan los datos que se piden al abrir: el skeleton ocupa el
   *  lugar de resumen, acción e historial con su misma forma */
  loading?: boolean
}

/**
 * Base de los paneles laterales de detalle (SPEC 40): Gastos fijos,
 * Ingresos fijos, Deudas y por cobrar, Metas y Categorías. Abre a la derecha
 * en escritorio y abajo (con asa) en el teléfono, con el mismo ancho. Define
 * la cabecera (nombre, estado y cifra en una zona) y el orden fijo del
 * cuerpo: resumen → acción → historial → detalles → acciones de edición.
 * Cada panel solo aporta su contenido.
 */
export function DetailSheet({
  open,
  onOpenChange,
  title,
  leading,
  status,
  figure,
  figureCaption,
  description,
  summary,
  action,
  history,
  details,
  footer,
  loading = false
}: DetailSheetProps) {
  const isMobile = useIsMobile()

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
    >
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "gap-0",
          isMobile
            ? "max-h-[90dvh] rounded-t-4xl pb-[env(safe-area-inset-bottom)]"
            : "w-full sm:max-w-md"
        )}
      >
        {isMobile && (
          <span
            aria-hidden="true"
            className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/40"
          />
        )}
        <SheetHeader className="pr-16">
          <div className="flex min-w-0 items-center gap-3">
            {leading}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="truncate">{title}</SheetTitle>
                {status}
              </div>
              {figure !== undefined && (
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-2xl font-bold tracking-[-0.01em] tabular-nums">
                    {figure}
                  </span>
                  {figureCaption && (
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {figureCaption}
                    </span>
                  )}
                </p>
              )}
              {description && (
                <p className="text-sm text-pretty text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
          <div
            className="flex flex-col gap-6"
            aria-busy={loading || undefined}
          >
            {loading ? (
              <DetailSheetSkeleton />
            ) : (
              <>
                {summary}
                {action && <div className="flex flex-col gap-2">{action}</div>}
                {history}
              </>
            )}
            {details}
            {footer && (
              <div className="flex flex-wrap gap-2 border-t border-border/70 pt-4">
                {footer}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Bloque con título dentro de un panel. Todos los paneles usan este mismo
 * encabezado (sin mayúsculas sostenidas), con ayuda opcional
 */
export function DetailSection({
  title,
  help,
  action,
  className,
  children
}: {
  title: string
  help?: HelpKey
  /** Algo pequeño a la derecha del título */
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          {help && <HelpHint topic={help} />}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * Cifras del resumen en una rejilla de dos columnas ("Pagado en 2026",
 * "Atrasado a la fecha"…). El color va en `className` de cada valor
 */
export function DetailStats({
  items
}: {
  items: {
    label: React.ReactNode
    value: React.ReactNode
    className?: string
  }[]
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-secondary p-4 text-sm">
      {items.map((item, index) => (
        <div
          key={index}
          // Con un número impar de cifras, la última ("Próximo por pagar",
          // la más larga) ocupa la fila entera
          className="flex min-w-0 flex-col gap-0.5 [&:last-child:nth-child(odd)]:col-span-2"
        >
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className={cn("font-semibold tabular-nums", item.className)}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Mismo cuerpo que un panel cargado: resumen, acción e historial */
export function DetailSheetSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-6"
    >
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-11 w-full rounded-full" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    </div>
  )
}
