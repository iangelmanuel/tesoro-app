# SPEC 51 — Base shadcn, tema nuevo, shell, menús rápidos y skeletons

> **Estado:** Aprobado
> **Depende de:** SPEC 13, SPEC 14, SPEC 15, SPEC 20, SPEC 22, SPEC 27, SPEC 31, SPEC 40, SPEC 50
> **Fecha:** 2026-11-19
> **Objetivo:** Montar shadcn (Base UI, estilo Maia personalizado) con una paleta y tipografía nuevas, y migrar a él el shell del dashboard y sus piezas compartidas, con paleta de comandos, atajos, menú contextual y el patrón de skeletons.

## Por qué existe este spec

Es el segundo de cuatro specs que rehacen la UI (ver SPEC 50). Las pantallas siguen en HeroUI hasta SPEC 52 (Personal) y SPEC 53 (Empresa, cuenta, auth, públicas y retiro de HeroUI).

Este spec fija todo lo que las pantallas van a reusar: tokens, primitivas, shell, componentes compartidos del dashboard, menús rápidos y la regla de skeletons. Si queda bien aquí, 52 y 53 son trabajo de adopción, no de diseño.

La meta de producto es que el usuario llegue a cualquier acción sin buscarla: a un clic desde el header, a un atajo desde el teclado, a un clic derecho desde una fila y a una búsqueda desde ⌘K / Ctrl+K.

## Alcance

**Entra:**

### 1. Instalación de shadcn

- CLI de shadcn con primitivas **Base UI**, estilo **Maia**, Tailwind 4 y `components.json` en la raíz. Versiones exactas, confirmadas contra la doc vigente al arrancar.
- Componentes en **`src/components/ui/`** (convención de shadcn). El código es nuestro: se personaliza ahí, no se envuelve.
- `cn` propio en `src/libs/cn.ts` (`clsx` + `tailwind-merge`). El código nuevo no importa `cn` de `@heroui/react`.
- Dependencias nuevas: las que pida shadcn para Base UI, `class-variance-authority`, `clsx`, `tailwind-merge`, `sonner`, `react-day-picker` y `cmdk`. Sin `vaul`: el Drawer de `base-maia` es el de Base UI (ver Decisiones). Todas con versión exacta.
- Primitivas instaladas y re-diseñadas: `button`, `input`, `textarea`, `label`, `field`, `select`, `combobox`, `checkbox`, `switch`, `radio-group`, `toggle-group`, `tabs`, `dialog`, `alert-dialog`, `sheet`, `drawer`, `popover`, `tooltip`, `dropdown-menu`, `context-menu`, `command`, `calendar`, `skeleton`, `badge`, `avatar`, `separator`, `scroll-area`, `table`, `kbd` y `sonner`.

### 2. Dirección visual con Impeccable (paso con aprobación)

- Antes de escribir tokens, `/impeccable` (shape) presenta **2–3 direcciones** en una hoja comparativa local. Cada dirección trae paleta (claro y oscuro), fuente y una muestra del shell con una tarjeta, una tabla y un diálogo.
- El usuario elige una. Sin esa elección no se avanza.
- **Límites de la paleta:**
  - acento **emerald** en Personal y **naranja** en Empresa; neutro fuera de los espacios;
  - `--brand` sigue en la familia emerald, re-afinado;
  - `--income`, `--expense` y `--balance` distinguibles entre sí, también para daltonismo rojo-verde (además llevan signo e ícono, ver §7);
  - los 12 `--category-*` conservan sus nombres (las claves se guardan en BD); solo cambian sus valores;
  - todo par texto/fondo da AA en claro y oscuro (§7).
- **Fuente:** la propone Impeccable; Inter queda como opción. Montos siempre con `tabular-nums`. Si la fuente cambia y su licencia lo permite (OFL), los PDF exportados la usan (`PDF_FONTS` en `generate-brand-assets.mjs`); si no, siguen con Inter.
- Se mantiene: dashboard oscuro por defecto, públicas siempre en claro (SPEC 40), un solo título por pantalla (`DashboardTitle`), tarjetas sin borde, campos con relleno suave.

### 3. Tokens

