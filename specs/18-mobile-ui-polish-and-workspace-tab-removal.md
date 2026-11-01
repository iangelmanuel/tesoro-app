# SPEC 18 — Pulido de la UI móvil: sin tab superior, filtros en hoja y tablas como tarjetas

> **Estado:** Implementado
> **Depende de:** SPEC 14, SPEC 15
> **Fecha:** 2026-11-01
> **Objetivo:** Que en el teléfono la app gane espacio útil y se lea sin cortes: se quita el tab Personal / Empresa (queda solo en el aside), los filtros de Movimientos se compactan en una hoja y las tablas de resumen y reportes pasan a tarjetas.

## Por qué existe este spec

SPEC 15 puso un tab sticky Personal / Empresa bajo el header y dejó pendiente un 15b (tablas, formularios, gráficas) que nunca se escribió. Al usar la app en un teléfono real aparecen cuatro problemas:

1. **El tab sticky quita altura** en todas las pantallas. Cambiar de espacio es raro; ya existe el mismo selector arriba del aside (Drawer en móvil).
2. **"Últimos movimientos"** se corta: la fecha se parte en 4 líneas ("1 / de / nov / de / 2026"), la categoría queda fuera de la pantalla y hay scroll horizontal.
3. **Filtros de Movimientos** ocupan unas 5 filas (buscar, mes, "Todos los meses", Tipo, Categoría, Cuenta, Categorías) antes de ver un solo movimiento.
4. **Tarjeta de meta**: el porcentaje se parte ("32 / %") y las filas Faltan / Fecha objetivo / Aporte sugerido quedan apretadas.

Este spec cubre esos cuatro y aplica el mismo criterio a las demás tablas de resumen y reportes. Formularios a pantalla completa y gráficas en pantallas angostas siguen fuera (ver "Lo que no entra").

## Alcance

**Entra:**

- **Quitar el tab superior móvil.**
  - Borrar `src/components/dashboard/mobile/mobile-workspace-tabs.tsx` y su uso (con el `Suspense` y el `Skeleton` de relleno) en `app/dashboard/layout.tsx`.
  - El selector Personal / Empresa queda solo en el aside (`WorkspaceTabs` dentro de `app-sidebar.tsx`), que en móvil abre el Drawer con la hamburguesa del header. No se agrega otro acceso ni indicador en el header.
  - `WORKSPACE_TABS` y `getActiveWorkspaceTab` de `workspace-tabs.tsx` se quedan: los usa el aside.
  - Se revisa que no quede `sticky top-16`, ni padding que reservara la fila del tab, y que el `<main>` conserve su padding inferior para la barra inferior.
- **"Últimos movimientos" como lista de tarjetas en `< 768 px`** (`src/features/reports/components/recent-transactions.tsx`):
  - cada fila es una tarjeta: descripción (hasta 2 líneas) con el monto a la derecha, y debajo la fecha corta (`1 nov`) y la `CategoryBadge`;
  - sin scroll horizontal y sin parte de la fecha en varias líneas;
  - en `>= 768 px` queda la tabla actual;
  - las filas usan las clases de `src/components/dashboard/surface.ts`, sin borde.
- **Filtros de Movimientos en hoja en `< 768 px`** (`src/features/transactions/components/transactions-filters.tsx`):
  - visibles siempre: buscador a todo el ancho y fila `‹ Mes ›` junto a un botón **Filtros** con un contador de filtros activos (tipo, categoría, cuenta; "Todos los meses" cuenta como activo);
  - dentro de la hoja (`Drawer` inferior, igual que `quick-sheet.tsx`): **Tipo**, **Categoría**, **Cuenta**, el alternador "Todos los meses / Ver por mes" y el acceso a **Categorías**;
  - un botón "Limpiar filtros" dentro de la hoja cuando hay filtros activos;
  - la hoja aplica los cambios al elegirlos (misma navegación por URL de hoy, `router.replace`), sin botón "Aplicar";
  - en `>= 768 px` los filtros quedan como están.
  - La lógica (`navigate`, debounce de búsqueda, `FilterSelect`) no se duplica: se reutiliza y solo cambia la composición por ancho.
- **La tabla de Movimientos (`transactions-table.tsx`) no se toca**: se queda como está en todos los anchos.
- **Otras tablas de resumen y reportes como tarjetas en `< 768 px`**, solo las que hoy se cortan o hacen scroll horizontal en 360 px:
  - `src/features/reports/components/category-summary-table.tsx`;
  - `src/features/cash-flow/components/cash-flow-table.tsx` (Empresa);
  - `src/features/recurring-expenses/components/recurring-expenses-list.tsx`;
  - si una de esas ya cabe sin scroll en 360 px, se deja igual y se anota en la sección Decisiones al implementar;
  - las tablas del asistente de importación (`preview-step.tsx`, `table-step.tsx`) quedan fuera.
  - Las tarjetas comparten un patrón (fila con título + monto y línea secundaria), no cada tabla su propio markup.
