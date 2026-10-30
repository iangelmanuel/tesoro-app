import { FILE_EXTENSIONS, MAX_FILE_BYTES } from "./constants"

export interface SheetCells {
  name: string
  /** Filas y columnas tal como vienen; las celdas vacías son null */
  cells: unknown[][]
}

export interface ReadFileResult {
  sheets: SheetCells[]
}

type FileExtension = (typeof FILE_EXTENSIONS)[number]

/** Error con un mensaje listo para mostrar al usuario */
export class ImportFileError extends Error {
  name = "ImportFileError"
}

function fileExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? ""
}

function isFileExtension(value: string): value is FileExtension {
  return (FILE_EXTENSIONS as readonly string[]).includes(value)
}

/**
 * Valida extensión y tamaño antes de leer. Lanza `ImportFileError` con el
 * motivo. Se exporta para validar al soltar el archivo sin leerlo.
 */
export function validateFile(file: File): FileExtension {
  const extension = fileExtension(file.name)

  if (!isFileExtension(extension)) {
    throw new ImportFileError("Solo se aceptan archivos .xlsx o .csv")
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new ImportFileError("El archivo supera el máximo de 5 MB")
  }

  if (file.size === 0) {
    throw new ImportFileError("El archivo está vacío")
  }

  return extension
}

async function readXlsx(file: File): Promise<SheetCells[]> {
  const { default: readXlsxFile } = await import("read-excel-file/browser")
  const sheets = await readXlsxFile(file)

  return sheets.map(({ sheet, data }) => ({
    name: sheet,
    cells: data as unknown[][]
  }))
}

/** El CSV va como una sola hoja; papaparse detecta el delimitador */
async function readCsv(file: File): Promise<SheetCells[]> {
  const { default: Papa } = await import("papaparse")

  const cells = await new Promise<unknown[][]>((resolve, reject) => {
    Papa.parse<string[]>(file, {
      delimiter: "",
      skipEmptyLines: false,
      complete: (results) => resolve(results.data),
      error: (error) => reject(error)
    })
  })

  return [
    {
      name: file.name,
      cells: cells.map((row) => row.map((cell) => (cell === "" ? null : cell)))
    }
  ]
}

/**
 * Lee el archivo en el navegador. Las librerías se cargan con `import()`
 * para que no entren en el bundle de otras páginas.
 */
export async function readFile(file: File): Promise<ReadFileResult> {
  const extension = validateFile(file)

  let sheets: SheetCells[]

  try {
    sheets = extension === "xlsx" ? await readXlsx(file) : await readCsv(file)
  } catch {
    throw new ImportFileError(
      "No pudimos leer el archivo. Revisa que no esté dañado o protegido"
    )
  }

  if (sheets.every((sheet) => sheet.cells.length === 0)) {
    throw new ImportFileError("El archivo no tiene datos")
  }

  return { sheets }
}