- Nombres finales del sistema nuevo en `src/styles/globals.css`:
  - base de shadcn: `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted-foreground`, `--destructive`, `--border`, `--input`, `--ring`, `--sidebar-*`, `--chart-1` … `--chart-5`, `--radius`;
  - **renombres propios** para no chocar con HeroUI mientras conviven: `--highlight` (fondo de hover y seleccionado; en shadcn es `--accent`) y `--subtle` (fondo atenuado; en shadcn es `--muted`);
  - propios que siguen: `--brand`, `--income`, `--expense`, `--balance`, `--category-*`, `--field-*`, `--surface-shadow`, `--overlay-shadow`.
- **Primario por espacio:** `WorkspaceThemeRoot` + `getWorkspaceTheme(pathname)` siguen poniendo `data-workspace`; `globals.css` cambia `--primary` (y `--ring`) con `:has()`. Nunca por props.
- **Puente HeroUI** en `src/styles/heroui-bridge.css`, importado después de `@heroui/styles`: mapea los tokens de HeroUI a los nuevos (`--accent: var(--primary)`, `--muted: var(--muted-foreground)`, `--surface: var(--card)`, `--overlay: var(--popover)`, `--danger: var(--destructive)`…). Así las pantallas aún en HeroUI toman la paleta nueva. SPEC 53 borra el archivo.
- `src/features/exports/workbook/theme.ts` (y por él `pdf/theme.ts`) se actualiza con los valores nuevos de `--income`, `--expense`, `--balance`, `--muted-foreground` y `--chart-*`.
- Si `--brand` cambia, se actualiza `BRAND_HEX` (SPEC 50) y se corre `pnpm brand:assets`.

### 4. Shell del dashboard y piezas compartidas

Se migran a `src/components/ui/` todos los archivos de `src/components/dashboard/**` y `src/components/charts/**`, conservando sus props públicas para que las pantallas en HeroUI no cambien:

- **Aside** (`app-sidebar.tsx`, `sidebar/`): grupos de SPEC 31, ancho ajustable 240–360 px con la cookie `tesoro-sidebar-width`, selector Personal / Empresa (`workspace-tabs.tsx`) arriba y menú de cuenta (`user-menu.tsx`, con tema, ocultar montos y ayuda) abajo.
- **Header:** `DashboardTitle`, botón de acción rápida rediseñado (`quick-actions*.tsx`), disparador visible de la paleta de comandos con su atajo (`Kbd`) y `hide-amounts-toggle.tsx`.
- **Móvil (< 768 px):** `mobile/` (barra inferior, hoja de acciones rápidas con `Drawer`, aside como `Sheet`). Mismas acciones que hoy (SPEC 15, 18, 20).
- **Compartidos:** `StatCard`, `CardHeading`, `HelpHint`, `EmptyState`, `CardEmpty`, `Amount`, `MonthNav`, `MonthSwitcher`, `DetailSheet`, `DeleteDialog`, `RowActions`, `ScrollTable` (las tablas; no existe un `DataRows` aparte), `SortableList`, `tone.ts`, `surface.ts`.
- **Gráficas:** `ChartCard`, `ChartContainer`, `ChartLegend`, `ChartTooltip`, `chart-style.ts`. Siguen con Recharts y colores de tokens.
- **Toasts:** `<Toaster />` de sonner montado en `app/dashboard/layout.tsx`, abajo a la derecha en escritorio y arriba en móvil. El `ToastProvider` de HeroUI sigue montado hasta SPEC 53 para las pantallas aún no migradas.
- **Tours (SPEC 27):** driver.js se queda. `tour-theme.css` usa los tokens nuevos y se actualizan los selectores de los pasos que apuntan al shell.

### 5. Menús rápidos

- **Paleta de comandos** (`src/components/dashboard/command/`), con `Command` dentro de un `Dialog`:
  - abre con ⌘K / Ctrl+K y con el disparador del header; en móvil, desde la hoja de acciones rápidas;
  - grupos: **Acciones** (nuevo movimiento, traspaso, pagar deuda, aportar a meta, importar, cambiar tema, ocultar montos), **Ir a** (todas las pantallas del espacio activo y de la cuenta, desde `SITE.navigation`) y **Tus datos** (cuentas, deudas y metas del espacio activo, por nombre);
  - **Tus datos** se carga la primera vez que se abre, con la server action `loadCommandEntities(workspaceId)` (RLS y `requireWorkspace`), y se guarda en memoria hasta cambiar de espacio;
  - elegir una entidad abre su Sheet de detalle o su página;
  - muestra el atajo de cada acción a la derecha.
