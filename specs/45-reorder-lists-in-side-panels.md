# SPEC 45 — Reordenar las listas de los paneles laterales

> **Estado:** En verificación
> **Depende de:** SPEC 19, SPEC 38, SPEC 42
> **Fecha:** 2026-11-18
> **Objetivo:** Que las listas de los paneles de la derecha se reordenen arrastrando, con la misma interacción de Movimientos.

## Por qué existe este spec

En Movimientos las filas del mismo día se ordenan arrastrando su asa (SPEC 19). En los paneles laterales (deuda, meta, ingreso fijo, categorías) el orden era fijo: un pago y un ajuste del mismo día no se podían poner en el orden en que pasaron, y las categorías solo iban por nombre.

## Alcance

**Entra:**

- Componente compartido `src/components/dashboard/sortable-list.tsx` (`useSortableList`, `SortableListProvider`, `SortableListItem`): asa ⋮⋮, vista previa, resaltado del grupo, atenuado del resto, hueco de la fila original, teclado y táctil. Orden optimista; si la action falla, la fila vuelve y sale un toast.
- **Deudas y Me deben**: historial de la deuda, dentro del mismo día. RPC `move_debt_entry(p_id, p_target_id)`.
- **Metas**: aportes y retiros, dentro del mismo día. RPC `move_goal_contribution(p_id, p_target_id)`.
- **Ingresos fijos**: cobros de una ocurrencia del mismo día, con `move_ledger_entry` (son movimientos).
- **Categorías**: propias activas, dentro de su tipo. Columna `categories.position` (null = sin ordenar, al final por nombre) y RPC `move_category(p_workspace_id, p_id, p_target_id)`. `getCategories` ordena por `position` y los selects lo siguen.
- Las RPC son `security invoker`, validan `is_workspace_writable` y renumeran `1..n` solo el grupo de la lista. El orden relativo de esas filas se respeta en Movimientos.

**Fuera de alcance:**

- Gastos fijos: un pago por periodo y fecha fija del calendario; no hay nada que reordenar.
- Categorías del sistema y archivadas.
- Mover a otro día o cambiar de tipo arrastrando.
- Reordenar desde el MCP.

## Criterios de aceptación

- [ ] Dos pagos de una deuda del mismo día se intercambian arrastrando el asa; tras recargar conservan el orden.
- [ ] Una fila sola en su día no muestra asa; soltar en otro día no hace nada.
- [ ] Lo mismo en aportes de una meta y en los cobros del mismo día de un ingreso fijo.
- [ ] Las categorías propias activas se reordenan en su tab; el select del diálogo de movimiento muestra el nuevo orden.
- [ ] Una categoría nueva aparece al final de las propias.
- [ ] Con la deuda o meta inactiva (solo lectura) no hay asa.
- [x] `pnpm check` y `pnpm eslint` pasan.
- [x] `supabase db push` aplica la migración en el proyecto remoto.
