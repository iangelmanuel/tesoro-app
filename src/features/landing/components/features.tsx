import {
  Building2Icon,
  ChartColumnIcon,
  CodeIcon,
  GaugeIcon,
  LightbulbIcon,
  type LucideIcon,
  NotebookPenIcon
} from "lucide-react"
import { SITE } from "@/config/site"
import { SectionHeading } from "./section-heading"

type FeatureIcon = (typeof SITE.features)[number]["icon"]

const FEATURE_ICONS: Record<FeatureIcon, LucideIcon> = {
  NotebookPen: NotebookPenIcon,
  ChartColumn: ChartColumnIcon,
  Lightbulb: LightbulbIcon,
  Gauge: GaugeIcon,
  Building2: Building2Icon,
  Code: CodeIcon
}

export function Features() {
  return (
    <section
      id="funciones"
      aria-labelledby="funciones-title"
      className="scroll-mt-16 border-t"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading
          id="funciones-title"
          eyebrow="Funciones"
          title="Todo lo que necesitas para entender tu dinero"
          description="Tú registras, Tesoro ordena. Sin conectar bancos ni compartir contraseñas."
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SITE.features.map((feature) => {
            const Icon = FEATURE_ICONS[feature.icon]

            return (
              <li
                key={feature.title}
                className="flex flex-col gap-3 rounded-xl border bg-card p-6"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-(--income)/10 text-(--income)">
                  <Icon
                    aria-hidden="true"
                    className="size-5"
                  />
                </span>
                <h3 className="font-medium">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
