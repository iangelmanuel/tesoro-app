# SPEC 46 — Registrar cualquier tipo de movimiento de una deuda

> **Estado:** En verificación
> **Depende de:** SPEC 17, SPEC 36, SPEC 41, SPEC 42
> **Fecha:** 2026-11-18
> **Objetivo:** Que registrar un movimiento de una deuda ofrezca los mismos tipos que editarlo.

## Por qué existe este spec

El editor de SPEC 42 permite Pago, Abono, Compra, Avance, Cuota de manejo y Ajuste. Registrar solo tenía Pago, Abono y Compra (el avance dependía de elegir cuenta), y el botón decía "Registrar pago" aunque también registraba compras.

## Alcance

**Entra:**

- El formulario de registrar (`PaymentForm`: botón del Sheet, **Más → Movimiento de deuda** y tab **Deuda**) usa el select **Tipo** del editor con `entryTypesFor` y `entryTypeInfo`:
  - tarjeta: Pago, Abono, Compra, Avance, Cuota de manejo y Ajuste;
  - préstamo: Pago, Abono y Ajuste.
- Pago y Abono: `recordPayment`, sin cambios (monto, nota y descripción prellenados, SPEC 41).
- Compra y Avance: `recordAdvance`. La compra no muestra cuenta; el avance la exige (también en el servidor con `type = advance`).
- Cuota de manejo y Ajuste (con **Sube** / **Baja**): action nueva `recordDebtCharge` (`debtChargeSchema`) que inserta en `debt_entries` sin cuenta ni movimiento. Valida deuda activa y que el tipo aplique (`entryTypesFor`).
- Textos: botón y título **Registrar movimiento**; menú **Movimiento de deuda**. Con saldo 0, una tarjeta igual puede abrir el formulario.

**Fuera de alcance:** el cobro de Me deben (SPEC 39), el MCP y **Actualizar saldo**, que sigue igual.

## Criterios de aceptación

- [ ] En una tarjeta, el select Tipo muestra los seis tipos con su ayuda; en un préstamo, Pago, Abono y Ajuste.
- [ ] Registrar una cuota de manejo sube el saldo y aparece en el historial como "Cuota de manejo".
- [ ] Un ajuste que baja deja el saldo menor; si lo dejaría negativo, muestra el error.
- [ ] Un avance sin cuenta no se guarda y pide la cuenta.
- [ ] El botón del Sheet dice "Registrar movimiento" y el menú Más "Movimiento de deuda".
- [x] `pnpm check` y `pnpm eslint` pasan.
