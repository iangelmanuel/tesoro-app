// Props compartidas de Recharts para que todas las gráficas se vean igual.
// Se esparcen en cada componente: <CartesianGrid {...GRID_PROPS} />.
// Los colores no van aquí: ChartContainer pinta grilla, ticks y cursor con
// tokens, y cada serie usa var(--color-<clave>).

/** Grilla solo horizontal, punteada y tenue */
export const GRID_PROPS = {
  vertical: false,
  strokeDasharray: "3 4"
} as const

/** Ejes sin línea ni marcas; los ticks en --muted (ChartContainer) */
export const AXIS_PROPS = {
  axisLine: false,
  tickLine: false,
  tickMargin: 8,
  fontSize: 12
} as const

/** Entrada corta. "auto" la apaga con prefers-reduced-motion (Recharts 3) */
export const ANIMATION_PROPS = {
  isAnimationActive: "auto",
  animationDuration: 400,
  animationEasing: "ease-out"
} as const

/** Barras con radio superior de 4 px y sin borde */
export const BAR_PROPS = {
  radius: [4, 4, 0, 0] as [number, number, number, number],
  maxBarSize: 32,
  ...ANIMATION_PROPS
} as const

/** Barras horizontales: el radio va en el extremo derecho */
export const HORIZONTAL_BAR_PROPS = {
  radius: [0, 4, 4, 0] as [number, number, number, number],
  maxBarSize: 20,
  ...ANIMATION_PROPS
} as const

/** Líneas suaves de 2 px, sin puntos salvo el activo en hover */
export const LINE_PROPS = {
  type: "monotone",
  strokeWidth: 2,
  dot: false,
  activeDot: { r: 4, strokeWidth: 2 },
  ...ANIMATION_PROPS
} as const

/** Separación de 2 px entre barras del mismo grupo */
export const BAR_CHART_PROPS = {
  barGap: 2,
  barCategoryGap: "24%"
} as const
