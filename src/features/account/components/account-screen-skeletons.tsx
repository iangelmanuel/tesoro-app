import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { Skeleton } from "@/components/ui/skeleton"
import { ConnectionsListSkeleton } from "@/features/mcp/components/connections-list"
import { OperationsListSkeleton } from "@/features/mcp/components/operations-list"
import { cn } from "@/libs/cn"
import { AccountFieldSkeleton, AccountSectionSkeleton } from "./account-section"

// Skeletons de cada sección de Cuenta (SPEC 53): los usan el `loading.tsx`
// de cada ruta y el fallback del Suspense de cada página

function ButtonSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-11 w-36 rounded-4xl", className)} />
}

/** Perfil: avatar con sus botones, nombre y email */
export function GeneralScreenSkeleton() {
  return (
    <AccountSectionSkeleton>
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 shrink-0 rounded-xl" />
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-4xl" />
            <Skeleton className="h-9 w-28 rounded-4xl" />
          </div>
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <AccountFieldSkeleton />
        <ButtonSkeleton />
      </div>
      <AccountFieldSkeleton />
    </AccountSectionSkeleton>
  )
}

/** Moneda, tutoriales y atajos */
export function PreferencesScreenSkeleton() {
  return (
    <>
      <AccountSectionSkeleton>
        <div className="flex flex-col gap-4">
          <AccountFieldSkeleton className="w-full sm:w-72" />
          <ButtonSkeleton />
        </div>
      </AccountSectionSkeleton>
      <AccountSectionSkeleton>
        <ul className={CARD_LIST}>
          {Array.from({ length: 4 }, (_, index) => (
            <li
              key={index}
              className={`flex items-center gap-3 ${CARD_ROW}`}
            >
              <Skeleton className="h-6 flex-1" />
              <Skeleton className="h-6 w-24 rounded-4xl" />
              <Skeleton className="h-9 w-28 rounded-4xl" />
            </li>
          ))}
        </ul>
      </AccountSectionSkeleton>
      <AccountSectionSkeleton>
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-6 w-10 rounded-full" />
        </div>
      </AccountSectionSkeleton>
    </>
  )
}

/** Ocultar cifras */
export function PrivacyScreenSkeleton() {
  return (
    <AccountSectionSkeleton>
      <div className="flex min-h-11 items-start gap-3">
        <Skeleton className="mt-0.5 h-6 w-10 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-1">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-15 w-full" />
        </div>
      </div>
    </AccountSectionSkeleton>
  )
}

/** Contraseña y zona de peligro */
export function SecurityScreenSkeleton() {
  return (
    <>
      <AccountSectionSkeleton>
        <div className="flex flex-col gap-4">
          <AccountFieldSkeleton />
          <AccountFieldSkeleton />
          <ButtonSkeleton />
        </div>
      </AccountSectionSkeleton>
      <AccountSectionSkeleton>
        <ButtonSkeleton />
      </AccountSectionSkeleton>
    </>
  )
}

/** Agentes conectados e historial (lo que carga con la sesión) */
export function AgentsListsSkeleton() {
  return (
    <>
      <AccountSectionSkeleton>
        <ConnectionsListSkeleton />
      </AccountSectionSkeleton>
      <AccountSectionSkeleton>
        <OperationsListSkeleton />
      </AccountSectionSkeleton>
    </>
  )
}

/** Agentes IA completo: la URL del MCP y las dos listas */
export function AgentsScreenSkeleton() {
  return (
    <>
      <AccountSectionSkeleton>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <AccountFieldSkeleton className="min-w-0 flex-1" />
          <Skeleton className="h-11 w-28 rounded-4xl" />
        </div>
      </AccountSectionSkeleton>
      <AgentsListsSkeleton />
    </>
  )
}
