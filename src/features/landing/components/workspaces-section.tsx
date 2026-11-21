import { NAV_ICONS } from "@/components/dashboard/nav"
import { SITE } from "@/config/site"
import { RevealItem, RevealList } from "./reveal"
import { SectionHeading } from "./section-heading"

const NOTES = {
  personal: "Incluido desde que creas tu cuenta.",
  business: "Opcional: lo creas cuando tengas un negocio."
}

// Color de cada espacio (tokens --workspace-*, los mismos del dashboard)
const COLORS = {
  personal: "var(--workspace-personal)",
  business: "var(--workspace-business)"
}

const NAV = {
  personal: SITE.navigation.personal,
  business: SITE.navigation.business
}

// Espacios (SPEC 40): Personal y Empresa lado a lado, cada uno con su color
// real y su estructura tal como la muestra el aside del dashboard (los grupos
// de SPEC 31), en vez de dos tarjetas con viñetas. Réplica estática: sin
// enlaces, porque el dashboard pide sesión
export function WorkspacesSection() {
  return (
    <section
      aria-labelledby="espacios-title"
      className="bg-highlight/40"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading
          id="espacios-title"
          title="Tu casa y tu negocio, cada uno en su lugar"
          description="Dos espacios en la misma cuenta. Cambias de uno a otro en un clic y sus cifras nunca se mezclan. Ambos llevan movimientos y cuentas."
        />
        <RevealList className="grid gap-10 md:grid-cols-2 md:gap-6">
          {SITE.workspaces.types.map((workspace) => (
            <RevealItem
              key={workspace.id}
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col gap-1.5">
                <h3 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[workspace.id] }}
                  />
                  {workspace.name}
                </h3>
                <p className="text-pretty text-muted-foreground">
                  {workspace.description} {NOTES[workspace.id]}
                </p>
              </div>

              <div className="flex flex-col gap-5 rounded-3xl bg-card p-5 shadow-(--surface-shadow)">
                {NAV[workspace.id].map((group) => (
                  <div
                    key={group.label}
                    className="flex flex-col gap-1"
                  >
                    <h4 className="px-3 text-xs font-medium text-muted-foreground">
                      {group.label}
                    </h4>
                    <ul className="flex flex-col">
                      {group.items.map((item, index) => {
                        const Icon = NAV_ICONS[item.icon]
                        // El primer ítem (Resumen) va activo, como al entrar
                        const active =
                          group === NAV[workspace.id][0] && index === 0
                        return (
                          <li
                            key={item.name}
                            className="flex h-9 items-center gap-2.5 rounded-xl px-3 text-sm"
                            style={
                              active
                                ? {
                                    backgroundColor: `color-mix(in oklab, ${COLORS[workspace.id]} 14%, transparent)`
                                  }
                                : undefined
                            }
                          >
                            <Icon
                              aria-hidden="true"
                              className="size-4 shrink-0"
                              style={{
                                color: active ? COLORS[workspace.id] : undefined
                              }}
                            />
                            <span className={active ? "font-medium" : ""}>
                              {item.name}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </RevealItem>
          ))}
        </RevealList>
      </div>
    </section>
  )
}
