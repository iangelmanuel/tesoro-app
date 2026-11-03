# SPEC 21 — Conciliación de cuentas y fecha del saldo inicial

> **Estado:** Implementado
> **Depende de:** SPEC 08c, SPEC 16, SPEC 19, SPEC 20
> **Fecha:** 2026-11-03
> **Objetivo:** Que el usuario pueda cuadrar una cuenta con su saldo real desde un diálogo que calcula la diferencia a una fecha y crea el ajuste, que Tesoro avise de saldos negativos en billeteras y bancos, y que el saldo inicial tenga fecha.

## Por qué existe este spec

Tesoro mostró Nequi en saldo negativo porque la cuenta tenía saldo inicial 0, le faltaban movimientos y había ajustes manuales que tapaban huecos. Hoy el saldo se calcula con la RPC `account_balances` (`opening_balance` + movimientos, transferencias, ajustes, deudas y aportes a metas) y solo da el saldo a hoy y el programado. Hay que facilitar cuadrar la cuenta con su saldo real y detectar el problema antes.

Es el segundo de cuatro specs que salen del mismo pedido (ver SPEC 20). Es el único de los cuatro que necesita lógica de dinero en SQL.

## Alcance

**Entra:**

- **Conciliar cuenta** (`ReconcileDialog`):
  - Botón **Conciliar** en la tarjeta de cada cuenta y en su página (también en cuentas de Empresa). Diálogo en escritorio, hoja en móvil.
  - Campos: `TextField` para el saldo real con formato de moneda y `DatePickerField` para la fecha (por defecto hoy; no se permite fecha futura).
  - El diálogo muestra:
    - **Saldo calculado por Tesoro a esa fecha** (se recalcula al cambiar la fecha).
    - **Diferencia** = saldo real − saldo calculado, con signo y tono desde `tone.ts` (positivo `income`, negativo `expense`).
  - Acciones: **Crear ajuste** y **Cancelar**.
  - **Crear ajuste** inserta una fila en `account_adjustments` con `amount` = diferencia, `occurred_on` = fecha elegida, `note` = "Conciliación con saldo real", sin hora y con `day_position` al final del día. Usa `requireWritableWorkspace`, valida con Zod y `useActionState`.
  - **Aviso** antes de confirmar: si la diferencia absoluta supera el **5 % del saldo calculado** o **$50.000** (COP), se muestra "Probablemente faltan movimientos por registrar". Los umbrales viven como constantes en `SITE` (`SITE.reconciliation.warnPercent`, `SITE.reconciliation.warnAmount`). El aviso no bloquea.
  - Si la diferencia es **0**: se muestra "La cuenta ya cuadra", el botón de crear queda deshabilitado y no se inserta nada.
  - Tras crear el ajuste: `revalidatePath` de las pantallas de cuentas, movimientos, resumen y reportes del espacio, y toast de éxito.
- **Saldo calculado a una fecha:** nueva función SQL `account_balance_at(p_account_id uuid, p_on date)` (`security invoker`, respeta RLS) que suma el saldo inicial (si aplica) y todos los eventos con `occurred_on <= p_on`: movimientos, traspasos, ajustes, entradas de deudas y aportes a metas, con las mismas reglas que `account_balances`.
- **Aviso de saldo negativo:**
  - Las cuentas de tipo `wallet` y `bank` con saldo `< 0` muestran un aviso en su tarjeta con acceso directo a **Conciliar**.
  - Las de tipo `cash` y `other` quedan fuera.
  - Se revisa la regla `negative_account` de las recomendaciones (hoy solo en `src/features/business-score`) y se reutiliza (extrayendo la condición a un helper compartido) para el aviso y para las recomendaciones de ambos espacios.
- **Fecha del saldo inicial:**
  - Columna `accounts.opening_balance_on date` (migración versionada), nula = comportamiento actual (el saldo inicial aplica antes de cualquier movimiento).
  - `account_balances` y `account_balance_at` aplican el saldo inicial solo desde `opening_balance_on`.
  - El diálogo de cuenta muestra y edita la fecha (`DatePickerField`, no futura) junto al saldo inicial.
- Regenerar `src/types/database.ts` y pasarle Prettier.
- Documentar en `docs/producto.md` y `docs/ui.md`; anotar en `[Unreleased]` del `CHANGELOG.md` (en inglés).

**Fuera de alcance (para otros specs):**

- Conciliación automática contra extractos (importar el extracto del banco).
- Historial de conciliaciones o tabla propia de conciliaciones; el ajuste con su nota es el registro.
- Deshacer una conciliación (se borra el ajuste desde Movimientos como cualquier otro).
- Avisos de saldo negativo en `cash` y `other`.
- Ocultar cifras (SPEC 22) y modo claro (SPEC 23).

## Modelo de datos

```sql
-- Migración nueva: supabase/migrations/<timestamp>_account_reconciliation.sql
alter table public.accounts
  add column opening_balance_on date;

create or replace function public.account_balance_at(
  p_account_id uuid,
  p_on date
) returns numeric
language sql
stable
security invoker
set search_path = public
as $$ /* opening_balance si opening_balance_on is null or <= p_on,
        más movimientos, traspasos, ajustes, deudas y aportes con occurred_on <= p_on */ $$;
```

