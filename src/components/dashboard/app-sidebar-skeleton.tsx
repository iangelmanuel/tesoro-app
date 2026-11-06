import { Skeleton } from "@heroui/react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader
} from "@/components/dashboard/sidebar"
import { SITE } from "@/config/site"
import { flattenNav } from "./nav"

// Anchos fijos: Math.random() no se permite al prerenderizar (cacheComponents)
export function AppSidebarSkeleton() {
  return (
    <Sidebar>
      <SidebarHeader>
        <Skeleton className="mx-1.5 h-9 w-28 rounded-xl" />
        <Skeleton className="h-9 w-full rounded-3xl" />
      </SidebarHeader>
      <SidebarContent>
        <ul className="flex flex-col gap-0.5">
          {flattenNav(SITE.navigation.personal).map((item) => (
            <li
              key={item.href}
              className="flex h-9 items-center gap-2.5 px-2.5"
            >
              <Skeleton className="size-4 rounded-md" />
              <Skeleton className="h-4 flex-1 rounded-md" />
            </li>
          ))}
        </ul>
      </SidebarContent>
      <SidebarFooter>
        <Skeleton className="h-9 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </SidebarFooter>
    </Sidebar>
  )
}
