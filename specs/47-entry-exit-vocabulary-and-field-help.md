# SPEC 47 — Vocabulario Entrada / Salida y ayuda (?) en cada campo

> **Estado:** Aprobado
> **Depende de:** SPEC 13, SPEC 14, SPEC 46
> **Fecha:** 2026-11-18
> **Objetivo:** Que la app hable de entradas y salidas y que cada campo de formulario explique qué poner con un ícono (?) al pasar el mouse.

## Por qué existe este spec

Hay textos que confunden. Ingreso / Gasto conviven con Ventas / Costos y gastos en Empresa. "Registrar pago" aparece en formularios que registran otras cosas. Campos como **Cupo**, **Día de corte**, **Pago mínimo** o **E.A. / M.V.** no dicen qué hay que escribir. Hoy `HelpHint` (ícono (i) por clic) solo explica conceptos sueltos, en 9 archivos. Ningún campo de formulario tiene ayuda propia.

Este spec cubre el vocabulario y las ayudas por campo. El resto de la auditoría de textos va en SPEC 48.

## Alcance

**Entra:**

- **Vocabulario de movimientos en toda la UI** (Personal, Empresa, landing, tours, reportes, exportes): Ingreso → **Entrada**, Gasto → **Salida**. En Empresa, Ventas → **Entradas** y Costos y gastos → **Salidas**. Ver el glosario.
- **"Pago" fuera de los tipos de deuda**: los botones, títulos y toasts que registran algo genérico pasan a **Registrar movimiento** / **Movimiento registrado**.
- **Exportes** (`.xlsx`, `.csv` y `.pdf`): encabezados, hojas y textos con el vocabulario nuevo.
- **Ayuda por campo**: componente `FieldLabel`, que es la etiqueta más un ícono `MessageCircleQuestion` (globito con ?) a la derecha.
  - Muestra un `Tooltip` de HeroUI con la explicación.
  - Se abre al pasar el mouse. Como el disparador es un botón enfocable, también se abre al llegar con Tab, que es el comportamiento por defecto del Tooltip.
- **Todos los campos de todos los formularios** llevan su ayuda: `TextField`, `Select`, `DatePickerField`, `TimePickerField`, `Switch`, `Checkbox`, `RadioGroup` y `ToggleButtonGroup` con etiqueta visible. Ver el inventario.
- Textos de ayuda en `FIELD_HELP` (`src/config/help.ts`).

**Fuera de alcance:**

- **Gastos fijos** e **Ingresos fijos**: conservan su nombre (módulos, aside, títulos y entidades "gasto fijo" / "ingreso fijo").
- **Pago** y **Abono** como tipos de movimiento de una deuda: se quedan. Su ayuda ya existe en `entryTypeInfo`.
- **MCP**: las descripciones de las tools, `catalog.ts` y la página `/mcp` siguen con income/expense e ingreso/gasto.
- **Datos**: los valores en base de datos (`income`, `expense`), las rutas y los nombres de variables o funciones no cambian.
- **Videos** ya renderizados de la landing (`public/videos/`).
- Abrir la ayuda con un toque en móvil.
- El resto de la auditoría de textos (títulos, vacíos, errores, tours y recomendaciones) va en SPEC 48.

## Glosario

Solo cambia el texto visible. Las mayúsculas siguen el contexto (título, opción o frase).

