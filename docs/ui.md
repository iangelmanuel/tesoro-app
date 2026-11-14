# UI de Tesoro

Guía de la interfaz del dashboard: tema, tokens, componentes propios, dónde
vive cada pieza y cómo se trabaja el diseño con Impeccable. Nace de
[SPEC 14](../specs/14-ui-polish-with-impeccable.md); SPEC 14b la aplica al
resto de pantallas.

El contexto de producto (usuarios, voz, principios) está en
[`PRODUCT.md`](../PRODUCT.md). Esta guía cubre el **cómo se ve**.

## Principios

- **Oscuro por defecto, claro disponible.** El diseño se piensa sobre negro;
  el toggle del aside cambia a claro y lo recuerda (`next-themes`). Los dos
  temas comparten lenguaje: tarjetas sin borde, mismo matiz neutro (264),
  niveles escalonados y elevación sutil (sombra en claro, brillo superior en
  oscuro).
- **Un solo acento por espacio.** Neutro fuera de los espacios, emerald en
  Personal y naranja en Empresa. Negros y grises son los mismos en los dos.
- **Tarjetas sin borde.** La separación la da el contraste entre fondo y
  superficie (en claro, más la sombra en capas de `--surface-shadow`). Radios grandes en
  tarjetas y pill en botones, tabs, selects y filtros.
- **Densidad media y un solo título por pantalla.** El título (o el saludo
  en el Resumen) lo pone el header; las páginas no repiten su `<h1>`.
- **Color por significado.** Ingresos, gastos y balance tienen tokens
  propios; los estados (bien, cuidado, mal) usan los tokens de HeroUI. Un
  aumento de gastos se pinta como malo aunque el número suba.
- **Movimiento corto.** ≤ 200 ms en la UI y ≤ 400 ms en gráficas, y nada con
  `prefers-reduced-motion: reduce`.

## Tema y tokens

Todo vive en `src/styles/globals.css`, con los nombres de HeroUI v3.

| Token                                           | Qué es                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `--background`                                  | Fondo de la página. Oscuro ≈ `#07080a`, claro `#f1f2f5`                |
| `--surface`                                     | Tarjetas. Oscuro ≈ `#16171a`, claro blanco                             |
| `--surface-secondary`, `--surface-tertiary`     | Superficies escalonadas dentro de una tarjeta                          |
| `--overlay`                                     | Diálogos, menús, popovers y tooltips                                   |
| `--default`                                     | Ítem activo del aside, hover de filas, chips neutros                   |
| `--muted`                                       | Texto atenuado, etiquetas, ticks de gráficas                           |
| `--border`, `--separator`                       | Grilla de gráficas y divisores muy sutiles                             |
| `--surface-shadow`, `--overlay-shadow`          | Elevación: sombra en claro; brillo superior de 1 px y sombra en oscuro |
| `--accent`, `--accent-foreground`               | Primario. Lo cambia el espacio (ver abajo)                             |
| `--success`, `--warning`, `--danger` y `*-soft` | Estados. Los `*-soft` con su `*-soft-foreground` en chips              |
| `--brand`                                       | Emerald del logo; igual en todos los temas                             |
| `--income`, `--expense`, `--balance`            | Dinero: texto ≥ 4.5:1 y series de gráfica                              |
| `--category-*`                                  | Los 12 colores que el usuario elige por categoría                      |
| `--chart-1…5`                                   | Serie neutra (score, comparaciones sin significado)                    |
| `--field-radius`                                | Radio de inputs y selects (20 px, pill a su altura)                    |
| `--field-background`, `--field-hover`           | Relleno suave de los campos; sin borde (`--field-border` transparente) |

- **Primario por espacio:** `WorkspaceThemeRoot` + `getWorkspaceTheme()`
  ponen `data-workspace` en el contenedor del dashboard y `globals.css`
  cambia `--accent` con `:has()`. Nunca se pasa un color por props.
- **Botones de color con texto blanco:** el relleno de `--accent` es el tono
  700 (emerald-700 en Personal, orange-700 en Empresa) en claro y oscuro, el
  primero que da AA con blanco. En oscuro, el foco y el texto suave usan
  `--accent-bright` (más claro), porque el 700 no contrasta con el fondo. El
  botón `danger` en oscuro usa red-600 con texto blanco.
- **Estados en chips y barras:** `src/components/dashboard/tone.ts`
  (`TONE_BADGE_CLASSES`, `TONE_BAR_CLASSES`, `TONE_TEXT_CLASSES`). No se usa
  la paleta cruda de Tailwind (`amber-*`, `rose-*`…).
- **Tipografía:** Inter vía `next/font/google` en `app/layout.tsx`
  (`--font-sans`). Montos, KPIs, tablas y ejes con `tabular-nums`.

## Contraste

Pares verificados con los tokens de `src/styles/globals.css` (WCAG 2.x,
OKLCH → sRGB). Mínimos: 4.5:1 texto, 3:1 gráficos y foco.

| Par                                       | Claro | Oscuro |
| ----------------------------------------- | ----- | ------ |
| `foreground` / `background`               | 15.87 | 19.36  |
| `muted` / `surface`                       | 6.00  | 7.06   |
| `muted` / `default`                       | 4.88  | 5.69   |
| `income` / `surface`                      | 5.56  | 4.97   |
| `expense` / `surface`                     | 5.35  | 5.00   |
| `balance` / `surface`                     | 8.16  | 5.82   |
| `income` / `background`                   | 4.98  | 5.74   |
| `expense` / `background`                  | 4.79  | 5.77   |
| `danger` / `background`                   | 4.88  | 6.99   |
| `accent-foreground` / `accent` Personal   | 5.22  | 5.22   |
| `accent-foreground` / `accent` Empresa    | 5.08  | 5.08   |
| `accent-foreground` / `accent-hover` P.   | 6.84  | 6.84   |
| `accent-foreground` / `accent-hover` E.   | 6.68  | 6.68   |
| `focus` / `background` Personal           | 4.81  | 8.71   |
| `focus` / `background` Empresa            | 4.68  | 8.28   |
| `focus` / `background` neutro             | 15.87 | 19.36  |
| `muted` / `background` (títulos aside)    | 5.37  | 8.15   |
| botón `danger` (blanco / relleno)         | 4.88  | 4.83   |
| `text-brand` / `background`               | 5.06  | 11.74  |
| `accent-soft-fg` / `accent-soft` Personal | 7.11  | 9.31   |
| `accent-soft-fg` / `accent-soft` Empresa  | 6.96  | 8.96   |
| `muted` / `field-background`              | 5.22  | 5.11   |
| `foreground` / `field-background`         | 15.41 | 12.15  |
| `--chart-*` / `surface` (mínimo)          | 3.36  | 3.68   |

