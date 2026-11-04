import { CheckIcon } from "lucide-react"
import { SITE } from "@/config/site"
import { RevealItem, RevealList } from "./reveal"
import { SectionHeading } from "./section-heading"

// Lo propio de cada espacio sale de su menú del dashboard: sin el resumen,
// los ajustes ni lo que ambos comparten (movimientos y cuentas)
const SHARED = ["Resumen", "Ajustes", "Movimientos", "Cuentas"]

const HIGHLIGHTS = {
  personal: SITE.navigation.personal
    .map((item) => item.name)
    .filter((name) => !SHARED.includes(name)),
  business: SITE.navigation.business
    .map((item) => item.name)
    .filter((name) => !SHARED.includes(name))
}

const NOTES = {
  personal: "Incluido desde que creas tu cuenta.",
  business: "Opcional: lo creas cuando tengas un negocio."
}

export function WorkspacesSection() {
  return (
    <section
      aria-labelledby="espacios-title"
      className="bg-default/40"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading
          id="espacios-title"
          title="Tu casa y tu negocio, cada uno en su lugar"
          description="Dos espacios en la misma cuenta. Cambias de uno a otro en un clic y sus cifras nunca se mezclan. Ambos llevan movimientos y cuentas."
        />
        <RevealList className="grid gap-4 md:grid-cols-2">
          {SITE.workspaces.types.map((workspace) => (
            <RevealItem
              key={workspace.id}
              className="flex flex-col gap-5 rounded-3xl bg-surface p-6 shadow-(--surface-shadow) sm:p-8"
            >
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-semibold tracking-tight">
                  {workspace.name}
                </h3>
                <p className="text-sm text-pretty text-muted">
                  {NOTES[workspace.id]}
                </p>
              </div>
              <p className="text-pretty text-muted">{workspace.description}</p>
              <ul className="flex flex-wrap gap-2 text-sm">
                {HIGHLIGHTS[workspace.id].map((name) => (
                  <li
                    key={name}
                    className="flex items-center gap-1.5 rounded-full bg-default px-3 py-1.5"
                  >
                    <CheckIcon
                      aria-hidden="true"
                      className="size-3.5 text-(--income)"
                    />
                    {name}
                  </li>
                ))}
              </ul>
            </RevealItem>
          ))}
        </RevealList>
      </div>
    </section>
  )
}
