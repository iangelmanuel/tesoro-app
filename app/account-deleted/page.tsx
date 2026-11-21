import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Logo } from "@/components/brand/logo"
import { CARD } from "@/components/dashboard/surface"
import { Skeleton } from "@/components/ui/skeleton"
import { SITE } from "@/config/site"
import { AccountDeletedActions } from "@/features/account/components/account-deleted-actions"
import {
  deletionDate,
  deletionRequestedAt,
  formatDeletionDate
} from "@/features/account/deletion"
import { buildMetadata } from "@/libs/seo"
import { createClient } from "@/libs/supabase/server"

export const metadata = buildMetadata({
  title: "Cuenta en borrado",
  path: SITE.routes.accountDeleted,
  noindex: true
})

// proxy.ts solo deja entrar a usuarios con la cuenta marcada para borrar
export default function AccountDeletedPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-highlight p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Logo
          size="lg"
          className="self-center"
        />
        <section className={CARD}>
          {/* La sesión es dinámica: va dentro de Suspense */}
          <Suspense fallback={<Skeleton className="h-48" />}>
            <AccountDeletedContent />
          </Suspense>
        </section>
      </div>
    </main>
  )
}

async function AccountDeletedContent() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(SITE.routes.signIn)
  }

  const requestedAt = deletionRequestedAt(user)
  if (!requestedAt) {
    redirect(SITE.routes.dashboard)
  }

  return (
    <>
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-semibold">Tu cuenta se va a borrar</h1>
        <p className="text-sm text-muted-foreground">
          El {formatDeletionDate(deletionDate(requestedAt))} borraremos tu
          cuenta y todos tus datos. Si cambiaste de opinión, restáurala ahora:
          todo sigue como lo dejaste, salvo tu foto.
        </p>
      </header>
      <AccountDeletedActions />
    </>
  )
}