Las series de dinero (`--income`, `--expense`, `--balance`) también pasan el
validador de paletas del skill `dataviz` en claro y oscuro: banda de
luminosidad, croma, ΔE ≥ 10 entre todos los pares con protanopía y
deuteranopía, y ΔE ≥ 21 con visión normal. Entre sí casi no difieren en
luminancia, así que las gráficas nunca dependen solo del color: llevan
leyenda, orden fijo de series y el monto en el tooltip y en la tabla
`sr-only`.

### Auditoría del modo claro (SPEC 23, paso 1)

Revisión de código (sin navegador) de `globals.css`, `surface.ts`,
`StatCard`, `ChartCard` y su uso en Resumen, Movimientos, Cuentas y
Presupuestos. El detector de Impeccable no halló reglas rotas, pero solo
corrió por regex. Se resuelve en los pasos 2 y 3 del spec.

| Prioridad | Hallazgo                                                                                                                                                                                                                                          | Dónde                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1        | La separación tarjeta/fondo es débil: `--background` 0.975 vs `--surface` 1 (ΔL 0.025). La sombra viene de HeroUI (`#0000000a/0f`, negro puro, 3 capas finas) y no da elevación ambiental; el claro se ve plano.                                  | `globals.css` (`--surface-shadow` sin definir), `surface.ts`, `Card`                                                                                                                               |
| P1        | Cada superficie define su propia sombra (`shadow-(--surface-shadow)`, `shadow-lg`, `shadow-xl shadow-black/5`, `shadow-overlay`). Sin una escala de elevación, las sombras se acumulan en tarjetas anidadas.                                      | `surface.ts`, `transactions-table.tsx` (overlay de arrastre), `chart-tooltip.tsx`                                                                                                                  |
| P2        | Paleta cruda de Tailwind (`emerald-50`, `amber-100`, `rose-100`…) en avisos y chips, contra la regla "estados con `tone.ts`". Son bloques de color de relleno que ensucian el claro y no cambian con el espacio.                                  | `features/debts/components/{debt-card,receivable-card}.tsx`, `features/goals/components/{goal-card,goal-summary}.tsx`, `categories/constants.ts`, `app/dashboard/business/[id]/cash-flow/page.tsx` |
| P2        | `--chart-1…5` en claro son slate-600…900: casi sin diferencia de luminosidad entre 3, 4 y 5; las series neutras no se distinguen.                                                                                                                 | `globals.css`                                                                                                                                                                                      |
| P2        | Grilla y divisores: `--border` 0.912 y `--separator` 0.93 sobre blanco dan ≈ 1.2:1. Es decorativo, pero la grilla se pierde; el spec pide 3:1 para marcas gráficas.                                                                               | `globals.css`, `chart-style.ts`                                                                                                                                                                    |
| P2        | El primario de Personal/Empresa en claro (`accent`/`background` 3.41 y 3.34) solo cumple foco. Como texto o enlace no llega a 4.5:1; hay que confirmar que `accent-soft-foreground` (mezcla 70/30 con el foreground) lo cubre donde se usa texto. | `globals.css`, usos de `text-accent`                                                                                                                                                               |
| P3        | Landing (`hero-visual`, `score-visual`) usa `border` y `shadow-xl shadow-black/5`. Fuera de alcance de este spec.                                                                                                                                 | `features/landing/components/`                                                                                                                                                                     |

Resueltos en el SPEC 23: los dos P1 (fondo `#f1f2f5` y escala de sombras
`--surface-shadow` / `--overlay-shadow`, aplicada a `SURFACE_NOTE`, estados
vacíos, cuentas archivadas y el overlay de arrastre) y las series de
gráficas. La grilla se mantiene decorativa (≈ 1.5:1). Pendientes: los colores
crudos de Tailwind (P2) y la landing (P3).

Sin P0. Lo que ya funciona y se conserva: tarjetas sin borde, tokens con
nombres de HeroUI, `Amount` y `tabular-nums` en cifras, leyendas y tablas
`sr-only` en gráficas, estados por `tone.ts` en `StatCard`.

### Auditoría del modo oscuro (SPEC 23, paso 10)

Revisión de código y de los tokens de `.dark` en `globals.css` (sin navegador),
con razones de contraste calculadas sobre los valores actuales. Todos los
pares de texto pasan AA; los hallazgos son de profundidad y elevación. Se
resuelven en los pasos 11 y 12 del spec.

| Prioridad | Hallazgo                                                                                                                                                                                                                                                                          | Dónde                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| P1        | Sin elevación: `--surface-shadow` y `--overlay-shadow` oscuros son `transparent` / `1px #ffffff4d`. Menús, popovers y tooltips sobre una tarjeta quedan a 1.05:1 (`overlay` 0.23 vs `surface` 0.21) y solo los diálogos se apoyan en el fondo atenuado. El claro ya tiene sombra. | `globals.css` (`.dark`), `chart-tooltip.tsx`, `Popover` |
| P1        | Poca separación fondo/tarjeta: 1.12:1 (`background` 0.145 vs `surface` 0.21), sin brillo ni sombra que ayude. Contra el claro, que lleva sombra en dos capas, el oscuro se ve plano.                                                                                              | `globals.css`, `Card`, `surface.ts`                     |
| P2        | Matiz inconsistente: el fondo es neutro puro (croma 0) y las superficies llevan tinte violeta (croma 0.006, matiz 286). Un gris "sucio" entre ambos; para un aspecto más profundo (OLED) conviene unificarlos.                                                                    | `globals.css` (`--background` vs `--surface*`)          |
| P2        | Niveles anidados débiles: `surface-secondary` 1.09:1 y `surface-tertiary` 1.19:1 sobre `surface`; filas con hover, chips y campos dentro de tarjetas casi no se distinguen. `--separator` da 1.11:1.                                                                              | `globals.css`, `CARD_ROW`, `Table`                      |
| P2        | Primario muy vivo sobre negro: emerald-500 y orange-500 dan 8.03:1 y 6.84:1 contra el fondo; en botones y rellenos grandes vibran más que en el claro. Se puede bajar croma/luminosidad conservando AA con el texto oscuro (7.19 y 6.13).                                         | `globals.css` (`.dark :has(> [data-workspace])`)        |
| P2        | 24 usos de `dark:` con paleta cruda de Tailwind (`dark:bg-emerald-950`, `dark:text-amber-300`…) en avisos y chips: no siguen los tokens nuevos. Es el mismo P2 de los colores crudos del claro.                                                                                   | `features/{debts,goals,categories}`, cash-flow          |
| P3        | Campos: `--field-background` 0.30 sobre tarjeta da 1.30:1; funciona por relleno, pero más claro que el modal (0.23) por 1.24:1. Revisar tras cambiar superficies.                                                                                                                 | `globals.css`                                           |

Resueltos en el SPEC 23 (pasos 11 y 12): los dos P1 (fondo `#07080a`,
superficies de un solo matiz y niveles más separados, `--surface-shadow` y
`--overlay-shadow` con brillo superior de 1 px y sombra difusa), el matiz
inconsistente, los niveles anidados, el primario menos saturado
(emerald `oklch(70% .15 162.5)`, naranja `oklch(72% .18 48)`) y los campos
(0.32). Pendiente: los `dark:` con paleta cruda (P2), compartido con el claro.
`SITE.seo.themeColor` se alineó con los fondos nuevos.