| Antes                                             | Ahora                                               |
| ------------------------------------------------- | --------------------------------------------------- |
| Ingreso / Ingresos                                | Entrada / Entradas                                  |
| Gasto / Gastos                                    | Salida / Salidas                                    |
| Ventas (Empresa)                                  | Entradas                                            |
| Costos y gastos / Costo o gasto (Empresa)         | Salidas / Salida                                    |
| Ingresos y gastos                                 | Entradas y salidas                                  |
| Ingresos vs. gastos                               | Entradas vs. salidas                                |
| Ingreso y gasto a la vez                          | Entrada y salida a la vez                           |
| Elige ingreso o gasto                             | Elige entrada o salida                              |
| Categoría de gasto / Elige una categoría de gasto | Categoría de salida / Elige una categoría de salida |
| Registrar como ingreso / como gasto               | Registrar como entrada / como salida                |
| Registrar también como gasto/ingreso              | Registrar también como salida/entrada               |
| ¿Cómo se sabe si es ingreso o gasto?              | ¿Cómo se sabe si es entrada o salida?               |
| Una columna para ingresos y otra para gastos      | Una columna para entradas y otra para salidas       |
| Otro ingreso (origen de la entrada)               | Otra entrada                                        |
| Registrar operación (Empresa)                     | Registrar movimiento                                |
| Registrar pago (botones genéricos)                | Registrar movimiento                                |
| Pago registrado (toast genérico)                  | Movimiento registrado                               |
| Reactiva la deuda para registrar pagos            | Reactiva la deuda para registrar movimientos        |
| No se pudo guardar el pago. Intenta de nuevo      | No se pudo guardar el movimiento. Intenta de nuevo  |

Se mantienen: "Gasto fijo", "Ingreso fijo", "Día de pago", "Mes de pago", "Marcar como pagada", los tipos Pago y Abono de una deuda, "Pago de tarjeta" y los textos ligados a un gasto fijo ("Pago {nombre} · {periodo}"). En esos casos "pago" significa pagar algo concreto, no registrar un movimiento cualquiera.

## Modelo de datos

No hay tablas ni migraciones nuevas. Solo hay configuración nueva en `src/config/help.ts`:

```ts
// Ayuda de cada campo (ícono ? de FieldLabel). Una frase corta en tuteo,
// con ejemplo si ayuda. Clave: "<formulario>.<campo>" o "common.<campo>"
export const FIELD_HELP = {
  "common.amount": "El valor, sin signo de pesos. Ej.: 150.000.",
  "debt.creditLimit":
    "Lo máximo que el banco te deja gastar con la tarjeta. Aparece en tu extracto o en la app del banco."
  // …
} as const

export type FieldHelpKey = keyof typeof FIELD_HELP
```

Componente nuevo `src/components/forms/field-label.tsx`:

```tsx
<FieldLabel help="debt.creditLimit">Cupo</FieldLabel>
// → <Label>Cupo</Label> + <Tooltip> con botón isIconOnly (MessageCircleQuestion, size-3.5)
//   aria-label="Ayuda: Cupo"; el Tooltip.Content muestra FIELD_HELP[help]
```

- Color del ícono: `text-muted/80` en reposo y `text-muted` al pasar el mouse o con foco. Debe dar al menos 3:1 sobre `--surface` y `--overlay`, en claro y en oscuro (contraste mínimo de un gráfico, WCAG 1.4.11). Si `/80` no llega, se usa `text-muted` sin opacidad.
- El botón mide 24 px (`size-6`) y va en línea con la etiqueta. No cambia la altura del campo.
- `FieldHelp` es el (?) suelto, para etiquetas que no son un `Label` (el texto de un `Switch`). `FieldLabel` lo usa por dentro.
- `Field` (deudas), `AmountField`, `DayField`, `AccountSelectField`, `CategorySelectField`, `DatePickerField`, `TimePickerField` y `form-field.tsx` (auth) reciben una prop `help?: FieldHelpKey` y usan `FieldLabel`.

## Textos de ayuda (inventario)

Las claves `common.*` se reusan cuando el campo significa lo mismo. Si un formulario necesita un matiz, tiene su propia clave.

**Comunes:**

