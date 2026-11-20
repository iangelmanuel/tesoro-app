# SPEC 52c — Personal en shadcn: Reportes, Recomendaciones e Importar

> **Estado:** Implementado
> **Depende de:** SPEC 03, SPEC 07, SPEC 08, SPEC 08b, SPEC 27, SPEC 32, SPEC 33, SPEC 51, SPEC 52a, SPEC 52b
> **Fecha:** 2026-11-20
> **Objetivo:** Migrar a shadcn (Base UI) Reportes, Recomendaciones, Importar y las piezas del shell que aún traen HeroUI, para que nada de lo que se pinta en `/dashboard/personal/**` importe `@heroui/react`.

## Por qué existe este spec

Es la tercera y última parte de SPEC 52 (ver SPEC 52a y 52b). Tras 52b quedan en HeroUI tres pantallas de Personal y varias piezas que las envuelven:

- `reports`, `score`, `imports` y `exports`: ~4.200 líneas, 20 archivos con `@heroui/react`.
- Shell del dashboard, montado en toda pantalla de Personal: `TutorialHelpButton` y `TutorialProvider` (`toast` y `Button` de HeroUI), `ExportButton` / `ExportDialog` en los accesos rápidos del header, `BusinessSwitcher` en el aside (`Dropdown`) y `Logo` (solo `cn`).

El criterio de cierre es **transitivo**: ningún módulo que se renderice en una pantalla de `/dashboard/personal/**` importa `@heroui/react`. Por eso entran las piezas del shell, aunque algunas (`BusinessSwitcher`, `ExportDialog`) también las usa Empresa.

Como en 52a y 52b, lo que comparte Empresa (`ReportsView`, `ScoreRecommendationsView`, `ExportDialog`, `BusinessSwitcher`) se migra **en sitio**: una sola versión, que Empresa hereda.

Con `BusinessSwitcher` migrado, el aside móvil ya no aloja menús de HeroUI y puede volver a ser modal.

## Alcance

**Entra:**

### 1. Reportes (`app/dashboard/personal/reports/page.tsx`)

- Todo `src/features/reports/components/*` que aún usa HeroUI:
  - `ReportsView` (`Card` y `Skeleton` de HeroUI → superficies de `surface.ts`, `CardHeading`, `StatCard`, `ChartCard`);
  - `ReportPeriodPicker`: misma UX y mismos `searchParams`. Periodo con `SelectField`, botones anterior / siguiente con `Button` de `ui/`;
  - `ReportTypeToggle`: `SegmentedField` (o `SEGMENT_TRACK_CLASS` / `SEGMENT_ITEM_CLASS` en línea);
  - `CategorySummaryTable`: `Table` de `ui/` dentro de `ScrollTable`.
- Las gráficas (`category-donut-chart`, `top-categories-chart`, `income-expense-chart`, `chart-data-table`) ya están en `charts/`; solo se revisan sus skeletons.
- `ReportsViewSkeleton` compuesto con los `…Skeleton` de cada pieza; sale `CardSkeleton` de `reports-view.tsx`.

### 2. Exportar (`src/features/exports/components/*`)

- `ExportButton` y `ExportDialog`, en sitio (Personal y Empresa, desde los accesos rápidos del header):
  - `FormDialog` en vez de `Modal`;
  - formato (`.xlsx` / `.csv` / `.pdf`) con `SegmentedField`;
  - selects con `SelectField`;
  - toasts con sonner.
- Mismo Route Handler (`app/api/export/[workspaceId]/route.ts`), mismos parámetros y misma lógica de selección (`initialSelection`).

### 3. Recomendaciones (`app/dashboard/personal/recommendations/page.tsx`)

- Todo `src/features/score/components/*` que aún usa HeroUI, solo migración (misma UI y comportamiento):
  - `ScoreRecommendationsView` (`Card*` de HeroUI → superficies de `surface.ts` + `CardHeading`);
  - `RecommendationItem`: botones "Ir" y "Ocultar" con `Button` / `buttonVariants` de `ui/`;
  - `HiddenRecommendations`: `Disclosure` → `Collapsible` de `ui/`, con "Restaurar";
  - toasts con sonner.
- `ScoreOverview`, `ScoreFactors`, `ScoreHistoryChart`, `RecommendationList` y `ScoreInsufficient` se revisan para que exporten su `…Skeleton`. `ScoreRecommendationsSkeleton` los compone.
- Mismas actions de ocultar y restaurar.

