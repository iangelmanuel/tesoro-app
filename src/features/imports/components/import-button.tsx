import type { Route } from "next"
import Link from "next/link"
import { buttonVariants } from "@heroui/react"
import { FileUp } from "lucide-react"
import { IMPORT_PATH } from "../constants"
import type { ImportTarget } from "../types"

// "Importar" en Gastos fijos, Deudas y Metas: abre el asistente con su
// destino elegido (SPEC 08b)
export function ImportButton({ target }: { target: ImportTarget }) {
  return (
    <Link
      href={`${IMPORT_PATH}?target=${target}` as Route}
      className={buttonVariants({ variant: "outline" })}
      data-tour="import-button"
    >
      <FileUp className="size-4" />
      Importar
    </Link>
  )
}