Sin P0. Lo que ya funciona y se conserva: AA en todo el texto (`foreground`
18.96:1, `muted` 6.74:1 sobre la tarjeta, dinero ≥ 5.03:1), serie de gráficas
con luminosidad escalonada (mínimo 3.72:1), primario con texto blanco sobre el tono 700 (≥ 5.08:1)
y tarjetas sin borde.

## Componentes propios

Todos en `src/components/`. HeroUI se importa directo de `@heroui/react`;
estos solo agregan lo que HeroUI no trae.

### Shell del dashboard (`src/components/dashboard/`)

| Pieza                                                                      | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app-sidebar.tsx`, `sidebar/`                                              | Aside: logo → tabs Personal/Empresa → navegación por grupos y ancho ajustable (SPEC 31); abajo Ayuda (issues de GitHub), tema y usuario                                                                                                                                                                                                                                                                                      |
| `dashboard-title.tsx`                                                      | Único `<h1>` de la página, en el header. Saludo según la hora de Bogotá en el Resumen de Personal                                                                                                                                                                                                                                                                                                                            |
| `quick-actions.tsx`, `quick-actions-menu.tsx`, `quick-actions-context.tsx` | Accesos del header: "Registrar movimiento" (con tabs de pago, SPEC 25) + "Más" (aporte, pago, importar, Categorías y Verificar) en Personal; "Registrar operación" + "Más" (Categorías y Verificar) en Empresa                                                                                                                                                                                                               |
| `stat-card.tsx`                                                            | KPI: etiqueta, valor y badge de variación con color por significado (`trend`); `<dl>` accesible                                                                                                                                                                                                                                                                                                                              |
| `card-heading.tsx`                                                         | Cabecera de tarjeta: `<h2>`, ayuda (i) opcional y enlace discreto con chevron                                                                                                                                                                                                                                                                                                                                                |
| `help-hint.tsx`                                                            | Ícono (i) con `Popover`; los textos viven en `src/config/help.ts` (`HELP`)                                                                                                                                                                                                                                                                                                                                                   |
| `empty-state.tsx`                                                          | `EmptyState` (página): ícono, qué falta, qué hacer y la acción. `CardEmpty` (dentro de una tarjeta)                                                                                                                                                                                                                                                                                                                          |
| `card-skeleton.tsx`                                                        | Placeholder con el mismo contenedor de `Card`; todo bloque que carga usa este, no un `Skeleton` suelto                                                                                                                                                                                                                                                                                                                       |
| `tone.ts`                                                                  | Clases de estado (chips, barras, texto) desde tokens                                                                                                                                                                                                                                                                                                                                                                         |
| `month-nav.tsx`                                                            | `MonthNav` (SPEC 37): `‹ mes ›` que escribe `?month=YYYY-MM` con `router.replace` sin mover el scroll. `prev` / `next` en `null` deshabilitan la flecha (límites). Flechas `CONTROL_BUTTON`, 44 px en móvil. Lo usan Presupuestos (`BudgetMonthNav`, sin límites) , Próximos pagos de Gastos fijos y Próximos ingresos de Ingresos fijos (SPEC 38), del más antiguo al mes actual                                            |
| `row-actions.tsx`, `delete-dialog.tsx`, `scroll-table.tsx`                 | Acciones de fila (menú en escritorio, botones en móvil), confirmación de borrado controlada y contenedor de tabla con scroll horizontal y columna de acciones fija (SPEC 20)                                                                                                                                                                                                                                                 |
| `surface.ts`                                                               | Clases de superficie sin borde: `SURFACE_LIST`/`SURFACE_ROW` (lista sobre el fondo), `CARD_LIST`/`CARD_ROW` (lista dentro de una `Card`), `SURFACE_ITEM` (tarjeta de una grilla) y `SURFACE_NOTE`. Nunca `rounded-xl border` ni `border-dashed`. También `CONTROL_SURFACE` y `CONTROL_BUTTON` (controles de barra, ver Móvil). `SURFACE_ITEM_CLICKABLE`, `CARD_LINK` y `CARD_OVER_LINK`: tarjeta clicable completa (SPEC 25) |

### Gráficas (`src/components/charts/`)

| Pieza                 | Qué hace                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `chart-card.tsx`      | `ChartCard`: título, leyenda y selector a la derecha, cifra principal debajo y la gráfica    |
| `chart-container.tsx` | Tokens en grilla, ticks y cursor; foco visible en la superficie; `--color-<serie>` por serie |
| `chart-style.ts`      | Props compartidas: `GRID_PROPS`, `AXIS_PROPS`, `BAR_PROPS`, `LINE_PROPS`, `ANIMATION_PROPS`… |
| `chart-format.ts`     | Montos abreviados en es-CO para ejes: `$ 1,2 M`, `$ 350 k`                                   |
| `chart-tooltip.tsx`   | Tooltip sobre `--overlay` con nombre de serie y monto completo (`valueFormatter`)            |
| `chart-legend.tsx`    | Leyenda dentro de Recharts (punto + texto), para gráficas sin `ChartCard`                    |

Reglas de toda gráfica:

- grilla solo horizontal y punteada; ejes sin línea; barras con radio
  superior de 4 px; líneas suaves de 2 px sin puntos salvo en hover;
- colores desde tokens; dinero con `--income`, `--expense`, `--balance` en
  ese orden fijo;
- `title` en el chart de Recharts (nombre de la superficie enfocable) y la
  tabla `sr-only` (`ChartDataTable`) con los datos;
- entrada de 400 ms con `isAnimationActive: "auto"`, que Recharts apaga con
  reduced motion;
- las funciones que llaman componentes de servidor no van en archivos
  `"use client"` (por eso `incomeExpenseLegend` vive en
  `src/features/reports/series.ts`).

### Fecha, hora y orden en Movimientos (SPEC 19)

| Pieza                                             | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `forms/time-picker-field.tsx` (`TimePickerField`) | Hermano de `DatePickerField` sobre el `TimeField` de HeroUI. Trabaja con `HH:MM` o `""` (sin hora), etiqueta "Hora (opcional)" y botón de 44 px para borrarla                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `libs/format.ts` (`formatTime`)                   | `2:30 p. m.` en es-CO con espacio duro. Se muestra solo si el evento tiene hora                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `transactions-table.tsx` (`ReorderCell`)          | Columna angosta a la izquierda de Fecha con solo el asa de arrastre (`GripVertical`, tenue `text-muted/50`; 44 px de alto en táctil). Cada fila es un `useSortable` de dnd-kit (`@dnd-kit/react`) con el asa como `handleRef`, dentro de un `DragDropProvider`; arrastra con mouse, dedo (manteniendo presionada el asa) y teclado. Una `DragOverlay` (tarjeta `bg-surface` con `ring-accent`) sigue al puntero y la fila original queda como hueco (`bg-accent/15 opacity-50`); las filas del mismo día se resaltan (`bg-accent/10`) y el resto baja a `opacity-40`. El modo de retroalimentación por defecto de dnd-kit no se usa con `<tr>`. Sin flechas ni otros botones de orden. Solo existe si hay permiso de escritura y no hay búsqueda; un día de una sola fila no muestra asa |
| `verify-movements-dialog.tsx`, `verify-row.tsx`   | Modal "Verificar" de solo lectura (pantalla completa en móvil). Fila de dos líneas con flecha `--income` / `--expense` / neutra y texto accesible                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Reglas:

- El campo de hora va en la misma fila que la fecha desde 768 px (`md:`) y
  debajo en móvil; el monto ocupa su propia fila.
- La flecha de Verificar nunca es el único portador del significado: cada fila
  lleva texto `sr-only` ("Ingreso", "Gasto", "Traspaso", "Ajuste"…) y el monto
  con signo.
- El orden manual se mueve al instante con `useOptimistic` y vuelve a su lugar
  con un toast si la action falla.

### Conciliar cuenta (SPEC 21)

| Pieza                                      | Qué hace                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accounts/components/reconcile-dialog.tsx` | `ReconcileDialog`: saldo real, `DatePickerField` (no futura), panel con saldo calculado y diferencia (`TONE_TEXT_CLASSES`: `success` si > 0, `danger` si < 0, neutro en 0) y `HelpHint` `reconciliation`. Modal centrado en escritorio y hoja inferior (`placement="bottom"`) en móvil |
| `accounts/components/account-card.tsx`     | Botón **Conciliar** (`Scale`) y, solo en `wallet` / `bank` con saldo < 0, un aviso `TONE_BADGE_CLASSES.danger` con su propio botón **Conciliar**                                                                                                                                       |

