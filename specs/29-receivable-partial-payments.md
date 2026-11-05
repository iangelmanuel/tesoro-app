# SPEC 29 — Abonos parciales e historial de la cuota en Me deben mes a mes

> **Estado:** Implementado
> **Depende de:** SPEC 28
> **Fecha:** 2026-11-05
> **Objetivo:** Que una cuota mensual pueda recibir abonos parciales sin quedar marcada como pagada, y que el valor de la cuota pueda cambiar con el tiempo sin dañar los meses anteriores.

## Por qué existe este spec

SPEC 28 marca una cuota como pagada con cualquier cobro, sin importar el monto, y admite un solo cobro por cuota. En la práctica la gente paga de menos (falta $100) o completa después. Además, el valor de una cuota indefinida cambia (una suscripción sube de precio) y un solo `installment` no sirve para los meses anteriores.

## Alcance

**Entra:**

- **Varios abonos por cuota.** Se quita el índice único `debt_entries_one_payment_per_period`.
- **Estados** (`receivable-schedule.ts`): **Pagada** si los abonos suman el valor de la cuota o más; **Abonada** si suman menos; **Atrasada** / **Pendiente** sin abonos, como en SPEC 28.
- **Fila de una cuota abonada:** "Abonó X de Y · vence el …", "Falta Z" y el botón **Abonar**, que abre el cobro prellenado con lo que falta.
- **Historial del valor** (`receivable_installment_history`, solo mensuales indefinidas): filas `(through_period, amount)`. El valor de un mes es el de la fila con el menor `through_period` ≥ mes; sin fila, `debts.installment`.
- **Editar el monto** de una indefinida que empezó antes de este mes guarda el valor anterior hasta el mes pasado, si el historial aún no lo cubre.
- **Por cobrar a la fecha:** lo que falta de las cuotas hasta el mes actual, en la tarjeta y sumado a "Te deben".

**No entra:**

- Pantalla para editar el historial del valor a mano.
- Repartir un pago grande entre varias cuotas desde la UI: cada abono va a una cuota.

## Criterios de aceptación

- [x] Una cuota con un abono menor a su valor queda **Abonada** con lo que falta.
- [x] Un segundo abono que completa el valor la deja **Pagada**.
- [x] Una abonada vencida cuenta en el badge de cuotas atrasadas.
- [x] Cambiar el monto de una indefinida no vuelve abonadas las cuotas pasadas.
- [x] "Te deben" incluye lo que falta de las indefinidas hasta el mes actual.
