# UI de Tesoro

Guía de la interfaz del dashboard: tema, tokens, componentes propios, dónde
vive cada pieza y cómo se trabaja el diseño con Impeccable. Nace de
[SPEC 14](../specs/14-ui-polish-with-impeccable.md); SPEC 14b la aplica al
resto de pantallas.

El contexto de producto (usuarios, voz, principios) está en
[`PRODUCT.md`](../PRODUCT.md). Esta guía cubre el **cómo se ve**.

## Principios

- **Oscuro por defecto, claro disponible.** El diseño se piensa sobre negro;
  el toggle del aside cambia a claro y lo recuerda (`next-themes`).
- **Un solo acento por espacio.** Neutro fuera de los espacios, emerald en
  Personal y naranja en Empresa. Negros y grises son los mismos en los dos.
- **Tarjetas sin borde.** La separación la da el contraste entre fondo y
  superficie (en claro, más la sombra suave de HeroUI). Radios grandes en
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
| `--background`                                  | Fondo de la página. Oscuro ≈ `#0a0a0a`, claro `#f6f7f9`                |
| `--surface`                                     | Tarjetas. Oscuro ≈ `#18181b`, claro blanco                             |
| `--surface-secondary`, `--surface-tertiary`     | Superficies escalonadas dentro de una tarjeta                          |
| `--overlay`                                     | Diálogos, menús, popovers y tooltips                                   |
| `--default`                                     | Ítem activo del aside, hover de filas, chips neutros                   |
| `--muted`                                       | Texto atenuado, etiquetas, ticks de gráficas                           |
| `--border`, `--separator`                       | Grilla de gráficas y divisores muy sutiles                             |
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
- **Estados en chips y barras:** `src/components/dashboard/tone.ts`
  (`TONE_BADGE_CLASSES`, `TONE_BAR_CLASSES`, `TONE_TEXT_CLASSES`). No se usa
  la paleta cruda de Tailwind (`amber-*`, `rose-*`…).
- **Tipografía:** Inter vía `next/font/google` en `app/layout.tsx`
  (`--font-sans`). Montos, KPIs, tablas y ejes con `tabular-nums`.

## Contraste

Pares verificados con los tokens de `src/styles/globals.css` (WCAG 2.x,
OKLCH → sRGB). Mínimos: 4.5:1 texto, 3:1 gráficos y foco.

| Par                                     | Claro | Oscuro |
| --------------------------------------- | ----- | ------ |
| `foreground` / `background`             | 16.49 | 18.96  |
| `muted` / `surface`                     | 6.00  | 6.74   |
| `muted` / `default`                     | 4.96  | 5.66   |
| `income` / `surface`                    | 5.56  | 5.03   |
| `expense` / `surface`                   | 5.35  | 5.06   |
| `balance` / `surface`                   | 8.16  | 5.89   |
| `danger` / `background`                 | 5.07  | 6.84   |
| `accent-foreground` / `accent` Personal | 4.84  | 7.19   |
| `accent-foreground` / `accent` Empresa  | 4.94  | 6.13   |
| `accent` / `background` Personal (foco) | 3.41  | 8.03   |
| `accent` / `background` Empresa (foco)  | 3.34  | 6.84   |
| `text-brand` / `background`             | 5.10  | 11.08  |
| `muted` / `field-background`            | 5.22  | 5.19   |
| `foreground` / `field-background`       | 15.41 | 13.07  |
| `--chart-*` / `surface` (mínimo)        | 4.77  | 3.72   |

Las series de dinero (`--income`, `--expense`, `--balance`) también pasan el
validador de paletas del skill `dataviz` en claro y oscuro: banda de
luminosidad, croma, ΔE ≥ 10 entre todos los pares con protanopía y
deuteranopía, y ΔE ≥ 21 con visión normal. Entre sí casi no difieren en
luminancia, así que las gráficas nunca dependen solo del color: llevan
leyenda, orden fijo de series y el monto en el tooltip y en la tabla
`sr-only`.

## Componentes propios

Todos en `src/components/`. HeroUI se importa directo de `@heroui/react`;
estos solo agregan lo que HeroUI no trae.

### Shell del dashboard (`src/components/dashboard/`)

