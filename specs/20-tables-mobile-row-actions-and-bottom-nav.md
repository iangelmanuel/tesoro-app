# SPEC 20 — Tablas legibles en móvil, menú de acciones por fila y barra inferior con Cuentas

> **Estado:** Aprobado
> **Depende de:** SPEC 15, SPEC 18, SPEC 19
> **Fecha:** 2026-11-03
> **Objetivo:** Que las tablas se lean completas en el teléfono (sin textos cortados, con scroll horizontal), que en computadora las acciones de cada fila vivan en un menú desplegable, que la barra de Movimientos quede alineada y que la barra inferior móvil enlace a Cuentas en lugar de Metas.

## Por qué existe este spec

Este spec es el primero de cuatro que salen del mismo pedido (10 ítems). El pedido se partió así, en este orden de implementación:

1. **SPEC 20 (este):** tablas, menús de acción, barra de Movimientos, tabla de presupuestos, barra inferior.
2. **SPEC 21:** conciliación de cuentas y fecha del saldo inicial.
3. **SPEC 22:** ocultar cifras (ojo en el header) y aside interno de Cuenta.
4. **SPEC 23:** pulido del modo claro y separación de Presupuestos / Gastos fijos en el aside.

Problemas que corrige este spec:

- En el teléfono, la descripción del movimiento aparece cortada con `truncate` y el usuario no ve de qué se trata. SPEC 18 pasó las tablas a tarjetas (`DataRows`) pero el usuario prefiere ver la tabla completa y deslizarla.
- En escritorio, cada fila muestra varios botones (editar, eliminar, etc.) que ensucian la tabla.
- En Movimientos, el botón **Verificar** no queda alineado con los demás controles y el buscador es corto.
- En Presupuestos, la sección "Sin presupuesto" mezcla categoría, monto y botón "+ Presupuestar" en una fila apretada.
- Cuentas es una de las pantallas más consultadas y hoy no está en la barra inferior.

## Alcance

**Entra:**

- **Tablas con scroll horizontal en móvil (`< 768 px`)** en Movimientos y las demás tablas de listado (deudas, aportes de metas, gastos fijos, reportes).
  - Se revierte para estas tablas el patrón de `DataRows` de SPEC 18: la tabla se muestra completa dentro de un contenedor con `overflow-x-auto`, con ancho mínimo por columna y sin `truncate` en la descripción (la descripción envuelve a varias líneas, máximo 3 con `line-clamp-3` y el texto completo en el `title` / diálogo de edición).
  - La columna de acciones queda fija a la derecha (`sticky right-0`) para que los botones se alcancen sin deslizar hasta el final.
  - `DataRows` se conserva solo donde no haya tabla equivalente (resúmenes cortos). Si tras el cambio queda sin usos, se elimina.
- **Menú de acciones por fila en escritorio (`≥ 768 px`)**:
  - Nuevo componente `RowActions` (`src/components/dashboard/row-actions.tsx`) sobre el `Dropdown` de HeroUI: un botón de tres puntos (`isIconOnly`, `aria-label="Acciones de <fila>"`) que abre las opciones (Editar, Eliminar, Archivar, etc.). Las acciones destructivas van al final y con tono `danger`.
  - En móvil (`< 768 px`) los botones siguen visibles en la fila (controles de 44 px o más), porque ahí la fila ya se desliza.
  - Aplica a las tablas de Movimientos, Cuentas (tarjetas excluidas: sus botones de tarjeta se quedan), Deudas, Metas (aportes), Gastos fijos y Presupuestos.
- **Barra de Movimientos** (`transactions-filters.tsx`, `transactions-totals.tsx` y su página):
  - Una sola fila: buscador (`flex-1`, mínimo `18rem`, alto de 44 px) · selector de mes · **Filtros** · **Verificar**, todos con la misma altura y centrados verticalmente (`items-center`).
  - El buscador crece para ocupar todo el ancho libre.
  - En móvil la fila se parte en dos: el buscador a todo el ancho y debajo los controles, sin que ninguno quede desalineado.
- **Tabla de presupuestos / "Sin presupuesto"** (`unbudgeted-categories.tsx`, `budget-progress-row.tsx`):
  - Fila con grilla de tres columnas fijas: categoría (con el chip, envuelve sin cortar), monto gastado (alineado a la derecha, `tabular-nums`) y acción.
  - La acción "Presupuestar" pasa a botón compacto de ícono + texto, de ancho constante, para que los montos no queden desalineados entre filas.
  - Se revisa el mismo patrón en `budget-progress-row.tsx` para que las barras y los montos usen la misma grilla.
- **Barra inferior móvil**: en Personal, **Metas** se reemplaza por **Cuentas**.
  - `SITE.navigation.mobile.personal` pasa a `["/dashboard/personal", "/dashboard/personal/transactions", "/dashboard/personal/budgets", "/dashboard/personal/accounts"]`.
  - Empresa **no cambia**: su aside ya incluye Cuentas y la barra ya cubre Resumen, Movimientos, Flujo de caja y Reportes.
  - Metas sigue accesible desde el aside (botón de menú del header).
- Documentar en `docs/ui.md` (secciones Móvil y componentes), anotar en `[Unreleased]` del `CHANGELOG.md` (en inglés) y actualizar `docs/producto.md` si cambia la navegación.

**Fuera de alcance (para otros specs):**

