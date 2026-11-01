import { Skeleton } from "@heroui/react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader
} from "@/components/dashboard/sidebar"
import { SITE } from "@/config/site"

// Anchos fijos: Math.random() no se permite al prerenderizar (cacheComponents)
export function AppSidebarSkeleton() {
  return (
    <Sidebar>
      <SidebarHeader>
        <Skeleton className="mx-2 mt-1 h-7 w-24 rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </SidebarHeader>
      <SidebarContent>
        <ul className="flex flex-col gap-0.5">
          {SITE.navigation.personal.map((item) => (
            <li
              key={item.href}
              className="flex h-9 items-center gap-2 px-2"
            >
              <Skeleton className="size-4 rounded-md" />
              <Skeleton className="h-4 flex-1 rounded-md" />
            </li>
          ))}
        </ul>
      </SidebarContent>
      <SidebarFooter>
        <Skeleton className="h-12 w-full rounded-lg" />
      </SidebarFooter>
    </Sidebar>
  )
}
