"use client"

import type { Route } from "next"
import Link from "next/link"
import { Building2, Check, ChevronsUpDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { workspaceBasePath } from "@/features/workspaces/paths"

export interface BusinessOption {
  id: string
  name: string
}

interface BusinessSwitcherProps {
  businesses: BusinessOption[]
  /** Empresa de la ruta actual */
  activeId: string
}

/** Cambia entre empresas. Solo se pinta si el usuario tiene más de una */
export function BusinessSwitcher({
  businesses,
  activeId
}: BusinessSwitcherProps) {
  const active = businesses.find((business) => business.id === activeId)

  if (businesses.length < 2 || !active) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="border"
        >
          <Building2 />
          <span className="truncate font-medium">{active.name}</span>
          <ChevronsUpDown className="ml-auto" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-(--radix-dropdown-menu-trigger-width)"
      >
        {businesses.map((business) => (
          <DropdownMenuItem
            key={business.id}
            asChild
          >
            <Link
              href={
                workspaceBasePath({
                  id: business.id,
                  type: "business"
                }) as Route
              }
            >
              <span className="truncate">{business.name}</span>
              {business.id === activeId && <Check className="ml-auto" />}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