| Clave                   | Texto                                                                |
| ----------------------- | -------------------------------------------------------------------- |
| `common.amount`         | El valor, sin signo de pesos. Ej.: 150.000.                          |
| `common.date`           | El día en que pasó. Por defecto, hoy.                                |
| `common.time`           | Opcional. Ordena los movimientos de un mismo día.                    |
| `common.note`           | Un detalle para recordar después. Solo lo ves tú.                    |
| `common.description`    | El texto que verás en la lista de movimientos. Ej.: Mercado del mes. |
| `common.account`        | La cuenta de donde sale o a donde entra el dinero.                   |
| `common.category`       | Agrupa el movimiento en reportes y presupuestos.                     |
| `common.from`           | Primer día que se tiene en cuenta.                                   |
| `common.until`          | Último día. Déjalo vacío si no tiene fin.                            |
| `common.frequency`      | Cada cuánto se repite.                                               |
| `common.defaultAccount` | La cuenta que se elige sola al registrar. Puedes cambiarla cada vez. |

**Movimiento** (`transaction-dialog.tsx`): `transaction.type` "Entrada: dinero que te llega. Salida: dinero que sale. Traspaso: mueves dinero entre tus cuentas." (va en una etiqueta visible **Tipo** sobre el selector, que pasa de `aria-label` a `aria-labelledby`) · `transaction.invoice` "Número de la factura, si quieres buscarla después." · `transaction.counterparty` (Cliente / Proveedor en Empresa) "A quién le vendiste o a quién le pagaste. Opcional." Además usa amount, date, time, account, category, description y note.

**Traspaso** (`transfer-dialog.tsx`, `payment-account-section.tsx`): `transfer.from` "La cuenta de donde sale el dinero." · `transfer.to` "La cuenta a donde llega." · `transfer.amount` "Cuánto mueves. No cuenta como entrada ni salida." · `transfer.before` (Switch **Traspasar fondos antes**) "Si a la cuenta no le alcanza, mueve primero dinero desde otra de tus cuentas."

**Cuenta** (`account-dialog.tsx`): `account.name` "Cómo la reconoces. Ej.: Ahorros Banco, Efectivo." · `account.type` "Banco, efectivo o billetera digital. Solo cambia el ícono y cómo se agrupa." · `account.openingBalance` "El dinero que tenía la cuenta cuando empezaste a usar Tesoro." · `account.openingBalanceDate` "El día de ese saldo. Los movimientos anteriores no lo cambian."

**Conciliar y actualizar saldo** (`reconcile-dialog.tsx` y los `adjust-balance-dialog.tsx` de cuentas y deudas): `balance.real` "El saldo que ves hoy en tu banco, billetera o extracto." · `balance.date` "El día de ese saldo. Tesoro crea un ajuste por la diferencia."

**Deuda** (`debt-dialog.tsx`):

| Clave                     | Texto                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `debt.kind`               | Tarjeta: tiene cupo y la usas para comprar. Préstamo: recibiste un monto y lo pagas en cuotas.      |
| `debt.name`               | Cómo la reconoces. Ej.: Tarjeta Visa, Crédito del carro.                                            |
| `debt.institution`        | El banco o la persona a quien le debes.                                                             |
| `debt.currentBalance`     | Lo que debes hoy. Aparece en tu extracto o en la app del banco.                                     |
| `debt.creditLimit`        | Lo máximo que el banco te deja gastar con la tarjeta. Aparece en tu extracto o en la app del banco. |
| `debt.monthlyInstallment` | Lo que pagas cada mes por el préstamo.                                                              |
| `debt.interestRate`       | La tasa que cobra el banco. Escríbela como sale en el contrato o el extracto. Ej.: 28,5.            |
| `debt.rateType`           | E.A.: efectiva anual. M.V.: mes vencido (mensual). Elige la que diga tu banco.                      |
| `debt.dueDay`             | El último día del mes para pagar sin mora.                                                          |
| `debt.minimumPayment`     | Lo mínimo que debes pagar en el mes para no quedar en mora. Aparece en tu extracto.                 |
| `debt.cutoffDay`          | El día en que el banco cierra el extracto. Lo que compres después pasa al mes siguiente.            |
| `debt.feeAmount`          | Lo que cobra el banco cada mes por tener la tarjeta.                                                |
| `debt.feeDay`             | El día del mes en que el banco cobra la cuota de manejo.                                            |
| `debt.originalAmount`     | El monto que te prestaron al inicio. Sirve para ver cuánto llevas pagado.                           |
| `debt.termMonths`         | En cuántos meses lo pagas en total.                                                                 |
| `debt.defaultAccount`     | La cuenta de donde sueles pagar esta deuda. Se elige sola al registrar.                             |