- **Tarjeta de meta** (`goal-summary.tsx`, `goals-card.tsx`):
  - el porcentaje no se parte: `whitespace-nowrap` y `shrink-0`, con `tabular-nums`;
  - en móvil, Faltan / Fecha objetivo / Aporte mensual sugerido se muestran como filas etiqueta–valor de una línea cada una, sin que el valor se desborde, con el monto alineado a la derecha;
  - el chip de estado y el título no se pisan con el menú de acciones (⋮) en 360 px.
- **Pasada general en 360 px y 390 px** de las pantallas de Personal y Empresa: ningún texto numérico (fechas, porcentajes, montos) se parte en varias líneas y no hay scroll horizontal de página. Los desbordes que aparezcan se corrigen si son de una línea (clases); si exigen rediseñar un componente, se anotan como pendiente en `docs/ui.md`.
- **Documentación:**
  - `docs/ui.md`, sección "Móvil": quitar el tab sticky, explicar que el selector de espacio vive solo en el aside, y documentar el patrón de tarjetas y la hoja de filtros;
  - `CLAUDE.md` (sección "UI y tema"): ajustar la línea del tab sticky;
  - `specs/15-mobile-quick-actions-sheet.md`: nota de que el tab superior fue retirado por SPEC 18;
  - `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Formularios y diálogos a pantalla completa en móvil.
- Gráficas legibles en pantallas angostas.
- Lighthouse móvil ≥ 90 (pendiente de 15b).
- Cambios en la tabla de Movimientos.
- Tablas del asistente de importación.
- Cualquier cambio en `>= 768 px` (tablet y escritorio quedan como en SPEC 14).
- Cambios de datos o de esquema.

## Modelo de datos

No hay datos nuevos ni migraciones. El estado de la hoja de filtros (abierta/cerrada) es local al componente; los filtros siguen en la URL como hoy.

## Plan de implementación

1. **Quitar el tab móvil.**
   - Borrar `mobile-workspace-tabs.tsx` y su `Suspense` en `app/dashboard/layout.tsx`; revisar offsets y padding.
   - Queda funcional: el cambio de espacio se hace desde el Drawer.
2. **Tarjeta de meta.**
   - Ajustes de clases en `goal-summary.tsx` y `goals-card.tsx`; verificar en 360 px.
3. **Patrón de tarjetas y "Últimos movimientos".**
   - Crear el componente compartido de fila-tarjeta (ubicación a decidir al implementar, junto a `surface.ts` en `src/components/dashboard/`).
   - Aplicarlo en `recent-transactions.tsx` con `md:hidden` / `hidden md:block` para alternar con la tabla.
4. **Filtros de Movimientos.**
   - Separar en `transactions-filters.tsx` la barra móvil (buscador, mes, botón Filtros) y la hoja con los selects, reutilizando `navigate` y `FilterSelect`.
   - Contador de filtros activos y "Limpiar filtros" en la hoja.
5. **Resto de tablas.**
   - Revisar en 360 px `category-summary-table.tsx`, `cash-flow-table.tsx` y `recurring-expenses-list.tsx`; convertir con el patrón del paso 3 las que se corten.
6. **Pasada general.**
   - Recorrer Personal y Empresa en 360 y 390 px y corregir desbordes de una línea; anotar los demás en `docs/ui.md`.
7. **Docs.**
   - `docs/ui.md`, `CLAUDE.md`, nota en SPEC 15 y `CHANGELOG.md`.

## Criterios de aceptación

- [x] En `< 768 px` no hay fila sticky Personal / Empresa bajo el header en ninguna ruta del dashboard.
- [x] `mobile-workspace-tabs.tsx` no existe y `grep -r MobileWorkspaceTabs src app` no devuelve nada.
- [x] El Drawer del aside (hamburguesa) sigue mostrando Personal / Empresa y permite cambiar de espacio; el primario cambia de verde a naranja al hacerlo.
- [ ] En `>= 768 px` el aside y el resto del dashboard se ven igual que antes de este spec.
- [x] El contenido de cada pantalla empieza más arriba que antes (la fila del tab ya no reserva altura) y la barra inferior no tapa contenido.
- [ ] En 360 px, "Últimos movimientos" no tiene scroll horizontal; cada fila muestra descripción, monto, fecha corta y categoría.
- [ ] En 360 px ninguna fecha, monto ni porcentaje de las pantallas de Personal y Empresa ocupa más de una línea.
- [ ] En 360 px el porcentaje de la tarjeta de meta ("32 %") queda en una línea y las tres filas de datos de la meta caben sin desbordar.
- [ ] En 360 px Movimientos muestra buscador, mes y botón "Filtros" antes de la tabla, en no más de dos filas de controles.
- [ ] El botón "Filtros" muestra el número de filtros activos; elegir Tipo, Categoría o Cuenta en la hoja actualiza la URL y los resultados, y "Limpiar filtros" los reinicia.
- [ ] En `>= 768 px` los filtros de Movimientos siguen como antes.
- [x] La tabla de Movimientos es idéntica en todos los anchos.
- [ ] Los controles nuevos (botón Filtros, selects de la hoja, filas de tarjeta con acción) miden 44 px o más de alto táctil.
- [ ] Los pares texto/fondo nuevos cumplen AA en claro y oscuro.
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [x] `docs/ui.md`, `CLAUDE.md` y `CHANGELOG.md` están actualizados.

> Verificados en código y con `pnpm`; los criterios sin marcar (tamaños en 360 px, hoja de filtros, contraste, `>= 768 px` sin cambios) quedan pendientes de revisión visual en el teléfono.

## Decisiones

- **El selector de espacio vive solo en el aside.** El usuario pidió quitar el tab sticky porque le quita espacio; cambiar de espacio es raro frente a registrar y consultar. Se descartó dejar una etiqueta de espacio en el header: el cambio de color primario ya indica dónde está el usuario.
- **Tablas de movimientos con filtros se quedan como están.** Pedido explícito del usuario; solo "Últimos movimientos" (la de las capturas) y las demás tablas de resumen cambian. Se descartó convertir también la tabla de Movimientos para no tocar la paginación, la selección y las acciones de fila.
- **Tarjetas en lugar de tabla compacta** para las tablas que cambian. Una tabla compacta pierde la categoría y sigue obligando a scroll en 360 px; las tarjetas conservan toda la información.
- **Filtros en hoja inferior** en vez de chips deslizables: no obliga a deslizar para descubrir filtros y reutiliza el patrón de `Drawer` de SPEC 15. Se descartó dejarlos solo reordenados porque ahorra poca altura.
- **La hoja de filtros aplica al elegir**, sin botón "Aplicar": igual que hoy en escritorio y sin estado intermedio que reconciliar con la URL.
- **Alcance acotado a tablas y filtros.** "Mejorar en general" se leyó como tablas y filtros de toda la app más una pasada de desbordes; formularios y gráficas siguen en un spec propio para no mezclar cuatro dominios.
- **Qué tablas se convierten se confirma al implementar** mirando 360 px, porque el spec no midió cada una. Las que ya caben se dejan.
- **Resultado:** se convirtieron `cash-flow-table` (5 columnas) y `recurring-expenses-list` (7 columnas). `category-summary-table` se dejó como tabla: en móvil ya oculta Movimientos y Promedio y quedan 3 columnas (estimado, sin medir en 360 px).
- **Fechas y porcentajes sin partirse** se resolvió en el formateador (`formatDate`, `formatShortDate`, `formatPercent` con espacio duro) en vez de clases por pantalla.
- **"Limpiar filtros" de la hoja** reinicia tipo, categoría, cuenta y vuelve al mes actual; no toca el buscador, que está fuera de la hoja.
- **Añadido al implementar:** "Próximos pagos" (`upcoming-payments.tsx`) pasó a título + monto arriba y botón a todo el ancho en móvil, porque se cortaba en 360 px.

## Riesgos

- **Quitar el tab oculta Empresa detrás de la hamburguesa.** Un usuario con empresa tardará más en llegar a ella. Mitigación: la barra inferior ya cambia de destinos según el espacio; si se ve fricción real, se evalúa un indicador en el header en otro spec.
- **Duplicar markup tabla/tarjeta** (ambas en el DOM con `hidden`) rompe pruebas de accesibilidad si ambas son visibles para lectores de pantalla. Mitigación: la que no aplica va con `hidden` (display none), no solo oculta visualmente.
- **Hoja de filtros y debounce del buscador**: el buscador queda fuera de la hoja y sigue navegando con su debounce; verificar que abrir/cerrar la hoja no reinicie el texto escrito.
- **Offsets del layout**: el `sticky top-16` y el `Suspense` del tab pudieron compensar otros márgenes; revisar que no aparezca un hueco o un salto al quitarlos.

## Lo que **no** entra en este spec

- Formularios y diálogos a pantalla completa en móvil.
- Gráficas en pantallas angostas y Lighthouse móvil ≥ 90.
- Cambios en la tabla de Movimientos.
- Indicador de espacio en el header móvil.
- Cambios en tablet y escritorio.
