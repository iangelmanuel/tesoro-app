import { CARD } from "@/components/dashboard/data/surface"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/libs/cn"

interface AccountSectionProps {
  title: string
  description: string
  /** Zona de peligro: borde y título en rojo */
  destructive?: boolean
  /** Las secciones de los pasos siguientes aún no tienen contenido */
  children?: React.ReactNode
}

/** Una de las secciones apiladas de /dashboard/account */
export function AccountSection({
  title,
  description,
  destructive = false,
  children
}: AccountSectionProps) {
  return (
    <section
      className={cn(CARD, destructive && "border border-destructive/50")}
    >
      <header className="flex flex-col gap-1">
        <h2
          className={cn(
            "text-base font-semibold",
            destructive && "text-destructive"
          )}
        >
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      {children && <div className="flex flex-col gap-6">{children}</div>}
    </section>
  )
}

/** Sección mientras carga: misma tarjeta, título y descripción en bloques */
export function AccountSectionSkeleton({
  children
}: {
  children?: React.ReactNode
}) {
  return (
    <section className={CARD}>
      <div className="flex flex-col gap-1">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-5 w-full max-w-80" />
      </div>
      {children && <div className="flex flex-col gap-6">{children}</div>}
    </section>
  )
}

/** Campo de formulario mientras carga: etiqueta y control de 44 px */
export function AccountFieldSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-11 w-full rounded-4xl" />
    </div>
  )
}
