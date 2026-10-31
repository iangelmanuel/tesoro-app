import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn
} from "@heroui/react"

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
    <Card className={cn(destructive && "border-danger/50")}>
      <CardHeader>
        <CardTitle className={cn(destructive && "text-danger")}>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children && (
        <CardContent className="flex flex-col gap-6">{children}</CardContent>
      )}
    </Card>
  )
}
