"use client"

import { useRef, useState } from "react"
import type { Route } from "next"
import Link from "next/link"
import { FileSpreadsheet, LoaderCircle, Upload } from "lucide-react"
import { FieldHelp } from "@/components/forms/field-label"
import { Button } from "@/components/ui/button"
import { RadioGroup } from "@/components/ui/radio-group"
import { cn } from "@/libs/cn"
import {
  ImportFileError,
  type SheetCells,
  readFile,
  validateFile
} from "../read-file"
import { IMPORT_TARGETS } from "../targets"
import type { ImportTarget } from "../types"
import { RadioCard } from "./radio-card"

const TARGET_HINTS: Record<ImportTarget, string> = {
  transactions: "Entradas y salidas",
  recurring_expenses: "Pagos que se repiten cada mes o cada año",
  debt_entries:
    "Pagos y ajustes de tus tarjetas, préstamos y cuentas por cobrar",
  goal_contributions: "Aportes y retiros de tus metas de ahorro"
}

/** Destinos que necesitan algo creado antes, con su mensaje */
const TARGET_REQUIREMENTS: Partial<Record<ImportTarget, string>> = {
  debt_entries: "Primero crea una deuda",
  goal_contributions: "Primero crea una meta"
}

interface FileStepProps {
  target: ImportTarget
  /** Destinos deshabilitados: sin deudas o metas activas */
  unavailable: ImportTarget[]
  onTargetChange: (target: ImportTarget) => void
  onLoaded: (name: string, sheets: SheetCells[]) => void
}

// Paso 1: destino, zona de arrastre y selector. El archivo se lee en el
// navegador y no se envía al servidor.
export function FileStep({
  target,
  unavailable,
  onTargetChange,
  onLoaded
}: FileStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file || reading) return
    setError(null)

    try {
      validateFile(file)
      setReading(true)
      const { sheets } = await readFile(file)
      onLoaded(file.name, sheets)
    } catch (caught) {
      setError(
        caught instanceof ImportFileError
          ? caught.message
          : "No pudimos leer el archivo. Intenta de nuevo"
      )
    } finally {
      setReading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-0.5">
        <p
          id="import-target"
          className="text-sm font-medium"
        >
          ¿Qué vas a importar?
        </p>
        <FieldHelp
          help="import.target"
          label="Qué vas a importar"
        />
      </div>
      <RadioGroup
        aria-labelledby="import-target"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        value={target}
        onValueChange={(value) => onTargetChange(value as ImportTarget)}
      >
        {(Object.keys(IMPORT_TARGETS) as ImportTarget[]).map((value) => {
          const disabled = unavailable.includes(value)
          const requirement = TARGET_REQUIREMENTS[value]
          const id = `import-target-${value}`

          return (
            <RadioCard
              key={value}
              id={id}
              value={value}
              disabled={disabled}
              label={IMPORT_TARGETS[value].label}
              hint={
                disabled && requirement ? (
                  <Link
                    id={`${id}-hint`}
                    href={IMPORT_TARGETS[value].href as Route}
                    className="relative z-10 inline-flex min-h-11 w-fit items-center rounded-md font-medium underline decoration-ring decoration-2 underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {requirement}
                  </Link>
                ) : (
                  <span
                    id={`${id}-hint`}
                    className="text-muted-foreground"
                  >
                    {TARGET_HINTS[value]}
                  </span>
                )
              }
            />
          )
        })}
      </RadioGroup>
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-3xl bg-subtle p-10 text-center transition-colors duration-150 motion-reduce:transition-none",
          dragging &&
            "bg-primary/10 outline-2 -outline-offset-2 outline-primary"
        )}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void handleFile(event.dataTransfer.files[0])
        }}
      >
        {reading ? (
          <>
            <LoaderCircle
              aria-hidden="true"
              className="size-8 animate-spin text-muted-foreground motion-reduce:animate-none"
            />
            <p className="text-sm text-muted-foreground">Leyendo archivo…</p>
          </>
        ) : (
          <>
            <FileSpreadsheet
              aria-hidden="true"
              className="size-8 text-muted-foreground"
            />
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-center gap-0.5">
                <p className="font-medium">Arrastra tu archivo aquí</p>
                <FieldHelp
                  help="import.file"
                  label="Archivo"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Excel (.xlsx) o CSV, de hasta 5 MB. Se lee en tu navegador: el
                archivo no sale de tu equipo.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              <Upload />
              Elegir archivo
            </Button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          className="sr-only"
          tabIndex={-1}
          aria-label="Archivo a importar"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </div>
      {error && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  )
}
