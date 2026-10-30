"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SITE } from "@/config/site"

const WORKSPACE_TABS = [
  { value: "personal", label: "Personal", href: SITE.routes.dashboardPersonal },
  { value: "business", label: "Empresa", href: SITE.routes.dashboardBusiness }
] as const

export function WorkspaceTabs() {
  const pathname = usePathname()
  const active = pathname.startsWith(SITE.routes.dashboardBusiness)
    ? "business"
    : "personal"

  return (
    <Tabs
      value={active}
      activationMode="manual"
    >
      <TabsList className="w-full">
        {WORKSPACE_TABS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            asChild
          >
            <Link href={tab.href}>{tab.label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