| Pieza                                                                      | Qué hace                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app-sidebar.tsx`, `sidebar/`                                              | Aside: logo → tabs Personal/Empresa → navegación; abajo Ayuda (issues de GitHub), tema y usuario                                                                                                                                                |
| `dashboard-title.tsx`                                                      | Único `<h1>` de la página, en el header. Saludo según la hora de Bogotá en el Resumen de Personal                                                                                                                                               |
| `quick-actions.tsx`, `quick-actions-menu.tsx`, `quick-actions-context.tsx` | Accesos del header: "Registrar movimiento" + "Más" (aporte, pago, importar) en Personal; "Registrar operación" en Empresa                                                                                                                       |
| `stat-card.tsx`                                                            | KPI: etiqueta, valor y badge de variación con color por significado (`trend`); `<dl>` accesible                                                                                                                                                 |
| `card-heading.tsx`                                                         | Cabecera de tarjeta: `<h2>`, ayuda (i) opcional y enlace discreto con chevron                                                                                                                                                                   |
| `help-hint.tsx`                                                            | Ícono (i) con `Popover`; los textos viven en `src/config/help.ts` (`HELP`)                                                                                                                                                                      |
| `empty-state.tsx`                                                          | `EmptyState` (página): ícono, qué falta, qué hacer y la acción. `CardEmpty` (dentro de una tarjeta)                                                                                                                                             |
| `card-skeleton.tsx`                                                        | Placeholder con el mismo contenedor de `Card`; todo bloque que carga usa este, no un `Skeleton` suelto                                                                                                                                          |
| `tone.ts`                                                                  | Clases de estado (chips, barras, texto) desde tokens                                                                                                                                                                                            |
| `row-actions.tsx`, `delete-dialog.tsx`, `scroll-table.tsx`                 | Acciones de fila (menú en escritorio, botones en móvil), confirmación de borrado controlada y contenedor de tabla con scroll horizontal y columna de acciones fija (SPEC 20)                                                                    |
| `surface.ts`                                                               | Clases de superficie sin borde: `SURFACE_LIST`/`SURFACE_ROW` (lista sobre el fondo), `CARD_LIST`/`CARD_ROW` (lista dentro de una `Card`), `SURFACE_ITEM` (tarjeta de una grilla) y `SURFACE_NOTE`. Nunca `rounded-xl border` ni `border-dashed` |

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

## Dónde vive cada pantalla

| Pantalla         | Ruta                                               | Piezas                                                                               |
| ---------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Shell            | `app/dashboard/layout.tsx`                         | Aside, header con título y accesos, `<main id="contenido">` y "Saltar al contenido"  |
| Resumen Personal | `app/dashboard/personal/page.tsx`                  | 4 `StatCard` → gráfica + columna (score, cuentas) → últimos movimientos → 4 tarjetas |
| Movimientos      | `app/dashboard/personal/transactions`              | Barra de filtros pill, KPIs pequeñas, tabla compacta (`src/features/transactions/`)  |
| Reportes         | `src/features/reports/components/reports-view.tsx` | Barra de periodo y tipo, 4 KPI, tendencia, top 5 + tabla de categorías               |

## Móvil

Experiencia de teléfono (SPEC 15). Aplica solo a anchos `< 768 px`, el mismo
corte `md` del sidebar (`MOBILE_QUERY` y `useIsMobile` en
`src/hooks/use-is-mobile.ts`). Tablet y escritorio usan el shell de escritorio.
El SPEC 18 quitó el tab superior y pasó filtros y tablas a hoja y tarjetas.
Formularios a pantalla completa y gráficas angostas siguen pendientes.

Piezas en `src/components/dashboard/mobile/`:

| Pieza                          | Qué hace                                                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quick-sheet.tsx`              | Hoja inferior (`Drawer` con asa). Personal: Gasto, Ingreso, Aporte a meta, Pago de deuda o tarjeta, Marcar gasto fijo pagado. Empresa: Venta, Costo o gasto |
| `use-quick-sheet-auto-open.ts` | Estado de la hoja y su apertura automática                                                                                                                  |
| `bottom-nav.tsx`               | Barra inferior: 4 destinos, [+] al centro (abre la hoja)                                                                                                    |
| `mobile-shell.tsx`             | Une la hoja, la barra y el hook con el mismo estado de apertura                                                                                             |

- **Hoja:** se cierra deslizando el asa, tocando el fondo, con "Cerrar" o con
  Escape. Cada acción cierra la hoja y abre su diálogo sin cambiar de página.
  Sin metas, deudas o gastos fijos pendientes, la acción lleva a la página
  donde se crean. Solo existe en rutas de un espacio. Los datos salen de
  `QuickActionsProvider`, la misma carga del header.
- **Apertura automática:** se abre sola en cada carga completa de una ruta de
  espacio y al volver visible la pestaña tras 5 minutos o más oculta. Navegar
  entre páginas no la abre, ni con el switch "Abrir al entrar" apagado, un
  diálogo abierto, fuera de un espacio o en `>= 768 px`. El switch vive en
  `localStorage` (`tesoro:quick-sheet:auto-open:v1`, por dispositivo); la hora
  de ocultar, en `sessionStorage` (`tesoro:quick-sheet:hidden-at:v1`). Si el
  almacenamiento falla, usa memoria y la hoja se abre como con el switch
  encendido.
- **Barra inferior:** Personal: Resumen, Movimientos, [+], Presupuestos, Cuentas
  (Metas sigue en el aside, SPEC 20).
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
  `title`). La columna de acciones queda fija a la derecha con
  `STICKY_ACTIONS` (fondo opaco y sombra a su izquierda) y, en el encabezado,
  `STICKY_ACTIONS_HEAD`. Usan este patrón Movimientos, Gastos fijos, Resumen
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
- **Filtros de Movimientos (`< 768 px`):** buscador a todo el ancho; debajo,
  `‹ Mes ›`, el botón **Filtros** con el número de filtros activos (tipo,
  categoría, cuenta y "Todos los meses") y **Verificar** (solo ícono por
  debajo de 640 px). La hoja inferior (`Drawer`) trae
  Tipo, Categoría, Cuenta, el alternador de meses y Categorías
  (`categoriesAction`), aplica al elegir (`router.replace`) y limpia con
  "Limpiar filtros". Desde 768 px, la fila principal es buscador (ocupa el
  ancho libre, mínimo `18rem`) · mes · Verificar, todos de 44 px y centrados;
  debajo van los filtros en pill. Verificar entra a la fila por la prop
  `trailing` de `TransactionsFilters`. Los elementos del
  servidor que se pasan por props a un componente cliente (`categoriesAction`,
  `trigger`) van como hijo único (`<div>` o `<Fragment>`): dentro de un array de
  hijos React pide `key`.
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