Reglas:

- Los montos del diálogo llevan centavos (`formatCurrency(amount, currency, 2)`),
  porque la diferencia importa al centavo; el resto de la app los oculta en COP.
- "La cuenta ya cuadra" y "Probablemente faltan movimientos por registrar" son
  `role="status"`; el segundo no bloquea el botón. El panel de cifras es
  `aria-live="polite"`.
- Botones del diálogo y del aviso de 44 px en móvil (`max-md:h-11`).

### Ocultar cifras y aside de Cuenta (SPEC 22)

| Pieza                                          | Qué hace                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dashboard/hide-amounts-context.tsx`           | `HideAmountsProvider` (estado inicial del servidor + `useOptimistic`), `useHideAmounts()` → `{ hidden, toggle }` y `useFormatAmount()` → `money()` para SVG, tooltips y tablas |
| `dashboard/amount.tsx`                         | `<Amount value currency />`: único punto de formato de saldos y totales. Oculto: `***` con `role="img"`, `aria-label="Monto oculto"` y el ancho del monto reservado            |
| `dashboard/hide-amounts-toggle.tsx`            | Ojo del header (`Eye` / `EyeOff`, `aria-pressed`, 44 px en móvil)                                                                                                              |
| `charts/chart-format.ts` → `formatChartAmount` | Eje abreviado o máscara                                                                                                                                                        |
| `account/components/account-nav.tsx`           | Aside interno de Cuenta: lista vertical en escritorio, horizontal con scroll en móvil, `aria-current="page"`, 44 px                                                            |

Reglas:

- Todo saldo o total nuevo se muestra con `<Amount />` (o `money()` si es
  texto de SVG o `sr-only`), nunca con `formatCurrency` directo. Las filas de
  Movimientos y los formularios sí usan el valor real.
- El layout lee `profiles.hide_amounts` dentro de un `Suspense`; mientras
  carga muestra el header y un `<main>` vacío, sin números.

### Landing (SPEC 24)

- **Sin eyebrows ni íconos en cuadros:** `SectionHeading` solo lleva título y
  descripción. Nada de grillas de tarjetas iguales, halos ni degradados de
  relleno (`DESIGN.md`, reglas "Título Solo" y "Sin Halo").
- **Videos** (`demo-player.tsx`, `feature-clip.tsx`): contenedor claro en los
  dos temas (el video trae su escritorio claro), `preload="none"` y póster. El
  demo nunca hace autoplay; los clips se reproducen en loop silenciado solo
  mientras están en pantalla (`IntersectionObserver`) y con reduced motion o
  ahorro de datos se quedan en el póster sin descargar el video.
- **Recorrido de funciones** (`feature-tour.tsx`): pestañas con
  `role="tab"`, flechas, Inicio y Fin, y un clip grande de al menos 560 px.
- **Score** (`score-section.tsx`, `score-visual.tsx`, `score-bands.ts`):
  colores de estado desde `tone.ts`; la barra de factores usa un solo tono de
  `--income` con mezclas de opacidad.
- **Escena 3D** (`hero-scene.tsx`): React Three Fiber sin `drei`, un
  `InstancedMesh` con los bloques del cofre, colores leídos de `--brand` e
  `--income` (oklch → sRGB con un canvas 2D) y releídos al cambiar el tema.
  `dpr` máximo 2, sin sombras, `frameloop` en "never" fuera de pantalla. El
  lienzo es más grande que su columna y se difumina con `mask-image`.
- **Header** (`site-header.tsx`, `site-header-shell.tsx`,
  `github-stars.tsx`): navegación en pastilla, GitHub con estrellas (servidor,
  cacheado), toggle de tema de 44 px y botones de sesión con flecha.

### Menú Más, selects con creación y tarjetas clicables (SPEC 25)

- **Menú Más** (`quick-actions-menu.tsx`): en todas las páginas de un
  espacio. Personal: Aporte a meta, Pago de deuda, Importar, **Categorías** y
  **Verificar movimientos**. Empresa: solo Categorías y Verificar. Los dos
  abren `CategoriesSheet` y `VerifyMovementsDialog` sobre la página actual,
  sin navegar, y no dependen de que haya movimientos. En el teléfono están al
  final de la hoja de acciones rápidas (`quick-sheet.tsx`), tras un
  separador. Ambos componentes son solo controlados (`open` /
  `onOpenChange`); no pintan botón propio.
- **Tabs de pago** (`transaction-dialog.tsx`): el diálogo que abre
  "Registrar movimiento" en Personal (y **Movimiento rápido** en el
  teléfono) tiene **Gasto · Ingreso · Traspaso · Deuda · Gasto fijo · Meta**
  (prop `paymentTabs`, SPEC 30). En Empresa: **Venta · Costo o gasto ·
  Traspaso**. Meta usa `GoalContributionPanel` (el formulario de
  `ContributionDialog`) y, sin metas activas, `PanelEmpty` con enlace a
  Metas. El tab activo se lleva a la vista con `scrollIntoView`. El tab
  Ingreso de Personal empieza con `IncomeSourceField` (select "Ingreso
  fijo", `src/features/recurring-incomes/components/`). Deuda (pagos y avances) usa
  `DebtPaymentPanel` (el formulario de `PaymentDialog`) y Gasto fijo elige la
  ocurrencia (`OccurrenceSelect`) y muestra el formulario de movimiento
  enlazado. No aparecen en Empresa, al editar ni al pagar una ocurrencia
  concreta. Con los tabs, el diálogo sube a `max-w-lg` y el selector se
  desplaza en horizontal en anchos chicos, sin barra visible. Aporte a meta
  sigue también en Más.
- **Modales anidados:** la entrada de HeroUI escala el contenedor desde
  1.05; `globals.css` pone `overflow-x: hidden` en `.modal__backdrop` para
  que esa animación no abra un scroll horizontal ni haga saltar el diálogo.
- **Selects con creación** (`src/components/forms/`): `CategorySelectField`
  y `AccountSelectField` terminan con **+ Crear categoría** / **+ Crear
  cuenta** (`CreateOption`). La opción abre `CategoryDialog` o `AccountDialog`
  encima del formulario (Modal anidado: Escape cierra solo el de arriba y el
  foco vuelve al select). Al guardar, la nueva queda elegida y el resto del
  formulario no se toca; mientras llega la lista refrescada, vive en el
  estado local del campo. La categoría hereda el tipo del formulario. Los
  formularios de categoría y cuenta detienen la propagación del `submit` para
  no disparar el formulario de abajo. Todo select de Categoría o Cuenta de un
  formulario usa estos campos; la importación suma la misma opción a sus
  selects de destino (además de "Crear «valor»", que crea al importar).
- **Tarjetas clicables** (deudas, Me deben y metas): patrón de enlace
  estirado. El `<li>` lleva `SURFACE_ITEM_CLICKABLE` (`relative`, hover
  `bg-surface-secondary` y anillo de foco cuando el botón está enfocado);
  el botón de detalle lleva `CARD_LINK` y `data-card-link`, y su `::after`
  cubre la tarjeta. El ⋮ y las acciones internas llevan `CARD_OVER_LINK`
  (`relative z-10`) para quedar encima. Un solo elemento abre el Sheet; Tab
  llega a la tarjeta y luego al ⋮. Sin cambio visual salvo hover y cursor.

### Tutoriales guiados (SPEC 27)

| Pieza                                           | Qué hace                                                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/config/tutorials.ts`                       | Claves (`TUTORIAL_SECTIONS`), nombre y ruta de cada sección, `getTutorialSection(pathname)` y los pasos (`TUTORIALS`)                             |
| `tutorials/components/tutorial-provider.tsx`    | `TutorialProvider` (progreso del servidor + `useOptimistic`), `markCompleted`, `reset`, `requestStart` ("Ver de nuevo")                           |
| `tutorials/use-tutorial.ts`                     | `useTutorial(section)` → `{ completed, start }`. Descarga el motor con `import()` una vez por sesión y cierra el recorrido al salir de la sección |
| `tutorials/engine/run-tour.ts`                  | Motor: filtra pasos por viewport y elementos visibles, textos en español, reduced motion y primario del espacio                                   |
| `tutorials/engine/tour-theme.css`               | Tema del popover con tokens (contraste medido en el archivo)                                                                                      |
| `tutorials/components/tutorial-auto-start.tsx`  | Arranque automático en el layout: espera a overlays y esqueletos                                                                                  |
| `tutorials/components/tutorial-help-button.tsx` | Botón `?` del header, junto al ojo                                                                                                                |
| `tutorials/components/tutorials-settings.tsx`   | Tarjeta Tutoriales de Cuenta › Preferencias                                                                                                       |

