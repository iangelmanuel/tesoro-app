import type { NextRequest } from "next/server"
import { buildMovementsCsv } from "@/features/exports/csv"
import { buildPdf } from "@/features/exports/pdf/build-pdf"
import { loadPdfData } from "@/features/exports/pdf/load-pdf-data"
import { loadExportData } from "@/features/exports/queries"
import {
  exportFileName,
  exportFormatSchema,
  parseExportRange,
  parsePdfOptions
} from "@/features/exports/range"
import { buildWorkbook } from "@/features/exports/workbook/build-workbook"
import { findWorkspace } from "@/features/workspaces/queries"
import { todayISO } from "@/libs/dates"
import { createClient } from "@/libs/supabase/server"

// Descarga de la exportación de un espacio: Excel y CSV (SPEC 32) y PDF
// (SPEC 33). Lee con la sesión del usuario y RLS, nunca con service_role. Un
// espacio marcado para borrar también se exporta: es la última forma de
// sacar los datos.

const CONTENT_TYPES = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  pdf: "application/pdf"
} as const

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
    return jsonError(400, "El formato debe ser xlsx, csv o pdf.")
  }

  // Tamaño, orientación y tema solo cuentan con PDF
  const pdfOptions =
    format.data === "pdf"
      ? parsePdfOptions({
          size: params.get("size"),
          orientation: params.get("orientation"),
          theme: params.get("theme")
        })
      : null
  if (pdfOptions && !pdfOptions.success) {
    return jsonError(400, pdfOptions.error)
  }

  const today = todayISO()
  const parsed = parseExportRange(
    params.get("from"),
    params.get("to"),
    today,
    format.data
  )
  if (!parsed.success) {
    return jsonError(400, parsed.error)
  }

  try {
    const range = parsed.range
    let body: BodyInit

    if (pdfOptions) {
      const data = await loadPdfData(workspace, range, today)
      const buffer = await buildPdf(
        workspace,
        data,
        range,
        today,
        pdfOptions.options
      )
      body = new Uint8Array(buffer)
    } else {
      const data = await loadExportData(workspace, range, today)
      body =
        format.data === "xlsx"
          ? await buildWorkbook(workspace, data, range, today)
          : buildMovementsCsv(workspace.type, data.movements)
    }

    const fileName = exportFileName(workspace, range, format.data)
    return new Response(body, {
      headers: {
        "Content-Type": CONTENT_TYPES[format.data],
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store"
      }
    })
  } catch (error) {
    console.error("export failed", error)
    return jsonError(500, "No se pudo generar el archivo. Intenta de nuevo.")
  }
}
