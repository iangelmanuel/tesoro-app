import { Suspense } from "react"
import Link from "next/link"
import { buttonVariants } from "@heroui/react"
import { SITE } from "@/config/site"
import { createClient } from "@/libs/supabase/server"

// Botones de sesión del header. El fallback es el estado sin sesión, así el
// shell prerenderizado ya trae enlaces útiles mientras la isla resuelve.
// Son enlaces con el estilo del Button de HeroUI
export function SessionButtons({ signedIn }: { signedIn: boolean }) {
  if (signedIn) {
    return (
      <Link
        href={SITE.routes.dashboard}
        className={buttonVariants()}
      >
        Ir al dashboard
      </Link>
    )
  }

  return (
    <>
      <Link
        href={SITE.navigation.secondary.href}
        className={buttonVariants({ variant: "ghost" })}
      >
        {SITE.navigation.secondary.label}
      </Link>
      <Link
        href={SITE.navigation.cta.href}
        className={buttonVariants()}
      >
        {SITE.navigation.cta.label}
      </Link>
    </>
  )
}

// Solo esta parte lee cookies: `createClient` llama a `connection()`, así
// que el resto de la página sigue siendo estática (PPR)
async function SessionIsland() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  return <SessionButtons signedIn={Boolean(data?.claims)} />
}

export function SiteHeaderSession() {
  return (
    <Suspense fallback={<SessionButtons signedIn={false} />}>
      <SessionIsland />
    </Suspense>
  )
}
