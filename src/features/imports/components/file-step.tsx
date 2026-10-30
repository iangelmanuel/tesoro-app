"use client"

import { useRef, useState } from "react"
import { FileSpreadsheet, LoaderCircle, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/libs/utils"
import {
  ImportFileError,
  type SheetCells,
  readFile,
  validateFile
} from "../read-file"

interface FileStepProps {
  onLoaded: (name: string, sheets: SheetCells[]) => void
}

// Paso 1: zona de arrastre y selector. El archivo se lee en el navegador y
// no se envía al servidor.
export function FileStep({ onLoaded }: FileStepProps) {
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
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center transition-colors",
          dragging && "border-primary bg-primary/5"
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
            <LoaderCircle className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Leyendo archivo…</p>
          </>
        ) : (
          <>
            <FileSpreadsheet className="size-8 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <p className="font-medium">Arrastra tu archivo aquí</p>
              <p className="text-sm text-muted-foreground">
                Excel (.xlsx) o CSV, de hasta 5 MB. Se lee en tu navegador: el
                archivo no sale de tu equipo.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              <Upload data-icon="inline-start" />
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
