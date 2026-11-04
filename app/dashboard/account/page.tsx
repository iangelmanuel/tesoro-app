import { redirect } from "next/navigation"
import { SITE } from "@/config/site"

// La cuenta se divide en secciones: /dashboard/account lleva a la primera
export default function AccountPage() {
  redirect(SITE.account.sections[0].href)
}
