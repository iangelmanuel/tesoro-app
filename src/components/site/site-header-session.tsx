import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SITE } from "@/config/site"
import { createClient } from "@/libs/supabase/server"

// Botones de sesión del header. El fallback es el estado sin sesión, así el
// shell prerenderizado ya trae enlaces útiles mientras la isla resuelve
export function SessionButtons({ signedIn }: { signedIn: boolean }) {
  if (signedIn) {
    return (
      <Button asChild>
        <Link href={SITE.routes.dashboard}>Ir al dashboard</Link>
      </Button>
    )
  }

  return (
    <>
      <Button
        asChild
        variant="ghost"
      >
        <Link href={SITE.navigation.secondary.href}>
          {SITE.navigation.secondary.label}
        </Link>
      </Button>
      <Button asChild>
        <Link href={SITE.navigation.cta.href}>{SITE.navigation.cta.label}</Link>
      </Button>
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