### 4. Importar (`app/dashboard/personal/import/page.tsx`)

- Mismos pasos y mismo flujo. `wizard-state.ts`, los parsers y las actions **no cambian**.
- Todo `src/features/imports/components/*`:
  - `ImportWizard`: indicador de pasos propio (sin HeroUI), con el paso actual anunciado (`aria-current="step"`);
  - `FileStep` (`RadioGroup` de `ui/` para el destino), `TableStep`, `ColumnsStep`, `CategoriesStep`, `LinkStep`, `PreviewStep`, `SummaryStep`;
  - selects con `SelectField` (los agrupados con encabezado y separador, como hoy);
  - casillas con `Checkbox`, chips con `Badge`, tablas con `Table` dentro de `ScrollTable`;
  - `ImportButton` (lo usan Movimientos, Deudas, Metas y Gastos fijos; conserva `data-tour="import-button"`);
  - `ImportHistory`: deshacer con `AlertDialog` de `ui/`, toasts con sonner.
- La página deja `buttonVariants` de HeroUI (enlace "Movimientos" con `buttonVariants` de `ui/`) y `CardSkeleton`.

### 5. Shell del dashboard

- **Tutoriales:** `TutorialHelpButton`, `TutorialProvider` y `TutorialAutoStart` usan `Button` de `ui/` y `toast` de sonner. `TutorialsSettings` (pantalla de cuenta) queda para SPEC 53.
- **`BusinessSwitcher`** (aside): `Dropdown` → `DropdownMenu` de `ui/`, en sitio. Mismas opciones y misma navegación.
- **`Logo`**: `cn` de `@/libs/cn`.
- **Aside móvil:** el `Sheet` de `sidebar.tsx` vuelve a modal (sin `modal={false}` ni `closesFromSheet`). `heroui-compat.ts` queda sin consumidores y se borra.
- **`ToastProvider` de HeroUI:** sale de `app/dashboard/layout.tsx` y pasa a `app/dashboard/business/layout.tsx` (nuevo) y `app/dashboard/account/layout.tsx`, las pantallas que aún lanzan toasts de HeroUI. Personal solo usa sonner.
- Se quedan hasta SPEC 53: `HeroUIPortalBridge`, `HeroUIPortalHost`, `heroui-bridge.css` y el `LabelContext` de `FieldLabel` (los usan Empresa y cuenta).

### 6. Reglas comunes (iguales a SPEC 52b §9)

- Mismas server actions, esquemas, consultas y servicios del MCP. No cambian `actions.ts`, `schemas.ts`, `queries.ts`, `wizard-state.ts`, los parsers de importación, `src/features/exports/workbook/*`, `src/features/exports/pdf/*` ni el Route Handler de exportar.
- Campos con las piezas de `src/components/forms/` y `src/components/ui/`; errores del servidor con `aria-invalid` + `aria-describedby`.
- Diálogos con `FormDialog`; confirmaciones con `AlertDialog`.
- Botones con `onClick` / `disabled`; ningún archivo migrado usa `onPress` / `isDisabled`.
- Toasts con `toast` de `@/components/ui/sonner`; errores con `toast.error`.
- Listas y tarjetas con `surface.ts`; KPIs con `StatCard`; vacíos con `EmptyState` / `CardEmpty`; estados con `tone.ts`.
- **Skeletons (SPEC 51 §6):** cada componente que carga datos exporta su `…Skeleton` en el mismo archivo y con el mismo contenedor. Ningún archivo de este spec usa `CardSkeleton`.
- **`loading.tsx`** nuevo en `personal/reports/`, `personal/recommendations/` y `personal/import/`, cada uno dentro de `LoadingRegion` y compuesto con los skeletons de su pantalla.
- **Tours:** los `target` de `reports` y `recommendations` en `src/config/tutorials.ts` y `import-button` siguen existiendo como `data-tour` en el DOM migrado.
- **Accesibilidad:** AA en claro y oscuro, foco con `outline-ring`, 44 × 44 px de área táctil, `Amount` leído completo, reflujo sin scroll horizontal a 320 px y a 200 % de zoom, `prefers-reduced-motion`, foco atrapado en diálogos y en el aside móvil.
- **Impeccable:** `/impeccable audit` y `polish` de Reportes, Recomendaciones, Importar (cada paso), el diálogo de exportar y el aside móvil, en claro, oscuro, móvil, tablet y escritorio.
  - Los hallazgos dentro de la dirección "Señalética" de SPEC 51 se corrigen directo.
  - Un cambio grande de layout o de flujo se lista y se pregunta antes de hacerlo.