- Conciliación de cuentas y fecha del saldo inicial (SPEC 21).
- Ocultar cifras y aside de Cuenta (SPEC 22).
- Pulido del modo claro y separar Presupuestos / Gastos fijos en el aside (SPEC 23).
- Cambiar el contenido de las columnas o añadir columnas nuevas.
- Virtualización o paginación nueva de las tablas.
- Menú de acciones en las tarjetas de cuentas, deudas y metas (siguen con sus botones).

## Modelo de datos

No introduce datos nuevos ni migraciones. Solo cambia la configuración de navegación (`SITE.navigation.mobile.personal`).

## Plan de implementación

1. **`RowActions`.** Crear `src/components/dashboard/row-actions.tsx` con `Dropdown` de HeroUI (importado de `@heroui/react`), items con ícono, acción destructiva al final. Prop `mobile="inline"` por defecto: en `< 768 px` renderiza los mismos items como botones en línea. Prueba manual del foco y de `Escape`.
2. **Contenedor de tabla con scroll.** Añadir un contenedor reutilizable `ScrollTable` (`src/components/dashboard/scroll-table.tsx`) con `overflow-x-auto`, sombra lateral cuando hay más contenido y `min-w` por tabla. Probarlo primero en Movimientos.
3. **Movimientos.** Sustituir `DataRows` + tabla por la tabla con scroll en móvil, quitar `truncate`, columna de acciones fija y `RowActions`. Reordenar la barra (buscador, mes, Filtros, Verificar) y revisar la hoja de filtros móvil de SPEC 18.
4. **Resto de tablas.** Aplicar el mismo patrón a Deudas, aportes de Metas, Gastos fijos, categorías de reportes y presupuestos. Una tabla por commit.
5. **Presupuestos.** Rehacer la fila de `unbudgeted-categories.tsx` y alinear `budget-progress-row.tsx` con la grilla.
6. **Barra inferior.** Cambiar `SITE.navigation.mobile.personal`; confirmar que `bottom-nav.tsx` resuelve el ícono y nombre desde `SITE.navigation.personal` (Cuentas → `Wallet`).
7. **Revisión de contraste y tamaño.** Controles de 44 px o más en móvil, AA en claro y oscuro, foco visible en el botón de tres puntos.
8. **Docs y CHANGELOG.** `docs/ui.md`, `[Unreleased]`, y si aplica `docs/producto.md`.
9. **Verificación final.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build`.

## Criterios de aceptación

- [ ] En `< 768 px`, ninguna descripción de movimiento queda cortada con puntos suspensivos de una línea; el texto envuelve (máximo 3 líneas) y el texto completo se ve en el diálogo de edición.
- [ ] En `< 768 px`, la tabla de Movimientos se desliza en horizontal y la columna de acciones queda visible sin llegar al final.
- [ ] En `≥ 768 px`, cada fila de Movimientos, Deudas, Gastos fijos y Presupuestos muestra un solo botón de tres puntos con Editar y Eliminar (Eliminar al final, con tono `danger`).
- [ ] El menú se abre y se cierra con teclado (Enter, Escape), el foco vuelve al botón y tiene `aria-label`.
- [ ] En la barra de Movimientos, buscador, mes, Filtros y Verificar comparten altura y línea base; el buscador ocupa todo el ancho libre.
- [ ] En "Sin presupuesto" los montos quedan alineados en una columna y el botón "Presupuestar" no se parte ni empuja el monto.
- [ ] La barra inferior en Personal muestra Resumen, Movimientos, Presupuestos y Cuentas; Metas no aparece y sigue en el aside.
- [ ] La barra inferior en Empresa no cambia.
- [ ] Todos los controles nuevos miden 44 px o más en móvil y cumplen AA en claro y oscuro.
- [ ] `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] `docs/ui.md` y `[Unreleased]` del CHANGELOG (en inglés) documentan el cambio.

## Decisiones

- **Sí:** tabla con scroll horizontal en móvil (decisión del usuario), aunque revierte parte de SPEC 18. Motivo: el usuario quiere ver los datos reales y las acciones en una sola vista de tabla.
- **Sí:** el menú desplegable solo en escritorio. En móvil los botones quedan en línea porque la fila ya se desliza y un menú de dos toques cuesta más en pantalla táctil.
- **Sí:** barra inferior de Empresa sin cambios; el reemplazo pedido (Metas → Cuentas) solo existe en Personal. Cuentas ya está en el aside de Empresa y la barra ya cubre sus pantallas de uso diario.
- **No:** quitar `DataRows` de golpe. Se elimina solo si queda sin usos.
- **No:** menús de acción en tarjetas; son pocos botones y ya funcionan.
- **Descartado:** dejar `truncate` con tooltip. En táctil no hay hover, que es justo el problema.

## Riesgos

- **Sticky de la columna de acciones sobre scroll horizontal:** el fondo debe ser opaco y llevar sombra para no superponer texto. Verificar en claro y oscuro.
- **Revertir `DataRows` en tablas de reportes** puede reabrir el problema de SPEC 18 (fechas partidas en varias líneas). Fijar `min-w` y `whitespace-nowrap` en fecha y monto.
- **`Dropdown` de HeroUI dentro de contenedores con `overflow-x-auto`** puede recortarse. Usar `Popover` con portal (comportamiento por defecto) y comprobar que no queda cortado.
