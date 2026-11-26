import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getAccountBalances } from "@/features/accounts/queries"
import { getCategories } from "@/features/categories/queries"
import { getExportHistoryStart } from "@/features/exports/movement-export-queries"
import {
  getBusinessWorkspaces,
  getPersonalWorkspace
} from "@/features/workspaces/queries"
import { CommandPaletteProvider } from "../command/command-palette-context"
import { CommandPaletteLazy } from "../command/command-palette-lazy"
import { CommandTrigger } from "../command/command-trigger"
import { MobileShell } from "../mobile/mobile-shell"
import { KeyboardShortcuts } from "../shortcuts/keyboard-shortcuts"
import {
  type QuickActionsData,
  QuickActionsProvider,
  type QuickActionsWorkspace
} from "./quick-actions-context"
import { QuickActionsMenu } from "./quick-actions-menu"

// Lee la sesión: va dentro de un Suspense por cacheComponents. El layout no
// conoce la ruta en el servidor, así que carga Personal y las empresas que
// aceptan escrituras, con sus categorías y cuentas; el componente client
// elige el espacio activo por la ruta. Metas, deudas, cobros, pagos e
// ingresos fijos se piden al abrir su formulario (SPEC 57, `actions.ts`)
async function QuickActionsLoader() {
  const [personal, businesses] = await Promise.all([
    getPersonalWorkspace(),
    getBusinessWorkspaces()
  ])
  const targets = [
    {
      id: personal.id,
      type: "personal" as const,
      currency: personal.currency
    },
    ...businesses
      .filter((business) => business.deletionRequestedAt === null)
      .map((business) => ({
        id: business.id,
        type: business.type,
        currency: business.currency
      }))
  ]

  const workspaces = await Promise.all(
    targets.map(async (workspace): Promise<QuickActionsWorkspace> => {
      const [categories, accounts, historyStart] = await Promise.all([
        getCategories(workspace.id),
        getAccountBalances(workspace.id),
        getExportHistoryStart(workspace.id)
      ])
      return { ...workspace, categories, accounts, historyStart }
    })
  )
  const data: QuickActionsData = { workspaces }

  return (
    <QuickActionsProvider value={data}>
      <CommandPaletteProvider>
        <CommandTrigger />
        <QuickActionsMenu />
        <MobileShell />
        <CommandPaletteLazy />
        <KeyboardShortcuts />
      </CommandPaletteProvider>
    </QuickActionsProvider>
  )
}

/** Accesos rápidos del header: la paleta de comandos, el primario del
 *  espacio y el menú "Más" */
export function QuickActions() {
  return (
    // La ruta no se conoce en el shell estático: el placeholder tiene el
    // tamaño del botón primario para que el header no salte al cargar
    <Suspense fallback={<QuickActionsSkeleton />}>
      <QuickActionsLoader />
    </Suspense>
  )
}

/** Hueco de los accesos: el primario y "Más", con su alto y su forma */
export function QuickActionsSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-2"
    >
      <Skeleton className="hidden h-11 w-56 rounded-4xl md:block lg:w-72" />
      <Skeleton className="h-11 w-11 rounded-4xl sm:w-52" />
      <Skeleton className="h-11 w-11 rounded-4xl sm:w-20" />
    </div>
  )
}
