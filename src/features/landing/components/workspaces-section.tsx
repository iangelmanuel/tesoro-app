import { Building2Icon, CheckIcon, UserIcon } from "lucide-react"
import { SITE } from "@/config/site"
import { SectionHeading } from "./section-heading"

// Lo que trae cada espacio sale de su menú del dashboard, sin el resumen
// ni los ajustes
const HIGHLIGHTS = {
  personal: SITE.navigation.personal
    .map((item) => item.name)
    .filter((name) => name !== "Resumen"),
  business: SITE.navigation.business
    .map((item) => item.name)
    .filter((name) => name !== "Resumen" && name !== "Ajustes")
}

const ICONS = { personal: UserIcon, business: Building2Icon }

const NOTES = {
  personal: "Incluido desde que creas tu cuenta.",
  business: "Opcional: créalo cuando lo necesites."
}

export function WorkspacesSection() {
  return (
    <section
      aria-labelledby="espacios-title"
      className="border-t bg-muted/40"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading
          id="espacios-title"
          eyebrow="Personal y Empresa"
          title="Dos espacios separados en la misma cuenta"
          description="Cambia entre tus finanzas personales y las de tu negocio en un clic. Los datos de cada espacio nunca se mezclan."
        />
        <ul className="grid gap-4 md:grid-cols-2">
          {SITE.workspaces.types.map((workspace) => {
            const Icon = ICONS[workspace.id]

            return (
              <li
                key={workspace.id}
                className="flex flex-col gap-5 rounded-xl border bg-card p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-(--income)/10 text-(--income)">
                    <Icon
                      aria-hidden="true"
                      className="size-5"
                    />
                  </span>
                  <div>
                    <h3 className="font-medium">{workspace.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {NOTES[workspace.id]}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {workspace.description}
                </p>
                <ul className="grid grid-cols-2 gap-2 text-sm">
                  {HIGHLIGHTS[workspace.id].map((name) => (
                    <li
                      key={name}
                      className="flex items-center gap-2"
                    >
                      <CheckIcon
                        aria-hidden="true"
                        className="size-4 text-(--income)"
                      />
                      {name}
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
