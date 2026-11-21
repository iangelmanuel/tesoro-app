import { Skeleton } from "@/components/ui/skeleton"
import {
  AccountFieldSkeleton,
  AccountSectionSkeleton
} from "@/features/account/components/account-section"

/**
 * Ajustes de Empresa mientras cargan: datos de la empresa (nombre, NIT,
 * sector y Guardar) y la zona de peligro. Lo usan el Suspense de la página
 * y su loading.tsx
 */
export function BusinessSettingsSkeleton() {
  return (
    <>
      <AccountSectionSkeleton>
        <div className="flex flex-col gap-4">
          <AccountFieldSkeleton />
          <AccountFieldSkeleton />
          <AccountFieldSkeleton />
          <Skeleton className="h-11 w-28 self-end rounded-4xl" />
        </div>
      </AccountSectionSkeleton>
      <AccountSectionSkeleton>
        <Skeleton className="h-11 w-44 rounded-4xl" />
      </AccountSectionSkeleton>
    </>
  )
}
