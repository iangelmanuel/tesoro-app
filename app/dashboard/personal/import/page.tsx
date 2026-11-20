import { Suspense } from "react"
import { getAccountBalances } from "@/features/accounts/queries"
import { getCategories } from "@/features/categories/queries"
import { ImportHeader } from "@/features/imports/components/import-header"
import {
  ImportHistory,
  ImportHistorySkeleton
} from "@/features/imports/components/import-history"
import {
  ImportWizard,
  ImportWizardSkeleton
} from "@/features/imports/components/import-wizard"
import { IMPORT_PATH } from "@/features/imports/constants"
import {
  getActiveDebtOptions,
  getActiveGoalOptions,
  getImports
} from "@/features/imports/queries"
import { parseImportTarget } from "@/features/imports/targets"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Importar",
  path: IMPORT_PATH,
  noindex: true
})

type ImportPageProps = PageProps<"/dashboard/personal/import">

export default function ImportPage({ searchParams }: ImportPageProps) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <ImportHeader />
      {/* searchParams y la sesión son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<ImportSkeleton />}>
        <ImportContent searchParams={searchParams} />
      </Suspense>
    </section>
  )
}

async function ImportContent({
  searchParams
}: Pick<ImportPageProps, "searchParams">) {
  const query = await searchParams
  const workspace = await getPersonalWorkspace()
  const [categories, accounts, imports, debts, goals] = await Promise.all([
    getCategories(workspace.id),
    getAccountBalances(workspace.id),
    getImports(workspace.id),
    getActiveDebtOptions(workspace.id),
    getActiveGoalOptions(workspace.id)
  ])

  // Las categorías y cuentas archivadas no aparecen como destino
  return (
    <>
      <ImportWizard
        workspaceId={workspace.id}
        initialTarget={parseImportTarget(query.target)}
        debts={debts}
        goals={goals}
        categories={categories
          .filter((category) => category.archived_at === null)
          .map(({ id, type, name }) => ({ id, type, name }))}
        accounts={accounts
          .filter((account) => account.archived_at === null)
          .map(({ id, name }) => ({ id, name }))}
        currency={workspace.currency}
      />
      <ImportHistory imports={imports} />
    </>
  )
}

export function ImportSkeleton() {
  return (
    <>
      <ImportWizardSkeleton />
      <ImportHistorySkeleton />
    </>
  )
}
