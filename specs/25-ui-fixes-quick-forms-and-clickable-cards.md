# SPEC 25 — Correcciones de UI, atajos en formularios y tarjetas clicables

> **Estado:** Aprobado
> **Depende de:** SPEC 02, SPEC 05, SPEC 06, SPEC 08c, SPEC 15, SPEC 24
> **Fecha:** 2026-11-04
> **Objetivo:** Corregir los detalles de UI reportados (texto de botones, toggle de tasa, acceso a Categorías y Verificar) y acelerar el registro con tabs de pago en el diálogo de movimiento, creación de categorías y cuentas desde los selects y tarjetas de metas y deudas clicables completas.

## Por qué existe este spec

Los usuarios reportaron bugs y fricciones pequeñas que, sumadas, hacen la app más difícil de usar:

- Botones con relleno verde y texto negro en producción.
- El toggle **E.A. / M.V.** del formulario de deudas se monta sobre el campo **Día de pago**.
- Sin movimientos, la barra de filtros desaparece y con ella los botones **Categorías** y **Verificar**: no hay forma de crear una categoría.
- En escritorio, el diálogo **Registrar movimiento** no permite pagar una deuda ni un gasto fijo, cosa que el móvil sí hace.
- Si falta una categoría o una cuenta, hay que cerrar el formulario, ir a otra pantalla y volver.
- El Sheet con el detalle de una meta o deuda solo se abre desde una zona de la tarjeta que el usuario no descubre.

Es el primero de cuatro specs que salen del mismo pedido:

- SPEC 25: este.
- SPEC 26: editar pagos y aportes desde Movimientos.
- SPEC 27: tutoriales con Driver.js.
- SPEC 28: Me deben mes a mes.

## Alcance

**Entra:**

- **1. Texto blanco en botones de color.**
  - SPEC 24 ya pone `--accent-foreground` blanco sobre emerald-700 (Personal) y orange-700 (Empresa) en `globals.css`. Producción (`master`) aún muestra texto negro.
  - Auditar que todos los botones con relleno del primario usen el token tras el merge de SPEC 24: **Registrar movimiento**, **Crear**, **Guardar**, **Pagar**, botones de la hoja de acciones rápidas, `EmptyState` y diálogos, en claro y oscuro.
  - Corregir los que fijen un color propio (clases crudas de Tailwind o `--button-fg`) para que lean el token.
  - Verificar AA (≥ 4.5:1) y anotarlo en la tabla de contraste de `docs/ui.md`.
- **3. Toggle E.A. / M.V. bien posicionado.**
  - En `src/features/debts/components/debt-dialog.tsx`, el `ToggleButtonGroup` de tipo de tasa queda dentro de la celda de **Tasa de interés**: al lado del campo (o como sufijo dentro de él), sin invadir la columna de **Día de pago**.
  - Aplica a los dos tipos: **Tarjeta de crédito** y **Préstamo**.
  - Revisar el mismo patrón en móvil (`< 768 px`, una columna) y con error de validación visible.
- **4. Categorías y Verificar en el menú Más.**
  - El menú **Más** del header (`src/components/dashboard/quick-actions-menu.tsx`) suma **Categorías** y **Verificar movimientos** en **todas las páginas** del espacio.
  - Se quitan de la barra de filtros de Movimientos (`transactions-filters.tsx`), en escritorio y en la hoja de filtros del móvil.
  - **Empresa:** hoy no tiene menú Más. Se crea uno con **Categorías** y **Verificar movimientos**, en todas las páginas de Empresa.
  - Las dos opciones abren los diálogos existentes (`verify-movements-dialog.tsx` y el de Categorías) sobre la página actual, sin navegar.
  - En móvil, las dos opciones se agregan a la hoja de acciones rápidas (`quick-sheet.tsx`).
