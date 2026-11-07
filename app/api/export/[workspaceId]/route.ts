import type { NextRequest } from "next/server"
import { buildMovementsCsv } from "@/features/exports/csv"
import { loadExportData } from "@/features/exports/queries"
import {
  exportFileName,
  exportFormatSchema,
  parseExportRange
} from "@/features/exports/range"
import { buildWorkbook } from "@/features/exports/workbook/build-workbook"
import { findWorkspace } from "@/features/workspaces/queries"
import { todayISO } from "@/libs/dates"
import { createClient } from "@/libs/supabase/server"

// Descarga de la exportación de un espacio (SPEC 32). Lee con la sesión del
// usuario y RLS, nunca con service_role. Un espacio marcado para borrar
// también se exporta: es la última forma de sacar los datos.

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

function jsonError(status: number, error: string) {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } }
  )
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/export/[workspaceId]">
) {
  const { workspaceId } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return jsonError(401, "Inicia sesión para exportar tus datos.")
  }

  // RLS solo devuelve los espacios del dueño: uno ajeno o inexistente es null
  const workspace = await findWorkspace(workspaceId)
  if (!workspace) {
    return jsonError(404, "No encontramos este espacio.")
  }

  const params = request.nextUrl.searchParams
  const format = exportFormatSchema.safeParse(params.get("format"))
  if (!format.success) {
    return jsonError(400, "El formato debe ser xlsx o csv.")
  }

  const today = todayISO()
  const parsed = parseExportRange(params.get("from"), params.get("to"), today)
  if (!parsed.success) {
    return jsonError(400, parsed.error)
  }

  try {
    const data = await loadExportData(workspace, parsed.range, today)
    const fileName = exportFileName(workspace, parsed.range, format.data)
    const isExcel = format.data === "xlsx"
    const body = isExcel
      ? await buildWorkbook(workspace, data)
      : buildMovementsCsv(workspace.type, data.movements)

    return new Response(body, {
      headers: {
        "Content-Type": isExcel ? XLSX_TYPE : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store"
      }
    })
  } catch (error) {
    console.error("export failed", error)
    return jsonError(500, "No se pudo generar el archivo. Intenta de nuevo.")
  }
}
