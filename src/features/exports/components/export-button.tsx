"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SITE } from "@/config/site"
import { ExportDialog, preloadExportForm } from "./export-dialog"

interface ExportButtonProps {
  workspaceId: string
  /** Mes YYYY-MM del primer movimiento o traspaso; null sin historial */
  historyStart: string | null
}

/** Reportes de Personal o de una empresa */
function isReportsRoute(pathname: string) {
  return (
    pathname === `${SITE.routes.dashboardPersonal}/reports` ||
    (pathname.startsWith(`${SITE.routes.dashboardBusiness}/`) &&
      pathname.endsWith("/reports"))
  )
}

// Acceso rápido del header, solo en Reportes. Con texto desde 640 px; en
// pantallas menores, solo ícono (44 px de alto, como "Más").
export function ExportButton({ workspaceId, historyStart }: ExportButtonProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  if (!isReportsRoute(pathname)) {
    return null
  }

  return (
    <>
      <Button
        variant="secondary"
        aria-label="Exportar"
        className="max-sm:px-3"
        onClick={() => setOpen(true)}
        onPointerEnter={preloadExportForm}
        onFocus={preloadExportForm}
      >
        <Download className="size-4" />
        <span className="hidden sm:inline">Exportar</span>
      </Button>
      <ExportDialog
        workspaceId={workspaceId}
        historyStart={historyStart}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
