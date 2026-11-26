// Medidas que comparten las gráficas y su hueco en `…-lazy.tsx`. Viven
// aparte para que el hueco no importe el módulo de Recharts (SPEC 56b)

/** Alto de cada barra de Top categorías, con su etiqueta */
const TOP_CATEGORY_ROW_HEIGHT = 48

/** Alto de Top categorías según cuántas barras lleva */
export function topCategoriesChartHeight(rows: number) {
  return rows * TOP_CATEGORY_ROW_HEIGHT + 8
}

/** Tamaño por defecto de la dona de categorías */
export const DONUT_CLASS = "mx-auto aspect-square max-h-64 w-full"