**Agregar un paso:**

1. Pon `data-tour="<sección>-<elemento>"` en el elemento (nunca se apunta a
   clases CSS). `Button`, `Card`, `Tabs.List` y `Disclosure.Trigger` de
   HeroUI pasan el atributo al DOM. `ChartCard` y `ScrollTable` reciben la
   prop `tour`.
2. Agrega el paso en `TUTORIALS[sección]` con `target` (sin él va centrado),
   `title` y `description` en la voz de `PRODUCT.md` (tuteo, frases cortas).
3. Si solo aplica en escritorio o en móvil, `viewport: "desktop" | "mobile"`.

Reglas:

- El motor resalta el **primer elemento visible** con ese `data-tour`. Por
  eso una misma ancla puede ir en la versión de escritorio y en la móvil de
  un componente (las dos se pintan y CSS oculta una), o en cada fila de una
  lista: se resalta la primera.
- Un paso sin elemento visible se omite. No hace falta condicionar los pasos
  a que haya datos.
- Anclas compartidas, fuera del prefijo de sección: `header-quick-add`,
  `header-more`, `header-amounts`, `header-help`, `header-menu`,
  `aside-workspaces`, `aside-sections`, `mobile-nav`, `mobile-quick-add`,
  `row-actions` (en `RowActions`), `import-button` (en `ImportButton`) y
  `budgets-recurring-tabs` (Gastos fijos y Presupuestos).
- Algunas anclas viven en componentes que Empresa también usa (Reportes,
  score, últimos movimientos). Allí no hacen nada mientras Empresa no tenga
  tutoriales.
- Al quitar o renombrar un `data-tour`, búscalo en `tutorials.ts`: el paso no
  falla, pero desaparece del recorrido.
- El popover se monta en `<body>`, fuera del contenedor del espacio:
  `run-tour.ts` le copia `--accent`, `--accent-foreground` y `--focus` desde
  `#contenido`.

### Aside agrupado y ancho ajustable (SPEC 31)

`SITE.navigation.personal` y `.business` son grupos (`{ label, items }`) en
orden. El aside pinta cada grupo con su `SidebarGroupLabel` y una `<ul>` con
`aria-labelledby` (ids de `useId`), dentro de
`<nav aria-label="Secciones del espacio" data-tour="aside-sections">`. Entre
grupos solo hay espacio (`gap-4`), sin líneas ni bordes. Barra inferior,
título del header y landing usan la lista plana de `flattenNav` (`nav.ts`).

| Espacio  | Grupos                                                                                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal | **Día a día** (Resumen, Movimientos) · **Tu plan** (Cuentas, Ingresos fijos, Gastos fijos, Presupuestos, Metas, Deudas) · **Entiende tu dinero** (Reportes, Recomendaciones) |
| Empresa  | **Día a día** (Resumen, Movimientos) · **Tu operación** (Cuentas, Ajustes) · **Entiende tu negocio** (Flujo de caja, Reportes, Recomendaciones)                              |

- **Tu plan** / **Tu operación** es donde se define lo que Tesoro usa para
  calcular; los otros dos grupos son para consultar. Una sección nueva entra
  en el grupo que corresponda según ese criterio.
- Con una sola empresa, su nombre va arriba de los grupos. El skeleton pinta
  un bloque por grupo de Personal (título + 2, 6 y 2 filas).