**Movimiento de deuda** (`payment-dialog.tsx`, `debt-entry-dialog.tsx`): `debtEntry.debt` "La tarjeta o el préstamo al que pertenece." · `debtEntry.type` "Elige qué pasó. Debajo ves si sube o baja el saldo." · `debtEntry.installments` "En cuántas cuotas difieres la compra o el avance. Vacío: una sola." · `debtEntry.direction` "Sube: el saldo aumenta (intereses, cargos). Baja: el saldo disminuye."

**Me deben** (`receivable-dialog.tsx`, `receivable-collect-form.tsx`):

| Clave                       | Texto                                                                  |
| --------------------------- | ---------------------------------------------------------------------- |
| `receivable.name`           | Qué te deben. Ej.: Préstamo a Ana.                                     |
| `receivable.debtor`         | Quién te debe.                                                         |
| `receivable.mode`           | Único: te pagan todo de una vez. Mensual: te pagan una cuota cada mes. |
| `receivable.amount`         | Lo que te deben en total.                                              |
| `receivable.monthlyAmount`  | Lo que te pagan cada mes.                                              |
| `receivable.installments`   | Cuántas cuotas faltan por cobrar.                                      |
| `receivable.expectedDate`   | Cuándo esperas que te paguen. Opcional.                                |
| `receivable.collectAccount` | La cuenta donde recibes el dinero.                                     |
| `receivable.collectHow`     | Cuota: cobras un mes. Varios meses: llenas varias cuotas de una vez.   |

**Meta y aporte** (`goal-dialog.tsx`, `contribution-dialog.tsx`): `goal.name` "Para qué ahorras. Ej.: Viaje, Fondo de emergencia." · `goal.target` "Cuánto quieres juntar." · `goal.targetDate` "Para cuándo. Opcional: sin fecha no hay ritmo sugerido." · `contribution.type` "Aporte: sumas a la meta. Retiro: sacas de ella."

**Presupuesto** (`budget-dialog.tsx`): `budget.category` "La categoría de salida que quieres limitar." · `budget.amount` "Lo máximo que quieres gastar en el mes en esa categoría."

**Gasto fijo** (`recurring-expense-dialog.tsx`): `recurringExpense.name` "Qué pagas. Ej.: Arriendo, Internet." · `recurringExpense.amount` "Lo que pagas cada vez." · `recurringExpense.day` "El día en que vence cada mes." · `recurringExpense.month` "El mes en que vence, si es anual."

**Ingreso fijo** (`recurring-income-dialog.tsx`, `income-source-field.tsx`): `recurringIncome.name` "De dónde viene. Ej.: Salario, Arriendo." · `recurringIncome.expected` "Lo que esperas recibir cada vez." · `recurringIncome.secondDay` "Para quincenas: el otro día del mes en que te pagan." · `recurringIncome.weekday` "El día de la semana en que te pagan." · `recurringIncome.everyDays` "Cada cuántos días llega. Ej.: 10." · `recurringIncome.source` "El ingreso fijo al que corresponde esta entrada, si aplica."

**Empresa** (`business-dialog.tsx`): `business.name` "El nombre de tu negocio." · `business.taxId` "El NIT de la empresa. Opcional." · `business.sector` "A qué se dedica. Ajusta las recomendaciones."

