import { CARD } from "@/components/dashboard/surface"
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