- **5. Tabs de pago en el diálogo de movimiento (escritorio).**
  - `transaction-dialog.tsx` pasa de **Gasto · Ingreso · Traspaso** a **Gasto · Ingreso · Traspaso · Pago de deuda · Gasto fijo**.
  - **Pago de deuda** muestra el formulario de pago de la hoja móvil (elige deuda o tarjeta, monto, cuenta, fecha), reutilizando `PaymentDialog` / su formulario.
  - **Gasto fijo** muestra la lista de ocurrencias pendientes para marcar pagada, reutilizando `PayOccurrenceDialog` / su formulario.
  - Solo en Personal (Empresa no tiene deudas ni gastos fijos). Al editar un movimiento existente, los tabs nuevos no aparecen.
  - **Aporte a meta** no se agrega como tab: sigue en el menú Más.
- **6. Crear categoría o cuenta desde el select.**
  - La última opción de todo select de **Categoría** y de **Cuenta** es **+ Crear categoría** / **+ Crear cuenta**.
  - Abre el diálogo existente de categoría o cuenta encima del formulario actual. Al guardar, la nueva queda seleccionada y el formulario conserva lo escrito.
  - La categoría nueva hereda el tipo del formulario (gasto o ingreso).
  - Aplica a todos los formularios con esos selects: movimiento, traspaso, gasto fijo, presupuesto, pago de deuda, aporte a meta, cobro de Me deben, importación y los de Empresa.
  - Se implementa como componente compartido (`CategorySelectField` y `AccountSelectField` en `src/components/forms/`) para no repetir la lógica.
- **7. Tarjetas de metas y deudas clicables completas.**
  - Un clic en cualquier parte de la tarjeta abre el Sheet de detalle en **Deudas (Debo)**, **Me deben** y **Metas** (`debt-card.tsx`, `receivable-card.tsx`, `goal-card.tsx`).
  - El menú **⋮** sigue aparte y no abre el Sheet (detiene la propagación).
  - **Sin cambio visual:** misma estructura, colores y espaciado (hay videos de la landing grabados con esta UI). Solo cambia el cursor y un hover sutil sobre la tarjeta completa, en lugar del hover actual del bloque interno.
  - Accesible: un solo elemento interactivo para abrir (patrón de "tarjeta con enlace estirado": el botón actual se extiende con un pseudo-elemento a toda la tarjeta), foco visible en la tarjeta y el ⋮ alcanzable con Tab.
- Documentar en `docs/ui.md` (menú Más, selects con creación, tarjetas clicables) y `docs/producto.md`; anotar en `[Unreleased]` del `CHANGELOG.md` (en inglés).

**Fuera de alcance (para otros specs):**

- Editar pagos de deuda, avances, aportes o pagos de gasto fijo desde Movimientos (SPEC 26).
- Tutoriales guiados (SPEC 27).
- Me deben mes a mes (SPEC 28).
- Tab **Aporte a meta** en el diálogo de escritorio.
- Rediseño de tarjetas o del diálogo de deudas.

## Modelo de datos

Este spec no introduce datos nuevos ni migraciones. Reutiliza las actions existentes de categorías, cuentas, pagos de deuda y gastos fijos.

## Plan de implementación

