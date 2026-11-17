# SPEC 41 — Switch de tema, orden de tabs, fecha de hoy y autollenado de pagos

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 06, SPEC 16, SPEC 28, SPEC 30, SPEC 38, SPEC 39, SPEC 40
> **Fecha:** 2026-11-17
> **Objetivo:** Que registrar un pago de gasto fijo, deuda, ingreso fijo o cobro de Me deben tome la fecha de hoy, prellene descripción y cuenta, y que el diálogo de movimiento y el menú de cuenta se vean ordenados.

## Por qué existe este spec

Al pagar un gasto fijo, una cuota de deuda o recibir un ingreso fijo, la fecha se autollena con el vencimiento de la cuota. Si el pago fue tarde, el movimiento queda con una fecha falsa y los saldos por fecha no cuadran con el extracto.

Además, la descripción y la cuenta se escriben a mano en cada pago, aunque casi siempre son las mismas.

En el menú de cuenta, el selector de tema de SPEC 40 es una pastilla gris con dos botones que no sigue el estilo de los demás ítems (ver captura del pedido). El orden de tabs del diálogo de movimiento tampoco sigue el uso real: el gasto fijo se registra más que la deuda.

Es el primero de cuatro specs del mismo pedido (SPEC 41 a 44).

## Alcance

**Entra:**

- **Switch de tema** en el menú de cuenta (`src/components/dashboard/user-menu.tsx`):
  - reemplaza la `Dropdown.Section` de dos botones por **un ítem** "Modo oscuro" con icono `Moon` a la izquierda y un `Switch` de HeroUI a la derecha;
  - mismo alto, padding e icono que **Cuenta** y **Ayuda**; sin fondo de pastilla;
  - pulsar el ítem o el switch alterna `light` ↔ `dark` con `setTheme` y **no cierra** el menú;
  - el switch refleja `resolvedTheme`; accesible por teclado (Enter/Espacio) y con `aria-checked`.
- **Orden de tabs** del `TransactionDialog` en Personal: **Gasto, Ingreso, Traspaso, Gasto fijo, Deuda, Me deben, Meta**. Empresa no cambia.
- **Fecha de hoy** al registrar un pago, en:
  - **Gasto fijo**: tab Gasto fijo del diálogo y botón Pagar de Próximos pagos (`upcoming-payments.tsx`);
  - **Ingreso fijo**: botón Recibir (`receive-income-button.tsx`) y el tab Ingreso con ingreso fijo elegido;
  - **Deuda**: pago de cuota mensual desde el tab Deuda, el Sheet y Próximos pagos de deudas;
  - **Me deben**: cobro de cuota mensual (`receivable-collect-form.tsx`).
  - La **cuota** que se paga sigue siendo la elegida (vencimiento intacto). Solo cambia `occurred_on`, que pasa a `todayISO()`.
  - El usuario puede cambiar la fecha; el máximo sigue siendo hoy.
  - Editar un pago existente conserva su fecha guardada.
- **Descripción autollenada** en esos mismos flujos, con la nota vacía:
  - formato `{Verbo} {nombre} · {periodo}`;
  - verbo: **Pago** (gasto fijo y deuda), **Ingreso** (ingreso fijo), **Cobro** (Me deben);
  - periodo según la frecuencia de la cuota que se paga, no de hoy:
    - sin año (decisión del usuario tras implementar): la fecha del movimiento ya lo dice y el mes basta para distinguir cada cuota;
    - mensual: `noviembre`;
    - quincenal: `1.ª quincena de noviembre` / `2.ª quincena de noviembre`;
    - anual: el mes de la cuota (`marzo`);
    - sin frecuencia (`none`, cobro único, abono libre a tarjeta o préstamo): sin periodo, solo `{Verbo} {nombre}`;
    - varios meses (SPEC 38/39): `{Verbo} {nombre} · septiembre a noviembre` (o `noviembre a enero` si cruza año).
  - El campo **Descripción** queda editable. Si el usuario lo cambia, se guarda lo que escribió.
- **Cuenta por defecto por origen**:
  - columna opcional `account_id` en `recurring_expenses` y `debts` (los ingresos fijos ya la tienen);
  - se elige en el diálogo de crear/editar gasto fijo y deuda con `PaymentAccountSection` o un `Select` "Cuenta habitual (opcional)";
  - al pagar, la cuenta se prellena con la del origen. Sin cuenta configurada, el campo queda vacío y lo elige el usuario;
  - si la cuenta está archivada o borrada, no se prellena.
