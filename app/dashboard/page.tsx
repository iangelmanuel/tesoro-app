import { redirect } from "next/navigation"
import { SITE } from "@/config/site"

export default function DashboardPage() {
  redirect(SITE.routes.dashboardPersonal)
}
