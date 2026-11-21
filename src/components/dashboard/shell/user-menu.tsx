"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUpRight,
  ChevronsUpDown,
  CircleHelp,
  EyeOff,
  LogOut,
  Moon,
  UserRound
} from "lucide-react"
import { useTheme } from "next-themes"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { SITE } from "@/config/site"
import { signOut } from "@/features/auth/actions"
import { useHideAmounts } from "./hide-amounts-context"

export interface DashboardUser {
  name: string
  email: string
  avatarUrl: string | null
}

export function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("")
}

function UserAvatar({ user }: { user: DashboardUser }) {
  return (
    <Avatar>
      {user.avatarUrl && (
        <AvatarImage
          src={user.avatarUrl}
          alt=""
        />
      )}
      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
    </Avatar>
  )
}

function UserInfo({ user }: { user: DashboardUser }) {
  return (
    <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
      <span className="truncate font-semibold">{user.name}</span>
      <span className="truncate text-xs text-muted-foreground">
        {user.email}
      </span>
    </div>
  )
}

/**
 * Menú de cuenta del pie del aside: Cuenta → Ayuda (↗) → Modo oscuro →
 * Ocultar cifras → Cerrar sesión. El tema y las cifras son casillas que no
 * cierran el menú (SPEC 41, SPEC 51)
 */
export function UserMenu({ user }: { user: DashboardUser }) {
  const router = useRouter()
  const [isSigningOut, startSignOut] = useTransition()
  const { resolvedTheme, setTheme } = useTheme()
  const { hidden, toggle } = useHideAmounts()
  const isDark = resolvedTheme === "dark"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menú de usuario"
        className="flex min-h-14 w-full cursor-pointer items-center gap-2.5 rounded-2xl p-2 text-left transition-colors duration-150 outline-none hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-popup-open:bg-sidebar-accent"
      >
        <UserAvatar user={user} />
        <UserInfo user={user} />
        <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        // Mismo ancho que el botón del pie del aside: se lee como parte de él
        className="w-(--anchor-width) min-w-60"
      >
        <div className="flex items-center gap-2 px-3 pt-2 pb-2">
          <UserAvatar user={user} />
          <UserInfo user={user} />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => router.push(SITE.account.sections[0].href)}
          >
            <UserRound />
            Cuenta
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <a
                href={SITE.repository.issues}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <CircleHelp />
            Ayuda
            <ArrowUpRight
              aria-hidden="true"
              className="ml-auto size-3.5 text-muted-foreground"
            />
            <span className="sr-only">(abre GitHub en otra pestaña)</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuCheckboxItem
            checked={isDark}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          >
            <Moon />
            Modo oscuro
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={hidden}
            onCheckedChange={toggle}
          >
            <EyeOff />
            Ocultar cifras
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isSigningOut}
          onClick={() => startSignOut(() => signOut())}
        >
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