- **Descripción en el pago de deuda y el cobro de Me deben**: `record_debt_payment` y `record_receivable_collection` aceptan `p_description` opcional. Si llega nula, mantienen el texto actual (`Pago {nombre}` / `Abono {nombre}`). `create_payment_transfer` no cambia: `transfers` no tiene descripción y un pago de tarjeta no crea movimiento (decisión del usuario en la implementación).
- **Me deben** tiene campo **Descripción** en el formulario de cobro (antes no lo tenía).
- Ocultar cifras, móvil a 390 px y AA en claro y oscuro.
- **Documentación:** `docs/ui.md` (menú de cuenta, orden de tabs), `docs/producto.md` (fecha y autollenado), `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Editar pagos de deuda y convertir ajustes en pagos (SPEC 42).
- Cambios del MCP (SPEC 43 y 44).
- Una cuenta predeterminada global del espacio.
- Prellenar con la última cuenta usada.
- Opción "Sistema" en el tema.
- Frecuencias semanales o diarias en gastos fijos (no existen). Los ingresos fijos sí tienen semanal, diaria y cada N días: su periodo es la fecha de la cuota (`8 nov`).
- Autollenar la nota.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_default_payment_accounts.sql`:

```sql
alter table public.recurring_expenses
  add column account_id uuid,
  add constraint recurring_expenses_account_id_workspace_id_fkey
    foreign key (account_id, workspace_id)
    references public.accounts (id, workspace_id)
    on delete set null (account_id);

alter table public.debts
  add column account_id uuid,
  add constraint debts_account_id_workspace_id_fkey
    foreign key (account_id, workspace_id)
    references public.accounts (id, workspace_id)
    on delete set null (account_id);
```

- RLS: no cambia; las políticas de las dos tablas ya filtran por espacio.
- `record_debt_payment` y `record_receivable_collection` reciben `p_description text default null`.
- `debt_overview` devuelve `account_id` (el tipo `Debt` sale de esa RPC).

Helper nuevo `src/libs/payment-description.ts`:

```ts
type PaymentVerb = "Pago" | "Ingreso" | "Cobro"
type PaymentPeriod =
  | { kind: "month"; on: string } // YYYY-MM-DD de la cuota
  | { kind: "biweekly"; on: string }
  | { kind: "year"; on: string }
  | { kind: "day"; on: string } // ingreso semanal, diario o cada N días
  | { kind: "range"; from: string; to: string; unit?: "month" | "day" | "year" }
  | { kind: "none" }

buildPaymentDescription(verb, name, period): string
```

Tras la migración se regeneran `src/types/database.ts` y se pasa Prettier.

## Plan de implementación