- **Atajos de teclado** (`src/config/shortcuts.ts` + `src/components/dashboard/shortcuts/`):
  - `⌘K` / `Ctrl+K`: paleta; `N`: nuevo movimiento; `T`: traspaso; `?`: hoja de atajos;
  - secuencias `G` + letra (máx. 1 s entre teclas). Personal: `R` Resumen, `M` Movimientos, `C` Cuentas, `I` Ingresos fijos, `F` Gastos fijos, `P` Presupuestos, `E` Metas, `D` Deudas, `O` Reportes, `S` Recomendaciones. Empresa: `R` Resumen, `M` Movimientos, `C` Cuentas, `F` Flujo de caja, `A` Ajustes;
  - la letra vive en cada ítem de `SITE.navigation` (campo `shortcut`), no duplicada;
  - no se disparan dentro de `input`, `textarea`, `select`, `[contenteditable]` ni con un diálogo abierto;
  - se pueden apagar en **Cuenta → Preferencias** (switch "Atajos de teclado"). Se guarda en la cookie `tesoro-shortcuts` (`on` / `off`, por defecto `on`). `⌘K` / `Ctrl+K` sigue activo aunque estén apagados.
- **Menú contextual en filas:** `RowActions` recibe la misma lista de acciones y la muestra en dos lugares:
  - el botón ⋯ (`DropdownMenu`), como hoy;
  - `RowContextMenu`, un envoltorio con `ContextMenu` para clic derecho y pulsación larga (500 ms) en táctil.
  - Este spec crea ambos y mantiene la API de `RowActions`. Cada pantalla envuelve sus filas con `RowContextMenu` al migrarse (SPEC 52 y 53).
- **Acción rápida rediseñada:** el botón del header y la hoja móvil comparten la misma lista de acciones con la paleta (una sola fuente en `src/components/dashboard/quick-actions-context.tsx`).

### 6. Patrón de skeletons

- **Regla:** cada componente que carga datos exporta su skeleton **en el mismo archivo** (`StatCard` → `StatCardSkeleton`). Ambos se arman con el mismo contenedor de layout (mismas filas, columnas, alturas y radios). Solo cambia el contenido por bloques `Skeleton`.
- `CardSkeleton` genérico se retira del código nuevo; se conserva hasta SPEC 53 para las pantallas aún no migradas.
- Streaming: `Suspense` por tarjeta y un `loading.tsx` por ruta que compone los skeletons de esa pantalla.
- En este spec se hacen los del shell y los compartidos: aside, header, `StatCard`, `ChartCard`, `ScrollTable`, `DetailSheet`, `MonthSwitcher`, y `app/dashboard/loading.tsx`.
- Accesibilidad: la región que carga lleva `aria-busy="true"` y un texto solo para lector de pantalla ("Cargando…"). Con `prefers-reduced-motion` no hay brillo animado, solo el bloque estático.

### 7. Accesibilidad (WCAG 2.2 AA + extras)

- Contraste AA: 4.5:1 texto, 3:1 texto grande, marcas gráficas y anillo de foco, en claro y oscuro. Cada par nuevo queda en la tabla de `docs/ui.md`.
- Foco siempre visible con `--ring`, nunca quitado sin reemplazo.
- Áreas táctiles de **44 × 44 px mínimo** en todos los tamaños de pantalla (el área puede crecer con padding sin cambiar el dibujo).
- Enlace "Saltar al contenido" como primer elemento enfocable del dashboard; landmarks `nav`, `header`, `main`.
- `Amount` expone el monto completo al lector ("menos 120.000 pesos"); con montos ocultos lee "Monto oculto".
- Ingresos y gastos no dependen solo del color: llevan signo y un ícono.
- Toasts en región `aria-live="polite"`; errores en `assertive`.
- Reflujo sin scroll horizontal a 320 px de ancho y a 200 % de zoom.
- Toda animación respeta `prefers-reduced-motion`.

### 8. Documentación