### 7. Documentación

- `CLAUDE.md` (UI y tema): `heroui-compat.ts` borrado y aside móvil modal; Personal completo en shadcn.
- `docs/ui.md`: estado de la migración por pantalla (todo Personal en shadcn), aside móvil modal, lo que queda para SPEC 53.
- `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Pantallas exclusivas de Empresa (`business-dialog`, `business-summary-cards`, `delete-business-dialog`, `restore-business-button`, `cash-flow/*`), cuenta (incluido `TutorialsSettings` y `HideAmountsSwitch`), auth, MCP, landing y páginas públicas; retiro de HeroUI, `@internationalized/date`, `HeroUIPortalBridge`, `HeroUIPortalHost` y `heroui-bridge.css` (**SPEC 53**).
- Reordenar o fusionar pasos del asistente de importar.
- Tour de Importar (no hay sección en `TUTORIAL_SECTIONS`; pediría migración).
- Rango de fechas personalizado con calendario en Reportes (cambia `searchParams` y consultas).
- Menú contextual (`RowContextMenu`) en recomendaciones.
- Rediseño del flujo de exportar.
- Cambios en server actions, esquemas Zod, consultas, servicios del MCP o tablas.
- Pruebas automatizadas en navegador (Playwright, Lighthouse en CI).

## Modelo de datos

Este spec no agrega tablas, columnas ni migraciones. Reusa el modelo de SPEC 03, 07, 08, 08b, 32 y 33.

Las APIs públicas de los componentes compartidos con Empresa no cambian:

```ts
// src/features/reports/components/reports-view.tsx — mismas props
// src/features/score/components/score-recommendations-view.tsx — mismas props
// src/features/exports/components/export-button.tsx — mismas props
// src/features/business/components/business-switcher.tsx — mismas props
```

## Plan de implementación

1. `Logo` con `cn` de `@/libs/cn`.
2. Migrar `BusinessSwitcher` a `DropdownMenu`. Probar desde Personal y Empresa, en escritorio y en el aside móvil.
3. Volver modal el `Sheet` del aside móvil, quitar `closesFromSheet` y borrar `heroui-compat.ts`.
4. Tutoriales del shell: `TutorialHelpButton`, `TutorialProvider` y `TutorialAutoStart` con `Button` de `ui/` y sonner.
5. Migrar `ExportButton` y `ExportDialog`. Probar `.xlsx`, `.csv` y `.pdf` desde Personal y desde Empresa.
6. Migrar Reportes: `ReportTypeToggle`, `ReportPeriodPicker`, `CategorySummaryTable`, `ReportsView` con skeletons; `loading.tsx`. Probar también los reportes de Empresa.
7. Migrar Recomendaciones: `RecommendationItem`, `HiddenRecommendations`, `ScoreRecommendationsView` con skeletons; `loading.tsx`. Probar también las de Empresa.
8. Migrar `ImportButton` e `ImportHistory` (con `AlertDialog` de deshacer).
9. Migrar el asistente de importar paso a paso: `ImportWizard` (indicador de pasos), `FileStep`, `TableStep`, `ColumnsStep`, `CategoriesStep`, `LinkStep`, `PreviewStep`, `SummaryStep`.
10. Página de Importar sin HeroUI ni `CardSkeleton`; `loading.tsx`.
11. Revisar los `data-tour` de `reports`, `recommendations` e `import-button` contra `src/config/tutorials.ts`.
12. Verificar el criterio transitivo: ningún módulo alcanzable desde `app/dashboard/layout.tsx` y `app/dashboard/personal/**` importa `@heroui/react`.
13. `/impeccable audit` y `polish` de las tres pantallas, el diálogo de exportar y el aside móvil; corregir.
14. Documentación (`CLAUDE.md`, `docs/ui.md`, `CHANGELOG.md`).

## Criterios de aceptación

Verificables en código o con `check`, `eslint`, `prettier:check` y `build`:

- [x] Ningún archivo de `src/features/{reports,score,imports,exports}/components/*` importa `@heroui/react` ni `@internationalized/date`.
- [x] `app/dashboard/personal/{reports,recommendations,import}/page.tsx` y sus `loading.tsx` no importan `@heroui/react`.
- [x] `TutorialHelpButton`, `TutorialProvider`, `TutorialAutoStart`, `BusinessSwitcher` y `Logo` no importan `@heroui/react`.
- [x] Ningún módulo alcanzable (import estático) desde `app/dashboard/layout.tsx` o desde cualquier `app/dashboard/personal/**` importa `@heroui/react`.
- [x] `app/dashboard/layout.tsx` no monta el `ToastProvider` de HeroUI; lo montan `app/dashboard/business/layout.tsx` y `app/dashboard/account/layout.tsx`.
- [x] `src/components/dashboard/heroui-compat.ts` no existe y el `Sheet` del aside móvil no pasa `modal={false}`.
- [x] Ningún archivo de este spec usa `CardSkeleton`, `onPress` ni `isDisabled`.
- [x] Cada componente migrado que carga datos exporta su `…Skeleton` en el mismo archivo.
- [x] Existen `loading.tsx` en `personal/reports/`, `personal/recommendations/` y `personal/import/`, cada uno con `LoadingRegion`.
- [x] `actions.ts`, `schemas.ts`, `queries.ts`, `wizard-state.ts`, los parsers de importación, `exports/workbook/*`, `exports/pdf/*` y `app/api/export/[workspaceId]/route.ts` no cambian.
- [x] Las props públicas de `ReportsView`, `ScoreRecommendationsView`, `ExportButton` y `BusinessSwitcher` no cambian.
- [x] Cada `target` de los tours `reports` y `recommendations`, y `import-button`, aparece como `data-tour` en un componente migrado.
- [x] Todo par texto/fondo nuevo queda en la tabla de contraste de `docs/ui.md` y pasa AA en claro y oscuro.
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan, con el lockfile sincronizado.

Verificables en navegador (los prueba el usuario a mano):

- [ ] En Reportes, cambiar de periodo, avanzar y retroceder, y cambiar el tipo de reporte actualiza la URL y los datos como antes.
- [ ] La tabla de categorías se desliza en horizontal dentro de `ScrollTable` en móvil.
- [ ] Exportar `.xlsx`, `.csv` y `.pdf` desde Personal y desde Empresa descarga el archivo con la misma selección que antes.
- [ ] En Recomendaciones, "Ir" lleva a su pantalla, "Ocultar" la mueve a ocultas y "Restaurar" la devuelve, con toast de sonner.
- [ ] Los reportes y las recomendaciones de Empresa se ven y funcionan igual que en Personal.
- [ ] Importar un CSV y un Excel de movimientos recorre todos los pasos y guarda; lo mismo con gastos fijos, pagos de deuda y aportes a meta (SPEC 08b).
- [ ] Deshacer una importación desde el historial pide confirmación y la revierte.
- [ ] El indicador de pasos del asistente anuncia el paso actual al lector de pantalla.
- [ ] El selector Personal / Empresa del aside abre su menú y navega, en escritorio y en el aside móvil.
- [ ] En el aside móvil, Tab no sale del Sheet y Escape lo cierra.
- [ ] El botón de ayuda del header inicia el tour de la pantalla y el inicio automático sigue funcionando.
- [ ] Un error de Zod del servidor se muestra bajo su campo y el lector lo anuncia.
- [ ] Al pasar de skeleton a contenido, el CLS medido con Lighthouse es ≤ 0.05 en las tres pantallas.
- [ ] Los tours de Reportes y Recomendaciones recorren todos sus pasos sin saltarse ninguno, en escritorio y móvil.
- [ ] Todo control interactivo de las tres pantallas, el diálogo de exportar y el aside mide 44 × 44 px o más de área en móvil, tablet y escritorio.
- [ ] Las tres pantallas y el diálogo de exportar no tienen scroll horizontal a 320 px de ancho ni a 200 % de zoom en 1280 px (las tablas se deslizan dentro de `ScrollTable`).
- [ ] `/impeccable audit` de cada pantalla no deja hallazgos críticos ni altos abiertos.

## Decisiones

- **Sí:** criterio de cierre transitivo. "Ninguna pantalla de Personal importa HeroUI" solo vale si también lo cumple lo que la envuelve (layout, header, aside).
- **No:** criterio solo directo. Dejaría HeroUI cargado en toda pantalla de Personal por el shell.
- **Sí:** migrar en sitio `ReportsView`, `ScoreRecommendationsView`, `ExportDialog` y `BusinessSwitcher`, que comparte Empresa. Una sola versión, como en 52a y 52b.
- **Sí:** `ExportDialog` con `FormDialog`, `SegmentedField` y `SelectField`, sin cambiar el flujo. **No:** rediseñar exportar ahora.
- **Sí:** asistente de importar con los mismos pasos; solo cambia la UI. **No:** reordenar o fusionar pasos; tocaría `wizard-state.ts` y sumaría riesgo.
- **No:** tour de Importar. No tiene sección y pediría migración; `import-button` sigue en los tours de otras pantallas.
- **Sí:** Recomendaciones solo se migra. **No:** `RowContextMenu` en recomendaciones; no estaba pedido.
- **Sí:** Reportes con la misma UX. **No:** rango personalizado con calendario; cambia `searchParams` y consultas.
- **Sí:** `BusinessSwitcher` y `Logo` en este spec, aunque sean de Empresa y marca, porque los monta el aside de Personal.
- **Sí:** volver modal el aside móvil y borrar `heroui-compat.ts`. Tras migrar `BusinessSwitcher` no aloja HeroUI, y el foco atrapado es requisito de accesibilidad.
- **Sí:** mover el `ToastProvider` de HeroUI a los layouts de Empresa y cuenta (decidido al implementar el paso 4). **No:** dejarlo en el layout del dashboard; Personal seguiría cargando HeroUI.
- **No:** retirar `HeroUIPortalBridge`, `HeroUIPortalHost`, `heroui-bridge.css` ni el `LabelContext` de `FieldLabel`. Los usan Empresa y cuenta (SPEC 53).
- **No:** migrar `TutorialsSettings`; es pantalla de cuenta (SPEC 53).
- **Sí:** `/impeccable` corrige directo dentro de la dirección de SPEC 51; los cambios grandes se preguntan.
- **Sí:** los criterios de navegador los verifica el usuario a mano, como en SPEC 51, 52a y 52b.

## Riesgos

| Riesgo                                                                                   | Mitigación                                                                                                               |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Migrar en sitio `ReportsView`, `ScoreRecommendationsView` o `ExportDialog` rompe Empresa | Props públicas intactas; pasos 5, 6 y 7 se prueban también en Empresa; criterio específico.                              |
| Volver modal el aside móvil deja inerte algún menú de HeroUI que siga dentro             | Paso 3 justo después de migrar `BusinessSwitcher`; el criterio transitivo garantiza que el aside no trae HeroUI.         |
| El asistente de importar (~3.000 líneas) cambia de comportamiento                        | `wizard-state.ts`, parsers y actions no cambian; criterio por cada destino de importación (SPEC 08 y 08b).               |
| Los selects agrupados de `CategoriesStep` y `LinkStep` pierden encabezados               | `SelectField` con grupos y separador; si no los soporta, se extiende en `forms/` sin cambiar su API actual.              |
| Toasts del `TutorialProvider` en Empresa dejan de verse si sonner no está montado ahí    | Se comprueba que el `Toaster` de sonner se monta en el layout del dashboard (Personal y Empresa) antes del paso 4.       |
| Queda un import transitivo de HeroUI sin detectar                                        | Paso 12 recorre el grafo de imports desde `app/dashboard/layout.tsx` y `app/dashboard/personal/**`; criterio específico. |
| Los `data-tour` se pierden al reescribir el DOM                                          | Criterio que cruza cada `target` de `tutorials.ts` con el código migrado.                                                |

## Siguientes specs: cuándo y qué pedir

| Orden | Spec     | Cuándo se crea        | Cuándo se implementa |
| ----- | -------- | --------------------- | -------------------- |
| 1     | SPEC 52c | Ya creado             | Tras aprobarlo       |
| 2     | SPEC 53  | Tras mergear SPEC 52c | Tras aprobarlo       |

Prompt sugerido para SPEC 53: Empresa, cuenta, auth, MCP y públicas en shadcn; retiro de HeroUI, `@internationalized/date`, `HeroUIPortalBridge`, `HeroUIPortalHost`, `heroui-bridge.css` y el `LabelContext` de `FieldLabel`.

## Qué no entra en este spec

- Empresa, cuenta, auth, MCP, landing y públicas, y el retiro de HeroUI y del puente de portales (SPEC 53).
- Reordenar pasos de importar, tour de Importar, rango personalizado en Reportes, menú contextual en recomendaciones y rediseño de exportar.
- Cambios en server actions, esquemas, consultas, servicios del MCP o tablas.
- Pruebas automatizadas en navegador.

Cada uno de esos, si llega, va en su propio spec.