1. **Switch de tema.** Ítem "Modo oscuro" con `Switch` en `user-menu.tsx`. Probar teclado, que no cierre el menú y AA en ambos temas.
2. **Orden de tabs.** Mover el `ToggleButton` `recurring` antes de `debt_payment` en `transaction-dialog.tsx`; actualizar el comentario de orden. Revisar tours de SPEC 27 y `scrollIntoView` del tab activo.
3. **Fecha de hoy.** Cambiar `occurred_on: dueOn` por `todayISO()` en `upcoming-payments.tsx`, el panel Gasto fijo (`transaction-dialog.tsx`), `receive-income-button.tsx`, Próximos pagos de deudas y el cobro mensual. Mantener la cuota elegida.
4. **Helper de descripción.** `src/libs/payment-description.ts` con meses en `es-CO`.
5. **Descripción en formularios.** Usarlo en gasto fijo, ingreso fijo y Me deben (prellenar `description`).
6. **Migración y tipos.** Columnas `account_id` y `p_description` en las RPC. `supabase db reset`, regenerar tipos.
7. **Descripción en deudas.** Pasar `p_description` desde las actions de pago de deuda; el formulario muestra la descripción editable prellenada.
8. **Cuenta habitual.** Campo opcional en `recurring-expense-dialog.tsx` y `debt-dialog.tsx`; schemas y actions; prellenar la cuenta al pagar.
9. **Docs y CHANGELOG.**
10. **Verificación.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [x] El menú de cuenta muestra un ítem "Modo oscuro" con switch, alineado con Cuenta y Ayuda, sin pastilla gris.
- [x] Pulsar el ítem cambia el tema y el menú sigue abierto.
- [x] Con Tab y Espacio se alterna el tema; un lector de pantalla anuncia el estado del switch.
- [x] El diálogo de movimiento en Personal muestra Gasto, Ingreso, Traspaso, Gasto fijo, Deuda, Me deben y Meta, en ese orden, en escritorio y a 390 px.
- [x] Pagar el 17 nov un gasto fijo que vencía el 5 nov prellena la fecha con 17 nov y marca pagada la cuota del 5 nov.
- [x] Recibir el 17 nov un ingreso fijo esperado el 15 nov prellena 17 nov.
- [x] Pagar la cuota mensual de una deuda y cobrar una cuota de Me deben prellenan la fecha de hoy.
- [x] Editar un pago guardado el 5 nov sigue mostrando 5 nov.
- [x] Pagar el gasto fijo mensual "Arriendo" de noviembre prellena la descripción "Pago Arriendo · noviembre" y la nota vacía.
- [x] Recibir la 1.ª quincena de noviembre del ingreso "Salario" prellena "Ingreso Salario · 1.ª quincena de noviembre".
- [x] Un cobro de varios meses de sep a nov prellena "Cobro {nombre} · septiembre a noviembre".
- [x] Cambiar la descripción a mano guarda el texto escrito, también en el movimiento de un pago de deuda.
- [x] Un gasto fijo con cuenta habitual "Nequi" prellena "Nequi" al pagarlo; uno sin cuenta deja el campo vacío.
- [x] Una deuda con cuenta habitual prellena esa cuenta al registrar el pago.
- [x] Archivar la cuenta habitual deja de prellenarla; borrarla deja `account_id` nulo sin borrar el gasto fijo ni la deuda.
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

## Decisiones

- **Sí:** ítem con `Switch` para el tema (decisión del usuario). Se lee como los demás ítems del menú.
- **No:** control segmentado ni ítem que alterna sin control. El switch muestra el estado de un vistazo.
- **Sí:** orden Gasto, Ingreso, Traspaso, Gasto fijo, Deuda, Me deben y Meta (decisión del usuario). Reemplaza el orden de SPEC 39.
- **Sí:** fecha de hoy en los cuatro flujos de pago (decisión del usuario). El pago real ocurre hoy; la cuota guarda su vencimiento aparte.
- **Sí:** periodo según frecuencia y de la cuota, no de hoy (decisión del usuario). Un pago tardío de octubre dice "octubre".
- **Sí:** nota vacía (decisión del usuario). La nota es para el usuario.
- **Sí:** cuenta habitual en cada origen (decisión del usuario), igual que ya tienen los ingresos fijos.
- **No:** cuenta global predeterminada ni última usada. Menos predecible y no distingue tarjeta de nómina.
- **Sí:** `p_description` opcional en las RPC con el texto actual de respaldo. No rompe el MCP ni llamadas existentes.
- **Sí:** `on delete set null (account_id)`. Borrar una cuenta no debe borrar el gasto fijo ni la deuda.
- **Sí:** ingresos semanales, diarios o cada N días con la fecha de la cuota como periodo (decisión del usuario en la implementación).
- **Sí:** **Recibir** que cubre varias ocurrencias usa el rango desde la más antigua abierta hasta la fila (decisión del usuario en la implementación).
- **Sí:** campo Descripción en el cobro de Me deben y `p_description` en `record_receivable_collection` (decisión del usuario en la implementación).
- **No:** `p_description` en `create_payment_transfer` (decisión del usuario en la implementación): `transfers` no tiene descripción.

## Riesgos

| Riesgo                                                           | Mitigación                                                                    |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `Switch` dentro de `Dropdown.Item` captura el clic dos veces     | El ítem maneja la acción y el switch va `isReadOnly` / decorativo con `aria`. |
| Fecha de hoy anterior al inicio de la cuota en pagos adelantados | Se permite: pagar por adelantado es válido; la cuota sigue siendo la elegida. |
| Tours de SPEC 27 apuntan a la posición del tab Deuda             | Revisar en el paso 2.                                                         |
| `on delete set null (columna)` requiere Postgres 15+             | Supabase corre 15+; verificar con `supabase db reset`.                        |

## Qué **no** entra en este spec

- Editar pagos de deuda y convertir ajustes (SPEC 42).
- MCP (SPEC 43 y 44).
- Cuenta global predeterminada, última cuenta usada y tema "Sistema".
- Autollenar la nota.