```ts
// SITE
reconciliation: {
  warnPercent: 5,
  warnAmount: 50000,
  note: "Conciliación con saldo real"
}
```

`account_balances` se actualiza para aplicar `opening_balance_on`. No hay tabla nueva: el ajuste usa `account_adjustments` (`amount`, `occurred_on`, `occurred_time`, `note`, `day_position`).

## Plan de implementación

1. **Migración.** `opening_balance_on` + `account_balance_at` + cambio de `account_balances`. Verificar con `supabase db push` en el proyecto enlazado.
2. **Tipos.** `supabase gen types typescript --linked --schema public > src/types/database.ts` y Prettier.
3. **Cuenta con fecha de saldo inicial.** Schema Zod y action de crear/editar cuenta, y `account-dialog.tsx` con el campo.
4. **Query del saldo a fecha.** `getAccountBalanceAt(accountId, on)` en `src/features/accounts/queries.ts`, con validación de dueño en el servidor.
5. **Action `reconcileAccountAction`.** Zod (monto, fecha no futura, cuenta), `requireWritableWorkspace`, recalcula la diferencia **en el servidor** (no confía en la del cliente), rechaza diferencia 0, inserta el ajuste y revalida.
6. **`ReconcileDialog`.** Campos, saldo calculado y diferencia con `tone.ts`, aviso por umbral, estado "La cuenta ya cuadra", toast.
7. **Puntos de entrada.** Botón en `account-card.tsx` y en la página de la cuenta; aviso de saldo negativo en la tarjeta para `wallet` y `bank`.
8. **Regla `negative_account`.** Extraer la condición a un helper compartido y usarla en el aviso y en las recomendaciones.
9. **Docs y CHANGELOG.**
10. **Verificación final.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [ ] Con Nequi en −54.394 y saldo real 73,97, el diálogo muestra diferencia +54.467,97 y, al confirmar, el saldo de la cuenta a esa fecha queda en 73,97.
- [ ] Cambiar la fecha en el diálogo recalcula el saldo calculado y la diferencia.
- [ ] No se puede elegir una fecha futura (ni en el cliente ni en el servidor).
- [ ] Diferencia 0: se muestra "La cuenta ya cuadra", el botón queda deshabilitado y el servidor rechaza crear un ajuste de 0.
- [ ] Diferencia mayor al 5 % del saldo calculado o a $50.000: se muestra "Probablemente faltan movimientos por registrar" sin bloquear el botón.
- [ ] Una cuenta `wallet` o `bank` con saldo negativo muestra el aviso y su acceso a **Conciliar**; `cash` y `other` no lo muestran.
- [ ] Una cuenta de otro espacio o de otro usuario nunca se puede conciliar: la action falla y la RLS impide ver o insertar (probado con dos usuarios).
- [ ] Una cuenta en un espacio marcado para borrar no se puede conciliar (`requireWritableWorkspace`).
- [ ] Con `opening_balance_on` posterior a un movimiento, ese movimiento se suma sin el saldo inicial en `account_balance_at` y en `account_balances`.
- [x] Con `opening_balance_on` nulo, los saldos actuales no cambian.
- [ ] El diálogo de cuenta muestra y guarda la fecha del saldo inicial.
- [ ] Tras crear el ajuste hay toast de éxito y se actualizan cuentas, movimientos y resumen sin recargar.
- [ ] Controles de 44 px o más en móvil, AA en claro y oscuro, sin `<h1>` repetido.
- [x] `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan; `database.ts` regenerado y con Prettier.
- [x] `docs/producto.md`, `docs/ui.md` y `[Unreleased]` (en inglés) documentan el cambio.

## Decisiones

- **Sí:** `opening_balance_on` nulo conserva el comportamiento actual. Motivo: no cambia ningún saldo existente al migrar.
- **Sí:** la diferencia se recalcula en el servidor; el cliente solo la muestra. Motivo: nunca confiar en un monto calculado por el navegador.
- **Sí:** el ajuste se crea sin hora y al final del día elegido. Motivo: la conciliación es del cierre del día, no de un instante.
- **Sí:** umbrales 5 % / $50.000 como constantes en `SITE`, y el aviso no bloquea (solo informa).
- **Sí:** función SQL con `security invoker` para que la RLS aplique igual que en `account_balances`.
- **Sí:** disponible también en cuentas de Empresa (comparten tabla y reglas).
- **No:** tabla `reconciliations`. El ajuste con su nota basta y evita otro modelo.
- **No:** corregir `opening_balance` automáticamente al conciliar; se prefiere un ajuste visible y reversible.
- **Descartado:** parámetro nuevo en `account_balances`. Una función separada por cuenta es más simple de llamar desde el diálogo.

## Riesgos

- **Ajuste con fecha pasada:** el saldo a esa fecha queda en el real, pero el saldo de hoy se mueve por los movimientos posteriores. El diálogo lo explica con una línea de ayuda (`HelpHint`).
- **Divergencia entre `account_balances` y `account_balance_at`:** deben compartir las mismas reglas; conviene que `account_balances` use la misma lógica o se cubra con una comprobación manual de cuentas conocidas.
- **Saldo cercano a 0 y porcentaje:** el 5 % de un saldo casi 0 es casi 0; por eso se usa "o $50.000". Documentar la regla.