**Importar** (`file-step`, `table-step`, `columns-step`, `preview-step`): `import.file` "Un .xlsx o .csv exportado de tu banco o de otra app." · `import.headerRow` "La fila donde están los nombres de las columnas." · `import.firstColumn` / `import.lastColumn` "Desde y hasta qué columna leer." · `import.dateFormat` "Cómo vienen las fechas en el archivo." · `import.amountSign` "Una columna: el signo dice si es entrada o salida. Dos columnas: una para cada una." · `import.alsoRegister` "Además de la deuda o la meta, crea el movimiento en tus cuentas."

**Exportar** (`export-dialog.tsx`): `export.format` "Excel o CSV para tus datos; PDF para leer o imprimir." · `export.period` "Qué rango de fechas incluye." · `export.inkSaver` "Fondo blanco y menos color para imprimir." · `export.orientation` / `export.size` "Cómo se imprime la hoja."

**Cuenta de usuario y auth** (`profile-form`, `password-form`, `currency-form`, `delete-*-dialog`, `form-field`): `profile.name` "Cómo te saluda Tesoro." · `password.current` "La que usas hoy para entrar." · `password.new` "Mínimo 8 caracteres." · `currency.code` "Solo cambia cómo se muestran los montos. No convierte valores." · `confirm.typeToDelete` "Escríbelo igual para confirmar. No se puede deshacer." · `auth.email` "El correo con el que entras." · `auth.password` "Mínimo 8 caracteres." Los mínimos se verifican contra los esquemas de Zod antes de escribirlos.

**Filtros y periodos** (`transactions-filters`, `report-period-picker`, `verify-movements-dialog`, `occurrence-select`): `filters.search` "Busca en la descripción y la nota." · `filters.type` "Muestra solo entradas, salidas o traspasos." · `common.period` "El rango de fechas que se muestra." · `verify.account` "La cuenta cuyos movimientos vas a revisar." · `occurrence.select` "El periodo del gasto fijo que estás pagando."

`mcp/connections-list` (**Acceso**): `mcp.access` "Qué puede hacer el agente: solo leer, o también registrar y editar."

## Plan de implementación

1. Crear `FIELD_HELP` y `FieldHelpKey` en `src/config/help.ts` con todas las claves del inventario.
2. Crear `src/components/forms/field-label.tsx` (`Label` + `Tooltip` + `MessageCircleQuestion`). Verificar el contraste del ícono en claro y en oscuro.
3. Agregar la prop `help` a los campos compartidos (`Field`, `AmountField`, `DayField`, `AccountSelectField`, `CategorySelectField`, `DatePickerField`, `TimePickerField` y `form-field.tsx`).
4. Conectar las ayudas, una área por commit: movimientos y traspasos → cuentas → deudas y Me deben → metas y presupuestos → fijos → Empresa → importar y exportar → cuenta y auth → filtros y periodos.
5. Aplicar el glosario en Personal: diálogo de movimiento, filtros, tablas, badges, resumen, reportes, importar y tours (`src/config/tutorials.ts`).
6. Aplicar el glosario en Empresa: flujo de caja, movimientos, reportes y score del negocio.
7. Aplicar el glosario en `SITE` (landing, funciones, SEO), `HELP` y la landing.
8. Aplicar el glosario en los exportes (`workbook/`, `pdf/`, CSV).
9. Reemplazar los "pago" genéricos de la tabla. Revisar con `grep -rniE "\b(ingreso|gasto|venta|pago)s?\b" src app` que cada coincidencia restante esté en las excepciones.
10. Actualizar `docs/ui.md` (sección de `FieldLabel` y glosario), `docs/producto.md` (vocabulario) y `CHANGELOG.md` en `[Unreleased]`.

## Criterios de aceptación

