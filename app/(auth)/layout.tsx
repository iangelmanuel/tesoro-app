import Link from "next/link"
import { SITE } from "@/config/site"

export default function AuthLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          href={SITE.routes.home}
          className="flex flex-col items-center gap-1 self-center text-center"
        >
          <span className="text-2xl font-semibold tracking-tight">
            {SITE.info.name}
          </span>
          <span className="text-sm text-muted-foreground">
            {SITE.info.slogan}
          </span>
        </Link>
        {children}
      </div>
    </main>
  )
}
