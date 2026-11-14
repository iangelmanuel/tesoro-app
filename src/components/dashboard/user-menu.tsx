"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Avatar, Dropdown, Label, Separator } from "@heroui/react"
import {
  ArrowUpRight,
  ChevronsUpDown,
  CircleHelp,
  LogOut,
  MoonIcon,
  SunIcon,
  UserRound
} from "lucide-react"
import { useTheme } from "next-themes"
import { SITE } from "@/config/site"
import { signOut } from "@/features/auth/actions"

// Tema dentro del menú de cuenta (SPEC 40): Claro y Oscuro, sin "Sistema"
const THEMES = [
  { id: "light", label: "Claro", Icon: SunIcon },
  { id: "dark", label: "Oscuro", Icon: MoonIcon }
] as const

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
    <Avatar
      size="sm"
      className="rounded-full"
    >
      {user.avatarUrl && (
        <Avatar.Image
          src={user.avatarUrl}
          alt={user.name}
        />
      )}
      <Avatar.Fallback className="rounded-full">
        {getInitials(user.name)}
      </Avatar.Fallback>
    </Avatar>
  )
}

function UserInfo({ user }: { user: DashboardUser }) {
  return (
    <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
      <span className="truncate font-medium">{user.name}</span>
      <span className="truncate text-xs text-muted">{user.email}</span>
    </div>
  )
}

export function UserMenu({ user }: { user: DashboardUser }) {
  const router = useRouter()
  const [isSigningOut, startSignOut] = useTransition()
  const { resolvedTheme, setTheme } = useTheme()

  function onAction(key: React.Key) {
    if (key === "account") {
      router.push(SITE.account.sections[0].href)
    } else if (key === "sign-out") {
      startSignOut(() => signOut())
    }
  }

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label="Menú de usuario"
        className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors duration-150 outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus data-[pressed=true]:bg-default motion-reduce:transition-none"
      >
        <UserAvatar user={user} />
        <UserInfo user={user} />
        <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted" />
      </Dropdown.Trigger>
      <Dropdown.Popover
        placement="top start"
        className="min-w-60"
      >
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <UserAvatar user={user} />
          <UserInfo user={user} />
        </div>
        {/* Un solo menú (teclado: flechas de arriba abajo). El tema es una
            sección de selección única que no cierra el menú (SPEC 40) */}
        <Dropdown.Menu
          aria-label="Opciones de la cuenta"
          disabledKeys={isSigningOut ? ["sign-out"] : []}
          onAction={onAction}
        >
          <Dropdown.Item
            id="account"
            textValue="Cuenta"
          >
            <UserRound className="size-4" />
            <Label>Cuenta</Label>
          </Dropdown.Item>
          <Dropdown.Item
            id="help"
            textValue="Ayuda"
            href={SITE.repository.issues}
            target="_blank"
            rel="noreferrer"
          >
            <CircleHelp className="size-4" />
            <Label>Ayuda</Label>
            <ArrowUpRight
              aria-hidden="true"
              className="ml-auto size-3.5 text-muted"
            />
            <span className="sr-only">(abre GitHub en otra pestaña)</span>
          </Dropdown.Item>
          <Separator />
          <Dropdown.Section
            aria-label="Tema"
            selectionMode="single"
            disallowEmptySelection
            shouldCloseOnSelect={false}
            selectedKeys={resolvedTheme ? [resolvedTheme] : []}
            onSelectionChange={(keys) => {
              const [theme] = [...keys]
              if (typeof theme === "string") setTheme(theme)
            }}
            className="mx-1 my-1 flex gap-1 rounded-full bg-default p-1"
          >
            {THEMES.map(({ id, label, Icon }) => (
              <Dropdown.Item
                key={id}
                id={id}
                textValue={`Tema ${label.toLowerCase()}`}
                className="min-h-8 flex-1 justify-center rounded-full text-muted data-[selected=true]:bg-surface data-[selected=true]:text-foreground data-[selected=true]:shadow-(--surface-shadow) max-md:min-h-11"
              >
                <Icon className="size-4" />
                <Label>{label}</Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
          <Separator />
          <Dropdown.Item
            id="sign-out"
            textValue="Cerrar sesión"
          >
            <LogOut className="size-4" />
            <Label>Cerrar sesión</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