- **Ancho (solo escritorio, `≥ 768 px`):** `SidebarResizeHandle`, en el
  borde derecho de la columna abierta. Rango y paso en
  `sidebar/width.ts` (`SIDEBAR_WIDTH`: 240–360 px, 256 por defecto, 16 por
  tecla). Arrastrar cambia el ancho en vivo (sin transición de `width`,
  `setPointerCapture` y `user-select: none` en el body); doble clic vuelve a
  256; `←` / `→` restan o suman 16, `Home` / `End` van al mínimo y al máximo.
  Es `role="separator"` con `aria-valuenow`. Invisible en reposo; hover y
  arrastre muestran una línea de 2 px `bg-focus`, el foco un anillo
  `ring-focus` (≥ 3:1).
- **Persistencia:** cookie `tesoro-sidebar-width` (`saveSidebarWidth`: px
  enteros, `path=/`, un año, `SameSite=Lax`), escrita al soltar y tras cada
  tecla. `DashboardSidebar` la lee con `cookies()` y `parseSidebarWidth`
  (ausente o no numérica → 256, fuera de rango → al límite), así el primer
  render sale con el ancho correcto. Cerrar el aside no pierde el ancho. El
  Drawer móvil sigue en `w-72`, sin agarradera.

### Exportar (SPEC 32 y 33)

- **Botón:** `ExportButton` (`src/features/exports/components/`), en los
  accesos rápidos del header, solo en Reportes de Personal y de una empresa.
  `variant="secondary"`, ícono `Download`, `aria-label="Exportar"`; con texto
  desde 640 px y solo ícono de 44 px por debajo.
- **Diálogo:** `ExportDialog`, `Modal` centrado (hoja inferior en móvil),
  `sm:max-w-md`.
  - Tabs **Excel (.xlsx)** | **CSV (.csv)** | **PDF (.pdf)**; Excel por
    defecto.
  - `Select` **Periodo** y, según el periodo, otro `Select` con el valor, o
    **Desde** / **Hasta** en dos columnas (una en móvil). Controles de 44 px.
  - Con PDF, bajo el periodo: `Select` **Tamaño** (A4 | Carta) y tabs
    **Orientación** (Vertical | Horizontal) y **Tema** (Color | Ahorro de
    tinta) con una línea en `text-muted` que explica el tema elegido. Las
    tabs llevan etiqueta visible (`OptionTabs`, `aria-labelledby`).
  - Bajo el periodo, en `text-muted`, "Se crearán N hojas de mes" (Excel) o
    "Incluye N meses de detalle" (PDF). Con PDF el tope es de 12 meses: un
    rango mayor muestra "El PDF admite hasta 12 meses. Usa Excel para
    periodos más largos." y no llama al servidor; con un historial de más de
    12 meses, **Todo el historial** se deshabilita. Errores de rango en `text-danger` con `role="alert"`; aviso de
    **Ocultar montos** en `text-warning`. La zona es `aria-live="polite"`.
  - **Descargar** dice "Generando…" mientras espera; al terminar cierra y
    muestra el toast "Archivo descargado". Si falla, toast de error y el
    diálogo sigue abierto.
- **Contraste** sobre `--overlay`:

  | Par                   | Claro | Oscuro |
  | --------------------- | ----- | ------ |
  | `muted` / `overlay`   | 5.97  | 6.20   |
  | `warning` / `overlay` | 5.03  | 8.90   |
  | `danger` / `overlay`  | 5.44  | 5.31   |

- **Libro:** paleta ARGB por espacio en
  `src/features/exports/workbook/theme.ts` (`workbookPalette`). Los colores
  base copian los tokens en claro; si cambian `--accent`, `--income`,
  `--expense` o `--muted`, se actualizan ahí. Sin cuadrícula
  (`finishSheet`); cada tabla (`writeSection`) lleva borde `medium` del color
  del espacio por fuera y `thin` gris (`E3E7EC`) por dentro.

  | Par                                  | Personal | Empresa |
  | ------------------------------------ | -------- | ------- |
  | Blanco / banda de título (`accent`)  | 5.36     | 5.22    |
  | `accentDark` / encabezado (tinte)    | 7.13     | 6.91    |
  | Texto oscuro / fila de total (tinte) | 11.54    | 11.00   |
  | `income` / fila alterna (`F6F8FA`)   | 5.19     | 5.19    |
  | `expense` / fila alterna             | 5.01     | 5.01    |

  En la fila de total los montos van en texto oscuro: verde y rojo sobre su
  tinte bajan de 4.5:1.

- **PDF** (`src/features/exports/pdf/`): `theme.ts` (`pdfTheme(type,
"color" | "ink")`) toma los colores de `COLORS` y `workbookPalette` del
  libro, más `balance` y `chart1`–`chart5` (`--balance` y `--chart-*` en
  claro); ninguna sección fija un color a mano. Los pares del tema Color son
  los del libro (tabla de arriba); la fila de total también va en texto
  oscuro. Ahorro de tinta usa texto ≥ `#4b5563` sobre blanco, sin rellenos de
  color, y las gráficas en grises con contorno y rayado.
  - Secciones reutilizables en `sections/` (`pdfTable` para toda tabla) y
    gráficas en `charts/` como funciones puras que devuelven un SVG (solo
    `rect`, `path`, `line`, `circle`, `text` y `g`).
  - Inter y el logo van en base64 (`fonts-data.ts`, `brand-data.ts`),
    generados por `pnpm brand:assets` desde `assets/fonts/` y
    `assets/brand/mark.svg`.

## Dónde vive cada pantalla

| Pantalla         | Ruta                                                           | Piezas                                                                                                                                                                                                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell            | `app/dashboard/layout.tsx`                                     | Aside, header con título y accesos, `<main id="contenido">` y "Saltar al contenido"                                                                                                                                                                                                                                                            |
| Resumen Personal | `app/dashboard/personal/page.tsx`                              | 4 `StatCard` → gráfica + columna (score, cuentas) → últimos movimientos → 4 tarjetas                                                                                                                                                                                                                                                           |
| Movimientos      | `app/dashboard/personal/transactions`                          | Barra de filtros pill, KPIs pequeñas, tabla compacta (`src/features/transactions/`)                                                                                                                                                                                                                                                            |
| Gastos fijos     | `app/dashboard/personal/recurring`                             | Acciones con "N atrasados" (`OverdueIndicator`), Próximos pagos con `MonthNav` y "Pagado $ X de $ Y", y lista; la fila abre `RecurringExpenseSheet` (derecha en escritorio, hoja inferior en móvil). Selector móvil `BudgetsAndRecurringTabs`                                                                                                  |
| Ingresos fijos   | `app/dashboard/personal/recurring-income`                      | Acciones con "N atrasados" (`OverdueIndicator` con `path`), Próximos ingresos con `MonthNav` y "Recibido $ X de $ Y" (diaria y cada N días en una fila resumen), Sin fecha fija y lista; la fila (o el nombre de la fila resumen) abre `RecurringIncomeSheet` vía `IncomeSheetProvider`. Bajo el monto del tab Ingreso, `IncomeReceiptPreview` |
| Presupuestos     | `app/dashboard/personal/budgets`                               | Mes, totales y filas de progreso; `?tab=recurring` redirige a Gastos fijos                                                                                                                                                                                                                                                                     |
| Reportes         | `src/features/reports/components/reports-view.tsx`             | Barra de periodo y tipo, 4 KPI, tendencia, top 5 + tabla de categorías                                                                                                                                                                                                                                                                         |
| Cuenta           | `app/dashboard/account/{general,security,privacy,preferences}` | Aside interno (`AccountNav`) y una `AccountSection` por tema                                                                                                                                                                                                                                                                                   |