1. **Botones (1).** Buscar botones de color con texto fijo (`text-black`, `text-zinc-*`, `--button-fg`) en `src/`; dejarlos con el token del primario. Revisar claro y oscuro en Personal y Empresa; actualizar contraste en `docs/ui.md`.
2. **Toggle de tasa (3).** Reacomodar la celda de tasa en `debt-dialog.tsx` para Tarjeta y Préstamo; probar en escritorio, móvil y con error.
3. **Menú Más con Categorías y Verificar (4).** Agregar los dos ítems a `quick-actions-menu.tsx`; montar sus diálogos desde el menú.
4. **Menú Más en Empresa (4).** Mostrar el menú en Empresa con solo esos dos ítems.
5. **Quitar de la barra de filtros (4).** Eliminar los botones de `transactions-filters.tsx` y de la hoja de filtros; agregar las dos opciones a `quick-sheet.tsx`.
6. **Selects con creación (6).** Crear `CategorySelectField` y `AccountSelectField` con la opción final **+ Crear…** y el diálogo encima.
7. **Migrar formularios (6).** Reemplazar los selects de Categoría y Cuenta en cada formulario listado, uno por commit si hace falta.
8. **Tabs de pago (5).** Agregar **Pago de deuda** y **Gasto fijo** a `transaction-dialog.tsx` en Personal, reutilizando los formularios de la hoja móvil.
9. **Tarjetas clicables (7).** Extender el botón de detalle a toda la tarjeta en `debt-card.tsx`, `receivable-card.tsx` y `goal-card.tsx`; proteger el ⋮.
10. **Docs y CHANGELOG.**
11. **Verificación.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [ ] Todo botón con relleno del primario muestra texto blanco en Personal y Empresa, en claro y oscuro, con contraste ≥ 4.5:1.
- [ ] En **Nueva deuda** y **Editar deuda**, tipo Tarjeta y Préstamo, el toggle E.A. / M.V. no se superpone a **Día de pago** en escritorio ni en móvil.
- [ ] Con cero movimientos, el menú **Más** permite abrir **Categorías** y crear una categoría.
- [ ] **Categorías** y **Verificar movimientos** aparecen en el menú Más desde cualquier página de Personal y de Empresa.
- [ ] La barra de filtros de Movimientos ya no tiene los botones Categorías ni Verificar.
- [ ] En escritorio, Personal, el diálogo **Registrar movimiento** tiene los tabs **Pago de deuda** y **Gasto fijo**, y registrar desde ellos produce el mismo resultado que desde la hoja móvil.
- [ ] En Empresa y al editar un movimiento, esos tabs no aparecen.
- [ ] En cada formulario con select de Categoría o Cuenta, la última opción crea una nueva; al guardarla queda seleccionada y el resto de campos no se borra.
- [ ] Un clic en cualquier parte de una tarjeta de deuda, cuenta por cobrar o meta abre su Sheet.
- [ ] Un clic en el ⋮ abre el menú y no el Sheet.
- [ ] Con teclado, la tarjeta y el ⋮ son alcanzables con Tab y tienen foco visible.
- [ ] Las tarjetas se ven igual que antes salvo el hover y el cursor.

## Decisiones

- **Sí:** cuatro specs separados para el pedido (decisión del usuario). Motivo: cuatro dominios distintos (UI, datos de movimientos vinculados, tutoriales con BD y un nuevo tipo de cuenta por cobrar).
- **Sí:** Categorías y Verificar en el menú Más de todas las páginas (decisión del usuario). Motivo: no dependen de que existan movimientos.
- **Sí:** crear el menú Más en Empresa. Motivo: Empresa tiene el mismo bug.
- **Sí:** solo **Pago de deuda** y **Gasto fijo** como tabs nuevos (decisión del usuario). **Aporte a meta** sigue en el menú Más.
- **Sí:** crear desde el select con el diálogo existente encima. Motivo: una cuenta necesita tipo y saldo, que no caben en un campo inline.
- **No:** campo inline dentro del popover del select. Solo serviría para categorías.
- **Sí:** tarjeta clicable sin cambio visual (decisión del usuario). Motivo: los videos de la landing (SPEC 24) muestran esta UI.
- **Sí:** patrón de enlace estirado en vez de envolver la tarjeta en un `<button>`. Motivo: un botón no puede contener el ⋮ (botones anidados no son válidos).

## Riesgos

| Riesgo                                                                                  | Mitigación                                                                                             |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Diálogo sobre diálogo (crear categoría encima de movimiento) con foco y Escape confusos | Usar los `Modal` anidados de HeroUI; Escape cierra solo el de arriba y el foco vuelve al select.       |
| El diálogo de movimiento crece demasiado con 5 tabs                                     | Tabs con scroll horizontal en anchos chicos; los formularios reutilizados ya existen en la hoja móvil. |
| El enlace estirado tapa el ⋮                                                            | El ⋮ con `position: relative` y `z-index` mayor; probar clic y teclado.                                |
| SPEC 24 aún sin merge en producción                                                     | El paso 1 se verifica sobre la rama con SPEC 24 integrado.                                             |

## Qué **no** entra en este spec

- Editar movimientos vinculados (SPEC 26).
- Tutoriales (SPEC 27).
- Me deben mes a mes (SPEC 28).
- Tab Aporte a meta en escritorio.
- Rediseño visual de tarjetas o formularios.