- [ ] El diálogo de movimiento muestra los tipos **Entrada**, **Salida** y **Traspaso**.
- [ ] En Empresa no aparece "Ventas" ni "Costos y gastos" en el aside, los títulos, los reportes ni el flujo de caja. Dice "Entradas" y "Salidas".
- [ ] El aside sigue diciendo "Gastos fijos" e "Ingresos fijos".
- [ ] Los tipos de un movimiento de deuda siguen siendo Pago y Abono.
- [ ] Ningún botón ni toast genérico dice "Registrar pago" o "Pago registrado".
- [ ] El `.xlsx`, el `.csv` y el `.pdf` usan Entradas / Salidas en encabezados y totales.
- [ ] Las descripciones de las tools del MCP no cambian (`git diff src/features/mcp/tools` vacío).
- [ ] Cada campo con etiqueta visible de los formularios del inventario tiene el ícono (?) a la derecha de la etiqueta.
- [ ] Al pasar el mouse por el (?) de **Cupo**, aparece "Lo máximo que el banco te deja gastar con la tarjeta…".
- [ ] Con Tab, el (?) recibe foco y muestra el tooltip.
- [ ] El ícono da ≥ 3:1 sobre `--surface` y `--overlay` en claro y en oscuro.
- [ ] `FIELD_HELP` no tiene claves sin usar (`grep` por cada clave).
- [ ] `pnpm check`, `pnpm eslint` y `pnpm prettier:check` pasan.

## Decisiones

- **Sí:** Entrada / Salida en toda la app, Empresa incluida. Un solo vocabulario entre espacios.
- **No:** "Salidas fijas" / "Entradas fijas". "Gastos fijos" e "Ingresos fijos" ya se entienden y el usuario los conoce.
- **No:** cambiar Pago / Abono de deudas. La diferencia ya se explica en `entryTypeInfo`.
- **Sí:** los exportes adoptan el vocabulario: los lee el usuario.
- **No:** el MCP. Los agentes y sus prompts dependen de income/expense e ingreso/gasto.
- **Sí:** ayuda en todos los campos, incluidos Nombre y Nota. Es consistente y no hay que decidir campo por campo.
- **Sí:** Tooltip al pasar el mouse, como pidió el usuario. La apertura con Tab viene gratis con el Tooltip de HeroUI.
- **No:** Popover por clic (como `HelpHint`) para los campos. El usuario prefirió el hover.
- **Sí:** `FieldLabel` aparte de `HelpHint`. HelpHint explica conceptos con clic; FieldLabel explica qué escribir en un campo.
- **Sí:** textos en `FIELD_HELP` y no en cada componente. Una sola fuente, fácil de revisar.
- **Sí:** separar la auditoría del resto de textos en SPEC 48, para verificar cada uno por separado.

## Riesgos

| Riesgo                                                                | Mitigación                                                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| En móvil no hay hover: la ayuda no se abre al tocar                   | Decisión del usuario. Queda anotado; si molesta, un spec aparte cambia el disparador a toque. |
| Ícono "oscuro" por debajo de 3:1                                      | El criterio exige 3:1. Si `text-muted/80` no llega, se usa `text-muted`.                      |
| Un reemplazo masivo toca textos excluidos (Gasto fijo, Pago de deuda) | Reemplazo a mano por área, con el `grep` del paso 9 y la lista de excepciones.                |
| Usuarios con capturas o costumbre de "Ingreso/Gasto"                  | Mismo color y orden de opciones; solo cambia la palabra.                                      |
| Textos de ayuda que no coinciden con los esquemas (mínimos, formatos) | Paso 1: cada número de `FIELD_HELP` se verifica contra su esquema Zod.                        |

## Lo que **no** entra en este spec

- Cambiar los nombres de Gastos fijos e Ingresos fijos.
- Cambiar los tipos Pago y Abono de deudas.
- Las descripciones del MCP y la página `/mcp`.
- Volver a renderizar los videos de la landing.
- Abrir la ayuda con un toque en móvil.
- La auditoría de títulos, vacíos, errores, tours y recomendaciones (SPEC 48).
