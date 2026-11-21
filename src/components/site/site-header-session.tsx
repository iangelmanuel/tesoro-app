import { Suspense } from "react"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { SITE } from "@/config/site"
import { cn } from "@/libs/cn"
import { createClient } from "@/libs/supabase/server"

// Botones de sesión del header. El fallback es el estado sin sesión, así el
// shell prerenderizado ya trae enlaces útiles mientras la isla resuelve.
// Son enlaces con el estilo del Button de HeroUI, sin prefetch al cargar: las
// rutas de auth y del dashboard traen react-aria y se precargan al pasar el
// mouse (rendimiento de la landing). La flecha del primario se
// desliza un poco al pasar el mouse
const PRIMARY = cn(
  buttonVariants(),
  "group h-11 gap-1.5 pr-4 pl-5 [&_svg]:transition-transform hover:[&_svg]:translate-x-0.5 motion-reduce:[&_svg]:transition-none"
)

// Versión compacta del header de escritorio (SPEC 40): "Iniciar sesión" como
// texto y el primario más bajo. En el cajón móvil van los de 44 px
const COMPACT_PRIMARY = cn(
  buttonVariants({ size: "sm" }),
  "group h-9 gap-1 pr-3 pl-4 whitespace-nowrap [&_svg]:transition-transform hover:[&_svg]:translate-x-0.5 motion-reduce:[&_svg]:transition-none"
)
const COMPACT_SECONDARY =
  "flex h-9 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap text-foreground outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ring"

export type SessionSize = "default" | "compact"

export function SessionButtons({
  signedIn,
  size = "default"
}: {
  signedIn: boolean
  size?: SessionSize
}) {
  const primary = size === "compact" ? COMPACT_PRIMARY : PRIMARY
  if (signedIn) {
    return (
      <Link
        href={SITE.routes.dashboard}
        prefetch={false}
        className={primary}
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
        prefetch={false}
        className={
          size === "compact"
            ? COMPACT_SECONDARY
            : cn(buttonVariants({ variant: "ghost" }), "h-11 px-4")
        }
      >
        {SITE.navigation.secondary.label}
      </Link>
      <Link
        href={SITE.navigation.cta.href}
        prefetch={false}
        className={primary}
      >
        {SITE.navigation.cta.label}
        <ArrowRightIcon className="size-4" />
      </Link>
    </>
  )
}

// Solo esta parte lee cookies: `createClient` llama a `connection()`, así
// que el resto de la página sigue siendo estática (PPR)
async function SessionIsland({ size }: { size: SessionSize }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  return (
    <SessionButtons
      signedIn={Boolean(data?.claims)}
      size={size}
    />
  )
}

export function SiteHeaderSession({
  size = "default"
}: {
  size?: SessionSize
}) {
  return (
    <Suspense
      fallback={
        <SessionButtons
          signedIn={false}
          size={size}
        />
      }
    >
      <SessionIsland size={size} />
    </Suspense>
  )
}
