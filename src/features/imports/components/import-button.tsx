import type { Route } from "next"
import Link from "next/link"
import { FileUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IMPORT_PATH } from "../constants"
import type { ImportTarget } from "../types"

// "Importar" en Gastos fijos, Deudas y Metas: abre el asistente con su
// destino elegido (SPEC 08b)
export function ImportButton({ target }: { target: ImportTarget }) {
  return (
    <Button
      variant="outline"
      asChild
    >
      <Link href={`${IMPORT_PATH}?target=${target}` as Route}>
        <FileUp data-icon="inline-start" />
        Importar
      </Link>
    </Button>
  )
}