- `CLAUDE.md` (UI y tema): shadcn + Base UI en `src/components/ui/`, tokens nuevos, puente HeroUI temporal, regla de skeletons, atajos. Se quita la prohibición de `src/components/ui/`.
- `docs/ui.md`: tokens y tabla de contraste nuevas, primitivas, menús rápidos, atajos, regla de skeletons y convivencia con HeroUI.
- `PRODUCT.md`: restricciones visuales y tipografía nuevas.
- `docs/producto.md`: paleta de comandos y atajos.
- `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Migrar las pantallas de Personal y sus formularios, incluidos `src/components/forms/*` (`DatePickerField`, `TimePickerField`, selects de cuenta y categoría) (**SPEC 52**).
- Migrar Empresa, cuenta, auth, legales, `/mcp`, landing y header público; quitar `@heroui/react`, `@heroui/styles`, `react-aria`, `@internationalized/date`, `CardSkeleton` y `heroui-bridge.css` (**SPEC 53**).
- Buscar movimientos sueltos en la paleta de comandos.
- Atajos configurables por el usuario.
- Reemplazar driver.js.
- Re-renderizar los videos de la landing.
- Logo (SPEC 50).

## Modelo de datos

Este spec no agrega tablas ni migraciones.

Estructuras nuevas en el cliente y la configuración:

```ts
// src/config/site.ts — cada ítem de navegación gana su atajo
type NavItem = {
  name: string
  href: Route
  icon: IconName
  shortcut?: string // letra tras "G", ej. "M"
}

// src/config/shortcuts.ts
export const SHORTCUTS = {
  commandPalette: { keys: ["mod", "k"], label: "Buscar y ejecutar" },
  newTransaction: { keys: ["n"], label: "Nuevo movimiento" },
  newTransfer: { keys: ["t"], label: "Traspaso" },
  help: { keys: ["?"], label: "Atajos de teclado" },
  goPrefix: "g"
} as const

export const SHORTCUTS_COOKIE = "tesoro-shortcuts" // "on" | "off"

// src/components/dashboard/command/actions.ts (server action)
type CommandEntity = {
  id: string
  kind: "account" | "debt" | "goal"
  name: string
  href: Route
}
// loadCommandEntities(workspaceId: string): Promise<CommandEntity[]>

// src/components/dashboard/row-actions.tsx — API sin cambios (la real), una
// sola lista para RowActions y RowContextMenu
interface RowAction {
  id: string
  label: string
  icon: ReactNode
  onAction: () => void
  destructive?: boolean
  isDisabled?: boolean
}
```

## Plan de implementación

1. Hoja de direcciones con `/impeccable` (paleta, fuente, muestra del shell). El usuario elige una.
2. Instalar shadcn (Base UI, Maia), `components.json`, `src/libs/cn.ts` y las dependencias. La app sigue igual.
3. Escribir los tokens nuevos en `globals.css` y `heroui-bridge.css`. Las pantallas en HeroUI ya se ven con la paleta nueva.
4. Fuente nueva (si cambia) en `app/layout.tsx` y `--font-sans`.
5. Instalar y re-diseñar las primitivas de `src/components/ui/`, una familia por commit (botones y campos; overlays; menús; datos y skeleton).
6. Migrar compartidos (`StatCard`, `CardHeading`, `HelpHint`, `EmptyState`, `Amount`, `MonthNav`, `DetailSheet`, `DeleteDialog`, `DataRows`…) con sus skeletons, manteniendo props.
7. Migrar gráficas (`src/components/charts/*`) con sus skeletons.
8. Migrar el aside, el header y el shell móvil, con el skip link y `app/dashboard/loading.tsx`.
9. Montar el `Toaster` de sonner y re-tematizar `tour-theme.css`.
10. `RowActions` con `DropdownMenu` y el nuevo `RowContextMenu`.
11. Paleta de comandos con Acciones e Ir a.
12. `loadCommandEntities` y el grupo Tus datos.
13. Atajos, `shortcut` en `SITE.navigation`, hoja `?` y switch en Preferencias con la cookie.
14. Actualizar `workbook/theme.ts`, `BRAND_HEX` y, si aplica, `PDF_FONTS`; correr `pnpm brand:assets`.
15. `/impeccable audit` y `polish` sobre el shell en claro, oscuro, móvil, tablet y escritorio; corregir.
16. Documentación (`CLAUDE.md`, `docs/ui.md`, `PRODUCT.md`, `docs/producto.md`, `CHANGELOG.md`).

## Criterios de aceptación

- [ ] El usuario eligió una de las direcciones de Impeccable antes de escribir tokens.
- [ ] `components.json` declara Base UI y el estilo Maia; las primitivas viven en `src/components/ui/`.
- [ ] Ningún archivo de `src/components/dashboard/**`, `src/components/charts/**` ni `src/components/ui/**` importa `@heroui/react`.
- [ ] Las pantallas aún en HeroUI se ven con la paleta nueva y siguen funcionando (registrar, editar y eliminar un movimiento en Personal y en Empresa).
- [ ] En `/dashboard/personal/**` el primario es emerald; en `/dashboard/business/[id]/**`, naranja; en `/dashboard/account/**`, neutro.
- [ ] Todo par texto/fondo y el anillo de foco listados en `docs/ui.md` pasan AA en claro y oscuro.
- [ ] Ctrl+K (⌘K en macOS) abre la paleta desde cualquier pantalla del dashboard, aun con los atajos apagados.
- [ ] Buscar el nombre de una cuenta, deuda o meta del espacio activo la muestra en Tus datos y al elegirla abre su detalle.
- [ ] La paleta no muestra entidades de otro espacio ni de otro usuario.
- [ ] `N` abre el diálogo de nuevo movimiento y `G` luego `M` va a Movimientos, en Personal y en Empresa.
- [ ] Escribir "n" o "g" dentro de un campo de texto no dispara ningún atajo.
- [ ] Con "Atajos de teclado" apagado en Preferencias, `N`, `T`, `?` y `G`+letra no hacen nada, y sigue así al recargar.
- [ ] `?` abre la hoja de atajos con todos los de `SHORTCUTS` y los `G`+letra del espacio activo.
- [ ] Clic derecho sobre una fila que usa `RowContextMenu` muestra las mismas acciones que su botón ⋯; en táctil, una pulsación de 500 ms también.
- [ ] El botón de acción rápida, la hoja móvil y el grupo Acciones de la paleta muestran las mismas acciones.
- [ ] Cada componente migrado que carga datos exporta su `…Skeleton` en el mismo archivo.
- [ ] Al pasar de skeleton a contenido en `/dashboard/personal`, el CLS medido con Lighthouse es ≤ 0.05.
- [ ] Con `prefers-reduced-motion: reduce`, los skeletons no animan.
- [ ] Tab desde la carga muestra primero "Saltar al contenido" y lleva el foco a `main`.
- [ ] Todo control interactivo del shell mide 44 × 44 px o más de área en móvil, tablet y escritorio.
- [ ] Un lector de pantalla lee un gasto como "menos" seguido del monto completo, y "Monto oculto" con montos ocultos.
- [ ] El shell no tiene scroll horizontal a 320 px de ancho ni a 200 % de zoom en 1280 px.
- [ ] Los tours de SPEC 27 que pasan por el aside y el header siguen apuntando a su elemento.
- [ ] El Excel y el PDF exportados usan los colores nuevos de ingresos, gastos y gráficas.
- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan, con el lockfile sincronizado.

## Decisiones

- **Sí:** cuatro specs (50 logo, 51 base, 52 Personal, 53 resto y retiro). Un solo spec sería un PR imposible de revisar.
- **Sí:** Base UI. Mantenida activamente, buena accesibilidad, combobox y menús completos.
- **No:** Radix. Mantenimiento más lento.
- **Sí:** estilo Maia como punto de partida, personalizado con Impeccable. Redondeado y espacioso, encaja con tarjetas sin borde y usuarios no expertos.
- **No:** Nova, Lyra ni Mira. Más densos o más técnicos de lo que pide el público.
- **Sí:** paleta nueva propuesta por Impeccable y aprobada por el usuario, con límites fijos (acentos por espacio, `--brand` emerald, claves de categoría).
- **Sí:** HeroUI y shadcn conviven en master con un puente de tokens. Cada spec se mergea y la app nunca se rompe.
- **No:** rama larga de integración. Merge final enorme y conflictos con lo que siga entrando.
- **Sí:** `--highlight` y `--subtle` en vez de `--accent` y `--muted` de shadcn. HeroUI ya usa esos nombres con otro significado; renombrar evita el choque y no hay que volver a renombrar en 53.
- **Sí:** `src/components/ui/`. Es la convención de shadcn y el código es nuestro. Se levanta la regla anterior de CLAUDE.md.
- **Sí:** migrar todos los compartidos del dashboard en este spec. Las pantallas los heredan sin tocarlas.
- **Sí:** sonner, Calendar de shadcn (react-day-picker), combobox de Base UI y el Drawer de Base UI. Stack estándar de shadcn. **No:** vaul; al implementar, el `drawer` de `base-maia` ya era de Base UI y se quitó la dependencia.
- **Sí:** `cn` propio con `clsx` + `tailwind-merge`, aunque shadcn 4.23 importa el paquete `cn`: tras cada `shadcn add` se reescribe el import a `@/libs/cn`.
- **Sí:** `components.json` escrito a mano y el CLI solo para `add`. `shadcn init` reescribía `globals.css` y la app debía seguir igual en el paso 2.
- **Sí:** mientras conviva HeroUI, los paneles de Base UI que alojan menús o diálogos de HeroUI (`DetailSheet`, aside móvil) van con `modal={false}` y un filtro de cierre (`heroui-compat.ts`). Tab puede salir del panel hasta SPEC 53.
- **Sí:** `--brand` se queda en el emerald del isotipo; la dirección elegida no pedía re-afinarlo y `BRAND_HEX` no cambia.
- **Sí:** dirección visual "Señalética" (Impeccable): cada pantalla es una estación con la letra de su atajo G en el aside y el espacio activo es la línea encendida. Atkinson Hyperlegible Next como fuente.
- **Sí:** driver.js se queda re-tematizado. Reemplazarlo no aporta a este objetivo.
- **Sí:** paleta con pantallas, acciones y entidades; sin movimientos. Buscar movimientos requiere consulta paginada y es otro spec.
- **Sí:** entidades cargadas al abrir la paleta por primera vez. No pesa en cada navegación.
- **Sí:** atajos de una tecla y secuencias `G`+letra, apagables. WCAG 2.1.4 pide poder apagar atajos de un solo carácter.
- **Sí:** preferencia de atajos en cookie, como el ancho del aside. Es por navegador y no requiere migración.
- **No:** atajos configurables. Complejidad sin demanda.
- **Sí:** skeleton en el mismo archivo y con el mismo contenedor que su componente. Es la forma de garantizar que el dibujo coincida.
- **Sí:** 51 crea `RowContextMenu`; cada pantalla lo adopta al migrarse. Evita tocar todas las tablas dos veces.
- **Sí:** áreas táctiles de 44 px en todo tamaño. Ayuda también a usuarios con mouse y baja precisión.

## Riesgos

| Riesgo                                                                        | Mitigación                                                                                                      |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `@heroui/styles` y el tema de shadcn definen las mismas variables de Tailwind | `heroui-bridge.css` se importa después y se verifica pantalla por pantalla; renombres `--highlight`/`--subtle`. |
| Dos sistemas de toasts a la vez (HeroUI y sonner)                             | El toast de HeroUI usa la misma esquina y estilo que sonner vía el puente. Temporal hasta SPEC 53.              |
| Un compartido migrado cambia su comportamiento y rompe una pantalla en HeroUI | Props públicas intactas; criterio de registrar, editar y eliminar en ambos espacios.                            |
| Atajos de una tecla chocan con lectores de pantalla o extensiones             | Apagables en Preferencias; nunca dentro de campos ni con diálogos abiertos.                                     |
| `loadCommandEntities` expone datos de otro espacio                            | Resuelve el espacio con `requireWorkspace` y consulta con RLS; criterio específico.                             |
| La paleta nueva rompe el contraste de algún par heredado                      | Tabla de contraste completa en `docs/ui.md` como criterio de aceptación.                                        |
| El bundle crece con dos librerías de UI                                       | Temporal; SPEC 53 retira HeroUI. Se revisa el tamaño en `pnpm build` al cerrar este spec.                       |
| Los selectores de los tours dejan de existir al cambiar el DOM del shell      | Pasos con `data-tour` estables en vez de clases.                                                                |

## Siguientes specs: cuándo y qué pedir

El rediseño sigue este orden. Cada spec se escribe con `/spec` **solo cuando el anterior está en `Implementado` y mergeado en master**, porque necesita los nombres reales de componentes, tokens y skeletons que dejó el anterior.

| Orden | Spec    | Cuándo se crea                                                  | Cuándo se implementa |
| ----- | ------- | --------------------------------------------------------------- | -------------------- |
| 1     | SPEC 50 | Ya creado                                                       | Primero              |
| 2     | SPEC 51 | Ya creado                                                       | Tras mergear SPEC 50 |
| 3     | SPEC 52 | Tras mergear SPEC 51 (paleta, fuente y primitivas ya definidas) | Tras aprobar SPEC 52 |
| 4     | SPEC 53 | Tras mergear SPEC 52 (Personal ya sin HeroUI)                   | Tras aprobar SPEC 53 |

Antes de escribir cada uno, revisa que `docs/ui.md` tenga la paleta, la fuente y la lista de primitivas finales del spec anterior. El `/spec` las lee de ahí.

### Prompt para SPEC 52 (copiar en `/spec`)

```text
SPEC 52: migrar a shadcn todas las pantallas de Personal, siguiendo la base de SPEC 51
(Base UI, estilo Maia personalizado, tokens nuevos, src/components/ui/, regla de skeletons,
RowContextMenu, atajos y paleta de comandos).

Entra:
- Pantallas: Resumen, Movimientos, Cuentas, Ingresos fijos, Gastos fijos, Presupuestos,
  Metas, Deudas, Reportes, Recomendaciones e Importar, con sus Sheets de detalle.
- Todos sus diálogos (TransactionDialog, TransferDialog, PaymentDialog, aportes de meta,
  cobros de Me deben, importadores) y src/components/forms/* (DatePickerField con Calendar
  + Popover, TimePickerField, selects de cuenta y categoría con Combobox de Base UI).
- Formularios siguen con useActionState + Zod y las mismas server actions; solo cambia la UI.
- Toasts de esas pantallas pasan a sonner.
- Cada componente que carga datos exporta su Skeleton en el mismo archivo y cada ruta
  tiene su loading.tsx; CLS ≤ 0.05 por pantalla.
- Filas envueltas con RowContextMenu.
- Pasos de los tours con data-tour estables.
- /impeccable audit y polish por pantalla en claro, oscuro, móvil, tablet y escritorio.
- Accesibilidad AA + extras de SPEC 51 (44 px, foco, Amount leído completo, reflujo a 320 px).

Fuera: Empresa, cuenta, auth, públicas y retiro de HeroUI (SPEC 53).
Pregúntame si conviene partirlo en 52a (Día a día y Tu plan) y 52b (Entiende tu dinero e Importar).
```

### Prompt para SPEC 53 (copiar en `/spec`)

```text
SPEC 53: migrar a shadcn lo que queda en HeroUI y retirar HeroUI del proyecto,
siguiendo SPEC 51 y SPEC 52.

Entra:
- Empresa: estado vacío para crear empresa, Resumen, Movimientos, Cuentas, Flujo de caja
  y Ajustes, con sus diálogos y Sheets.
- Cuenta: General, Preferencias, Seguridad y Agentes.
- Auth (sign-in, sign-up), /account-deleted y consentimiento OAuth (app/oauth/consent/).
- Públicas en claro: landing, header y footer públicos, menú móvil, legales y /mcp,
  con el logo de SPEC 50.
- Skeletons en el mismo archivo + loading.tsx por ruta, RowContextMenu en filas,
  /impeccable audit y polish, accesibilidad AA + extras de SPEC 51.
- Retiro: @heroui/react, @heroui/styles, react-aria, @internationalized/date,
  ToastProvider de HeroUI, CardSkeleton genérico y src/styles/heroui-bridge.css.
  Cero imports de "@heroui" en el repo.
- Limpieza de CLAUDE.md, docs/ui.md y PRODUCT.md (sin menciones de HeroUI) y CHANGELOG.

Fuera: re-render de los videos de la landing con la UI y el logo nuevos (spec propio después).
```

## Qué no entra en este spec

- Pantallas de Personal y `src/components/forms/*` (SPEC 52).
- Empresa, cuenta, auth, legales, `/mcp`, landing y retiro de HeroUI, `react-aria` y `@internationalized/date` (SPEC 53).
- Búsqueda de movimientos en la paleta.
- Atajos configurables.
- Reemplazo de driver.js.
- Videos de la landing.
- Logo (SPEC 50).

Cada uno de esos, si llega, va en su propio spec.
