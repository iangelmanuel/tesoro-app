import { ChartPieIcon, PenLineIcon, TrendingUpIcon } from "lucide-react"
import { SectionHeading } from "./section-heading"

const STEPS = [
  {
    title: "Registra",
    description:
      "Anota ingresos, gastos, deudas y metas, o impórtalos desde un archivo Excel o CSV.",
    icon: PenLineIcon
  },
  {
    title: "Visualiza",
    description:
      "Mira a dónde va tu dinero con gráficas por categoría, mes y cuenta, y reportes listos.",
    icon: ChartPieIcon
  },
  {
    title: "Mejora",
    description:
      "Sigue tu score de salud financiera y aplica recomendaciones concretas para subirlo.",
    icon: TrendingUpIcon
  }
]

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-title"
      className="scroll-mt-16 border-t bg-muted/40"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading
          id="como-funciona-title"
          eyebrow="Cómo funciona"
          title="Tres pasos, desde el primer registro"
        />
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                  {index + 1}
                </span>
                <step.icon
                  aria-hidden="true"
                  className="size-5 text-muted-foreground"
                />
              </div>
              <h3 className="text-lg font-medium">{step.title}</h3>
              <p className="text-sm text-muted-foreground">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
