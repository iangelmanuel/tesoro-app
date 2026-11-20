// Atajos de teclado del dashboard (SPEC 51 §5). Las letras de "G + letra"
// viven en cada ítem de SITE.navigation (campo `shortcut`), no aquí

export const SHORTCUTS = {
  commandPalette: { keys: ["mod", "k"], label: "Buscar y ejecutar" },
  newTransaction: { keys: ["n"], label: "Nuevo movimiento" },
  newTransfer: { keys: ["t"], label: "Traspaso" },
  help: { keys: ["?"], label: "Atajos de teclado" },
  goPrefix: "g"
} as const

/** Tiempo máximo entre la G y la letra de destino */
export const GO_SEQUENCE_TIMEOUT_MS = 1000

/** Preferencia por navegador: "on" | "off" (por defecto "on") */
export const SHORTCUTS_COOKIE = "tesoro-shortcuts"

export function parseShortcutsCookie(value: string | undefined) {
  return value !== "off"
}
