import { Hourglass } from "lucide-react"

interface ComingSoonProps {
  title: string
  description?: string
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center">
        <Hourglass className="size-8 text-muted-foreground" />
        <p className="text-lg font-medium">Próximamente</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Estamos construyendo esta sección. Muy pronto podrás usarla aquí.
        </p>
      </div>
    </section>
  )
}