## Móvil

Experiencia de teléfono (SPEC 15). Aplica solo a anchos `< 768 px`, el mismo
corte `md` del sidebar (`MOBILE_QUERY` y `useIsMobile` en
`src/hooks/use-is-mobile.ts`). Tablet y escritorio usan el shell de escritorio.
El SPEC 18 quitó el tab superior y pasó filtros y tablas a hoja y tarjetas.
Formularios a pantalla completa y gráficas angostas siguen pendientes.

Piezas en `src/components/dashboard/mobile/`:

| Pieza                          | Qué hace                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `quick-sheet.tsx`              | Hoja inferior (`Drawer` con asa), igual en Personal y Empresa: **Movimiento rápido**, **Categorías** y **Verificar movimientos** (SPEC 30) |
| `use-quick-sheet-auto-open.ts` | Estado de la hoja y su apertura automática                                                                                                 |
| `bottom-nav.tsx`               | Barra inferior: 4 destinos, [+] al centro (abre la hoja)                                                                                   |
| `mobile-shell.tsx`             | Une la hoja, la barra y el hook con el mismo estado de apertura                                                                            |

- **Hoja:** se cierra deslizando el asa, tocando el fondo, con "Cerrar" o con
  Escape. Cada acción cierra la hoja y abre su diálogo sin cambiar de página.
  **Movimiento rápido** abre `TransactionDialog` con todos los tabs del
  espacio, en Gasto por defecto: el mismo diálogo que el **+** del
  escritorio. Las acciones sueltas de antes (Gasto, Ingreso, Aporte a meta,
  Pago de deuda, Marcar gasto fijo pagado, Venta y Costo o gasto) se quitaron.
  Solo existe en rutas de un espacio. Los datos salen de
  `QuickActionsProvider`, la misma carga del header.
- **Apertura automática:** se abre sola en cada carga completa de una ruta de
  espacio y al volver visible la pestaña tras 5 minutos o más oculta. Navegar
  entre páginas no la abre, ni con el switch "Abrir al entrar" apagado, un
  diálogo abierto, fuera de un espacio o en `>= 768 px`. El switch vive en
  `localStorage` (`tesoro:quick-sheet:auto-open:v1`, por dispositivo); la hora
  de ocultar, en `sessionStorage` (`tesoro:quick-sheet:hidden-at:v1`). Si el
  almacenamiento falla, usa memoria y la hoja se abre como con el switch
  encendido.
- **Barra inferior:** Personal: Resumen, Movimientos, [+], Gastos fijos, Cuentas
  (Metas sigue en el aside, SPEC 20). La entrada de Gastos fijos también se
  marca en Presupuestos: en el teléfono son dos tabs de la misma pantalla
  (`BudgetsAndRecurringTabs`, SPEC 23), cada una su ruta, y el selector se
  oculta desde 768 px.
  Empresa: Resumen, Movimientos, [+], Flujo de caja, Reportes. Fuera
  de un espacio (cuenta, estado vacío de Empresa) muestra los destinos de
  Personal, sin [+]. Los destinos salen de `SITE.navigation.mobile`.
  Respeta `safe-area-inset-bottom`, se oculta con un diálogo abierto y el
  `<main>` deja padding inferior para que no tape contenido.
- **Selector de espacio:** vive solo en el aside (`WorkspaceTabs` en
  `app-sidebar.tsx`, con `WORKSPACE_TABS` y `getActiveWorkspaceTab` de
  `workspace-tabs.tsx`). En el teléfono el aside se abre desde el botón de
  menú del header (44 px). No hay tab sticky bajo el header (SPEC 18). El
  primario cambia solo por la ruta (`WorkspaceThemeRoot`).
- **Tablas con scroll horizontal (`< 768 px`, SPEC 20):** las tablas se ven
  completas y se deslizan en horizontal dentro de `ScrollTable`
  (`src/components/dashboard/scroll-table.tsx`), que fija un ancho mínimo
  (`minWidth`) y pinta un degradado en el borde izquierdo cuando ya se
  deslizó. Fecha, monto, categoría y cuenta van en `whitespace-nowrap`; la
  descripción envuelve (máximo 3 líneas con `line-clamp-3`, texto completo en
  `title`). Nada queda fijo: la columna de acciones se
  desliza con la tabla para no tapar información ni la barra inferior. Usan este patrón Movimientos, Gastos fijos, Resumen
  por categoría, Últimos movimientos y Flujo de caja. `DataRows` se eliminó
  (SPEC 20): ya no hay tarjetas para tablas. Las tablas del asistente de
  importación no cambian.
- **Acciones por fila (SPEC 20):** `RowActions`
  (`src/components/dashboard/row-actions.tsx`). Desde 768 px, un solo botón de
  tres puntos (`aria-label="Acciones de <fila>"`) abre un `Dropdown` con las
  opciones; las destructivas van al final con tono `danger`. En móvil las
  mismas opciones son botones de ícono en línea de 44 px. Como el menú no
  puede alojar el trigger de un diálogo, los diálogos de edición se controlan
  con `open` / `onOpenChange` y la confirmación de borrado es `DeleteDialog`
  (`src/components/dashboard/delete-dialog.tsx`). Las tarjetas de cuentas,
  deudas y metas conservan sus botones.
- **Controles de barra (SPEC 20):** el buscador, la pill del mes, Filtros,
  los filtros en pill sin activar, el selector de
  periodo y las flechas de Reportes y Presupuestos usan el mismo gris que las
  tarjetas y las tablas (`bg-surface`, hover `bg-surface-secondary`). Los
  botones son `variant="ghost"` más `CONTROL_BUTTON`, y las pills llevan
  `CONTROL_SURFACE`, de `surface.ts`. Nunca `variant="outline"` (con borde) ni
  `bg-default/60`. El buscador sobrescribe `bg-surface` directo en
  `SearchField.Group`: HeroUI le fija `bg-field` sin pasar por su variable.
  Altura de 44 px en la fila de Movimientos. El filtro activo sigue en
  `accent-soft`.
