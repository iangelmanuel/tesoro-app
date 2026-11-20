"use client"

import { useEffect, useState } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import {
  CornerDownLeft,
  CreditCard,
  type LucideIcon,
  Target,
  UserRound,
  Wallet
} from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "@/components/ui/dialog"
import { SITE } from "@/config/site"
import { workspaceBasePath } from "@/features/workspaces/paths"
import { NAV_ICONS } from "../nav"
import { useQuickActions } from "../quick-actions-context"
import { type CommandEntity, loadCommandEntities } from "./actions"
import { useCommandPalette } from "./command-palette-context"
import { DETAIL_PARAM, OPEN_DETAIL_EVENT } from "./detail-param"

const ENTITY_ICONS: Record<CommandEntity["kind"], LucideIcon> = {
  account: Wallet,
  debt: CreditCard,
  goal: Target
}

const ENTITY_KINDS: Record<CommandEntity["kind"], string> = {
  account: "Cuenta",
  debt: "Deuda",
  goal: "Meta"
}

type EntitiesState =
  | { status: "loading"; workspaceId: string }
  | { status: "ready"; workspaceId: string; entities: CommandEntity[] }
  | { status: "error"; workspaceId: string }

/**
 * "Tus datos": cuentas, deudas y metas del espacio activo. Se cargan la
 * primera vez que se abre la paleta (no pesan en cada navegación) y quedan en
 * memoria hasta cambiar de espacio
 */
function useCommandEntities(open: boolean, workspaceId: string | undefined) {
  const [state, setState] = useState<EntitiesState | null>(null)
  const stale = workspaceId !== undefined && state?.workspaceId !== workspaceId

  useEffect(() => {
    if (!open || !workspaceId || !stale) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marca la carga al abrir
    setState({ status: "loading", workspaceId })
    loadCommandEntities(workspaceId)
      .then((entities) => {
        if (!cancelled) setState({ status: "ready", workspaceId, entities })
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", workspaceId })
      })
    return () => {
      cancelled = true
    }
  }, [open, workspaceId, stale])

  return workspaceId && !stale ? state : null
}

/**
 * Abre el detalle de una entidad: si su página ya está abierta (misma ruta y
 * pestaña), avisa al panel con un evento; si no, navega con ?detalle=<id>
 */
function openEntity(entity: CommandEntity, push: (href: Route) => void) {
  const target = new URL(entity.href, window.location.origin)
  const id = target.searchParams.get(DETAIL_PARAM)
  const current = new URL(window.location.href)
  const samePage =
    target.pathname === current.pathname &&
    target.searchParams.get("tab") === current.searchParams.get("tab")

  if (id && samePage) {
    window.dispatchEvent(new CustomEvent(OPEN_DETAIL_EVENT, { detail: { id } }))
    return
  }
  push(entity.href)
}

interface GoToItem {
  name: string
  href: string
  icon: LucideIcon
  /** Grupo del aside o "Cuenta", para la búsqueda */
  group: string
}

/**
 * Pantallas del espacio activo (desde SITE.navigation, como el aside) y las
 * de la cuenta. Fuera de un espacio (Cuenta) van las de Personal, como en el
 * aside
 */
function useGoToItems(): GoToItem[] {
  const { workspace } = useQuickActions()
  const items: GoToItem[] = []

  if (workspace?.type === "business") {
    const base = workspaceBasePath({ id: workspace.id, type: "business" })
    for (const group of SITE.navigation.business) {
      for (const item of group.items) {
        items.push({
          name: item.name,
          href: `${base}${item.segment}`,
          icon: NAV_ICONS[item.icon],
          group: group.label
        })
      }
    }
  } else {
    for (const group of SITE.navigation.personal) {
      for (const item of group.items) {
        items.push({
          name: item.name,
          href: item.href,
          icon: NAV_ICONS[item.icon],
          group: group.label
        })
      }
    }
  }

  for (const section of SITE.account.sections) {
    items.push({
      name: `Cuenta: ${section.name}`,
      href: section.href,
      icon: UserRound,
      group: "Cuenta"
    })
  }

  return items
}

/**
 * Paleta de comandos (SPEC 51 §5): un Command dentro de un Dialog. Grupos
 * Acciones (la misma lista del botón del header y la hoja móvil) e Ir a.
 * Elegir un ítem cierra la paleta y ejecuta la acción o navega
 */
export function CommandPalette() {
  const router = useRouter()
  const { open, setOpen } = useCommandPalette()
  const { actions, run, workspace } = useQuickActions()
  const goTo = useGoToItems()
  const entities = useCommandEntities(open, workspace?.id)

  function select(callback: () => void) {
    setOpen(false)
    callback()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] max-h-[76vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Buscar y ejecutar</DialogTitle>
        <DialogDescription className="sr-only">
          Escribe para buscar una acción, una pantalla o tus datos. Usa las
          flechas para moverte y Enter para elegir.
        </DialogDescription>
        <Command
          className="rounded-none bg-transparent"
          loop
        >
          <CommandInput
            placeholder={
              workspace ? "¿Qué quieres hacer o a dónde vas?" : "¿A dónde vas?"
            }
          />
          <CommandList className="max-h-[min(28rem,60vh)] p-1">
            <CommandEmpty>Nada coincide con tu búsqueda.</CommandEmpty>
            {actions.length > 0 && (
              <CommandGroup heading="Acciones">
                {actions.map(({ key, label, icon: Icon, keywords }) => (
                  <CommandItem
                    key={key}
                    value={`accion ${key} ${label}`}
                    keywords={keywords}
                    onSelect={() => select(() => run(key))}
                  >
                    <Icon />
                    {label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {actions.length > 0 && <CommandSeparator />}
            {entities && (
              <CommandGroup heading="Tus datos">
                {entities.status === "loading" && (
                  <CommandItem
                    disabled
                    value="tus datos cargando"
                  >
                    Cargando tus datos…
                  </CommandItem>
                )}
                {entities.status === "error" && (
                  <CommandItem
                    disabled
                    value="tus datos error"
                  >
                    No pudimos cargar tus datos. Cierra y vuelve a abrir.
                  </CommandItem>
                )}
                {entities.status === "ready" &&
                  entities.entities.map((entity) => {
                    const Icon = ENTITY_ICONS[entity.kind]
                    return (
                      <CommandItem
                        key={entity.id}
                        value={`dato ${entity.id} ${entity.name}`}
                        keywords={[ENTITY_KINDS[entity.kind]]}
                        onSelect={() =>
                          select(() =>
                            openEntity(entity, (href) => router.push(href))
                          )
                        }
                      >
                        <Icon />
                        <span className="truncate">{entity.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {ENTITY_KINDS[entity.kind]}
                        </span>
                      </CommandItem>
                    )
                  })}
              </CommandGroup>
            )}
            <CommandGroup heading="Ir a">
              {goTo.map(({ name, href, icon: Icon, group }) => (
                <CommandItem
                  key={href}
                  value={`ir ${href} ${name}`}
                  keywords={[group]}
                  onSelect={() => select(() => router.push(href as Route))}
                >
                  <Icon />
                  {name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div
            aria-hidden="true"
            className="flex items-center gap-4 border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground"
          >
            <span className="flex items-center gap-1.5">
              <CornerDownLeft className="size-3.5" />
              elegir
            </span>
            <span>↑ ↓ moverte</span>
            <span>Esc cerrar</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
