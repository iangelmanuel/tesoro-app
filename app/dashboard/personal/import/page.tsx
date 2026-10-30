import { Suspense } from "react"
import type { Route } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getCategories } from "@/features/categories/queries"
import { ImportHistory } from "@/features/imports/components/import-history"
import { ImportWizard } from "@/features/imports/components/import-wizard"
import { IMPORT_PATH } from "@/features/imports/constants"
import { getImports } from "@/features/imports/queries"
import { TRANSACTIONS_PATH } from "@/features/transactions/filters"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Importar movimientos",
  path: IMPORT_PATH,
  noindex: true
})

export default function ImportPage() {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          asChild
        >
          <Link href={TRANSACTIONS_PATH as Route}>
            <ArrowLeft data-icon="inline-start" />
            Movimientos
          </Link>
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Importar movimientos
          </h1>
          <p className="text-sm text-muted-foreground">
            Trae tus ingresos y gastos desde un Excel o un CSV. Revisas todo
            antes de guardar y puedes deshacer la importación.
          </p>
        </div>
      </header>
      {/* La sesión es dinámica: va dentro de Suspense */}
      <Suspense fallback={<ImportSkeleton />}>
        <ImportContent />
      </Suspense>
    </section>
  )
}

async function ImportContent() {
  const workspace = await getPersonalWorkspace()
  const [categories, imports] = await Promise.all([
    getCategories(workspace.id),
    getImports(workspace.id)
  ])

  // Las categorías archivadas no aparecen como destino
  return (
    <>
      <ImportWizard
        categories={categories
          .filter((category) => category.archived_at === null)
          .map(({ id, type, name }) => ({ id, type, name }))}
        currency={workspace.currency}
      />
      <ImportHistory imports={imports} />
    </>
  )
}

function ImportSkeleton() {
  return (
    <>
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-40 w-full" />
    </>
  )
}