- **Filtros de Movimientos (`< 768 px`):** buscador a todo el ancho; debajo,
  `‹ Mes ›` y el botón **Filtros** con el número de filtros activos (tipo,
  categoría, cuenta y "Todos los meses"). La hoja inferior (`Drawer`) trae
  Tipo, Categoría, Cuenta y el alternador de meses, aplica al elegir
  (`router.replace`) y limpia con "Limpiar filtros". Desde 768 px, la fila
  principal es buscador (ocupa el ancho libre, mínimo `18rem`) · mes, de 44 px
  y centrados; debajo van los filtros en pill. **Categorías** y **Verificar**
  ya no están en la barra (SPEC 25): viven en el menú Más del header y en la
  hoja de acciones rápidas. Los elementos del servidor que se pasan por props
  a un componente cliente (`trigger`) van como hijo único (`<div>` o
  `<Fragment>`): dentro de un array de hijos React pide `key`.
- **Números sin partirse:** `formatDate`, `formatShortDate` y
  `formatPercent` usan espacio duro (`\u00A0`), así que ninguna fecha ni
  porcentaje ocupa dos líneas. Los montos ya lo traían de `Intl`.
- **Pendiente:** filtros unificados en toda la app (Reportes: período, mes y
  pestañas Gastos / Ingresos a todo el ancho) y el mismo `trigger` con `key`
  en los demás diálogos (`{trigger}` junto a `Backdrop`). Revisión visual en
  360 y 390 px de Personal y Empresa.
- **Táctil:** los controles del shell móvil miden 44 × 44 px o más y las
  acciones de la hoja, 56 px de alto o más. Los botones `size="sm"` de HeroUI
  miden 36 px en móvil: en el shell llevan `max-md:h-11 max-md:min-w-11`.
  Todo campo de monto usa `inputMode="decimal"`.
- **Instalable:** `app/manifest.ts` con ícono `maskable` de 512 px
  (`public/icons/icon-maskable-512.png`, de `pnpm brand:assets`), `display:
"standalone"` y `start_url` `/dashboard/personal`; `appleWebApp` y
  `viewportFit: "cover"` en `app/layout.tsx`. Sin service worker.

## Movimiento

- Tarjetas del dashboard: aparición de 180 ms desde casi visible
  (`#contenido .card` en `globals.css`).
- Hover de filas, ítems del aside y enlaces: 150 ms.
- Tabs y diálogos: las transiciones propias de HeroUI.
- Todo con `motion-reduce:transition-none` o dentro de
  `@media (prefers-reduced-motion: no-preference)`.
- **Landing (SPEC 24): revelados en CSS.** `reveal.tsx` solo marca
  (`data-reveal`, `data-reveal-list` / `data-reveal-item`) y
  `reveal-observer.tsx`, un único `IntersectionObserver`, pone
  `data-pending` en lo que arranca fuera de pantalla y lo quita al entrar.
  La transición vive en `globals.css`: una sola curva (expo.out
  `cubic-bezier(0.16, 1, 0.3, 1)`), 0,7 s con subida de 24 px, escalonado de
  80 ms, una vez por elemento. Lo que ya se ve al cargar no se oculta nunca
  (protege el LCP). El hero entra con `.hero-enter` (solo `translate`).
- `ScrollWipe` (barra de factores) y `ScrollSettle` (clips) usan
  `animation-timeline: view()` sin JS; el medidor del score se anima una vez
  al verse. `.press` da el levante y la presión de los CTA.
- **Motion solo en lo interactivo:** `motion-provider.tsx` (`LazyMotion`
  estricto con las funciones cargadas aparte desde `motion-features.ts` y
  `MotionConfig reducedMotion="user"`) cubre el reproductor de la demo y el
  recorrido de funciones.
- **Reduced motion y sin JS:** no hay estado oculto; todo se ve en su estado
  final y no se carga la escena 3D.
- **Peso de la landing:** `ToastProvider` solo en `app/dashboard/layout.tsx`,
  enlaces a auth con `prefetch={false}`, cajón móvil del header cargado al
  abrirlo y `SiteThemeToggle` como botón nativo. Así la landing no carga
  react-aria al inicio.

## Accesibilidad

- Cada pantalla tiene un solo `<h1>` (el header) y las tarjetas usan `<h2>`.
- Los controles que solo muestran un ícono tienen `aria-label`; los filtros
  muestran su nombre ("Tipo: Gastos").
- Las barras de progreso tienen nombre ("Mercado: 85 %").
- Las recargas por filtros llevan `aria-busy` y anuncian el resultado.
- A 375 px no hay scroll horizontal: las tablas ocultan columnas por
  breakpoint en vez de desbordarse.

## Impeccable

[Impeccable](https://github.com/pbakaus/impeccable) es el skill de diseño del
proyecto. Vive versionado en `.claude/skills/impeccable/`, con sus subagentes en
`.claude/agents/impeccable-*.md`. No se instala como plugin.

| Pieza | Versión |
| ----- | ------- |
| Skill | 4.8.0   |
| Motor | 0.1.18  |

- El motor es un binario por plataforma. No se versiona
  (`.claude/skills/impeccable/scripts/bin/` está en `.gitignore`): el launcher
  lo descarga la primera vez y lo verifica contra
  `scripts/engine-checksums.txt`.
- La copia versionada difiere del upstream 4.8.0 solo en formato: pasó una vez
  por Prettier antes de excluirla en `.prettierignore`. La lógica es la misma.
  La próxima reinstalación la deja idéntica.
- Para actualizar, reinstala con `npx skills add pbakaus/impeccable`,
  revisa el diff y actualiza esta tabla.

### Comandos

Se invocan como `/impeccable <comando> [objetivo]` en Claude Code. El objetivo
es una ruta (`app/dashboard/personal/page.tsx`) o una URL.

| Comando    | Para qué                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------- |
| `teach`    | Alias de `init`: entrevista y escribe `PRODUCT.md`. Correrlo de nuevo si cambia el producto |
| `audit`    | Revisión técnica: accesibilidad, rendimiento, tema, responsive. Puntaje sobre 20            |
| `critique` | Revisión de diseño con heurísticas de Nielsen y personas. Puntaje sobre 40                  |
| `polish`   | Pasada final de calidad sobre una pantalla, sin rediseñarla                                 |
| `distill`  | Quitar lo que sobra (métricas repetidas, botones de igual peso)                             |
| `animate`  | Agregar movimiento con propósito (feedback, continuidad), respetando reduced motion         |

Flujo recomendado para una pantalla nueva o rediseñada: `critique` y `audit`
→ registrar hallazgos P0/P1/P2 en el spec → implementar → `polish` y
`animate` → verificar contraste con los tokens.

- `audit` y `critique` corren subagentes aislados. Sin sesión en el
  navegador revisan el código: las reglas del detector que necesitan la
  página dibujada no corren, así que el contraste se verifica aparte.
- Para ver una pantalla con sesión sin datos reales, sirve una ruta temporal
  con datos ficticios y capturas con Chrome headless (no baja de 500 px de
  ancho: el móvil se mide dentro de un iframe de 375 px). La ruta se borra
  antes de commitear.
- El hook de Impeccable guarda un caché local en `.impeccable/`, ignorado
  por git y por Prettier.
