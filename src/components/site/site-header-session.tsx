import { Suspense } from "react"
import Link from "next/link"
import { buttonVariants, cn } from "@heroui/react"
import { ArrowRightIcon } from "lucide-react"
import { SITE } from "@/config/site"
import { createClient } from "@/libs/supabase/server"

// Botones de sesión del header. El fallback es el estado sin sesión, así el
// shell prerenderizado ya trae enlaces útiles mientras la isla resuelve.
// Son enlaces con el estilo del Button de HeroUI. La flecha del primario se
// desliza un poco al pasar el mouse
const PRIMARY = cn(
  buttonVariants(),
  "group h-11 gap-1.5 pr-4 pl-5 [&_svg]:transition-transform hover:[&_svg]:translate-x-0.5 motion-reduce:[&_svg]:transition-none"
)

export function SessionButtons({ signedIn }: { signedIn: boolean }) {
  if (signedIn) {
    return (
      <Link
        href={SITE.routes.dashboard}
        className={PRIMARY}
      >
        Abrir Tesoro
        <ArrowRightIcon className="size-4" />
      </Link>
    )
  }

  return (
    <>
      <Link
        href={SITE.navigation.secondary.href}
        className={cn(buttonVariants({ variant: "ghost" }), "h-11 px-4")}
      >
        {SITE.navigation.secondary.label}
      </Link>
      <Link
        href={SITE.navigation.cta.href}
        className={PRIMARY}
      >
        {SITE.navigation.cta.label}
        <ArrowRightIcon className="size-4" />
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
