import {
  CATEGORY_CHART_COLORS,
  type CategoryColorKey
} from "@/features/categories/constants"
import { groupTopWithOthers } from "./metrics"
import type { CategoryTotal } from "./queries"

// Datos listos para las gráficas de categorías. Se preparan en el servidor y
// los client components solo los dibujan.

export const OTHERS_KEY = "others"
export const OTHERS_COLOR = "var(--muted-foreground)"

/** Porciones de la dona: top 6 + "Otras" */
export const DONUT_SLICES = 6

/** Barras del top de categorías */
export const TOP_CATEGORIES = 5

export interface CategorySlice {
  key: string
  name: string
  color: string
  total: number
}

/** Color CSS de una categoría; si la clave no existe, el neutro */
export function categoryChartColor(color: string) {
  return (
    CATEGORY_CHART_COLORS[color as CategoryColorKey] ??
    CATEGORY_CHART_COLORS.slate
  )
}

function toSlice(row: CategoryTotal): CategorySlice {
  return {
    key: row.categoryId,
    name: row.name,
    color: categoryChartColor(row.color),
    total: row.total
  }
}

/** Top N categorías más una porción "Otras" con la suma del resto */
export function buildCategorySlices(
  totals: CategoryTotal[],
  limit = DONUT_SLICES
): CategorySlice[] {
  const { top, others } = groupTopWithOthers(totals, limit)
  const slices = top.map(toSlice)

  if (others) {
    slices.push({
      key: OTHERS_KEY,
      name: "Otras",
      color: OTHERS_COLOR,
      total: others.total
    })
  }
  return slices
}

/** Las N categorías con mayor total, sin agrupar el resto */
export function buildTopCategories(
  totals: CategoryTotal[],
  limit = TOP_CATEGORIES
): CategorySlice[] {
  return totals.slice(0, limit).map(toSlice)
}
