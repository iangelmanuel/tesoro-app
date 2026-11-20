# SPEC 52a — Personal en shadcn: formularios, Resumen, Movimientos y Cuentas

> **Estado:** Aprobado
> **Depende de:** SPEC 27, SPEC 47, SPEC 49, SPEC 51
> **Fecha:** 2026-11-20
> **Objetivo:** Migrar a shadcn (Base UI) los formularios compartidos y las pantallas Resumen, Movimientos y Cuentas de Personal, con sus diálogos, Sheets, skeletons y menú contextual, sin cambiar las server actions.

## Por qué existe este spec

SPEC 51 dejó la base: tokens, primitivas en `src/components/ui/`, shell, compartidos del dashboard, menús rápidos y la regla de skeletons. Migrar todo Personal de una vez son ~25.000 líneas de componentes. Por eso SPEC 52 se parte en tres:

- **SPEC 52a** (este): `src/components/forms/*`, categorías, Resumen, Movimientos y Cuentas. Es la base que reusan las demás pantallas y Empresa.
- **SPEC 52b**: Ingresos fijos, Gastos fijos, Presupuestos, Metas y Deudas.
- **SPEC 52c**: Reportes, Recomendaciones e Importar.

SPEC 53 sigue igual: Empresa, cuenta, auth, públicas y retiro de HeroUI.

Varios componentes de este spec también los usa Empresa (`TransactionDialog`, `TransferDialog`, componentes de cuentas, tarjetas de reportes) o los usan diálogos aún en HeroUI (los campos de `src/components/forms/*`). Se migran **en sitio**: una sola versión, que Empresa y las pantallas sin migrar heredan desde ya.

## Alcance

**Entra:**

### 1. Formularios compartidos (`src/components/forms/*`)

- **`DatePickerField`**: `Calendar` de shadcn (react-day-picker) dentro de un `Popover`, en todo tamaño de pantalla.
  - Misma API pública: `name`, `label`, `value` / `onChange` en `YYYY-MM-DD`, `error`, `isRequired`, `minValue`, `maxValue`, `className`, `help`.
  - Sigue sin conversiones de zona horaria: el string `YYYY-MM-DD` se pasa a `Date` local solo para pintar el calendario.
  - Locale `es` de `date-fns` y semana desde el lunes.
  - Ya no importa `@heroui/react` ni `@internationalized/date`.
- **`TimePickerField`**: `<input type="time">` nativo con el estilo de los tokens `--field-*`, más un botón "Quitar hora" cuando tiene valor. Misma API (`HH:MM` o `""`); sigue validando con `timeSchema`.
- **`AccountSelectField`** y **`CategorySelectField`**: `Combobox` de Base UI con búsqueda por nombre.
  - Conservan la opción final "+ Crear cuenta" / "+ Crear categoría" (`create-option.tsx`) que abre el diálogo de creación.
  - Misma API pública que hoy; los consumidores no cambian.
- **`FieldLabel`**: sobre `Label` de `src/components/ui/`, con el `HelpHint` de `FIELD_HELP` (SPEC 47).
- **Puente con HeroUI:** cuando uno de estos campos vive dentro de un `Modal` de HeroUI (pantallas aún sin migrar, Empresa, cuenta), su `Popover` / lista se monta dentro del contenedor del modal con `PortalContainerProvider` (`src/components/ui/portal-container.tsx`). Así el foco y el `inert` del modal no lo bloquean. La lógica vive junto a `heroui-compat.ts` y se borra en SPEC 53.

### 2. Categorías (`src/features/categories/components/*`)

- `CategoryBadge`, `CategoryDialog`, `CategoryForm`, `IconColorPicker` y `CategoriesSheet`.
- `CategoryBadge` mantiene props; todas las pantallas que lo usan lo heredan.

### 3. Resumen (`app/dashboard/personal/page.tsx`)

- Todas las tarjetas que pinta, aunque vivan en otra feature:
  - KPIs con `StatCard`;
  - `IncomeExpenseChart`, `RecentTransactions`, `NoPeriodData` (`reports`);
  - `ScoreSummaryCard` (`score`);
  - `AccountsCard` (`accounts`);
  - `BudgetsAtRiskCard` (`budgets`), `DebtsCard` (`debts`), `GoalsCard` (`goals`), `UpcomingPaymentsCard` (`recurring-expenses`);
  - `NoTransactions` (`transactions-empty.tsx`).
- Cada una exporta su `…Skeleton` en el mismo archivo. `SummarySkeleton` los compone; se retira `CardSkeleton` de la página.

### 4. Movimientos (`app/dashboard/personal/transactions/page.tsx`)

- Todo `src/features/transactions/components/*`:
  - `TransactionsTable` (con `ScrollTable` de SPEC 51), `TransactionsFilters` (en móvil, en `Sheet`), `TransactionsTotals`, `TransactionsPagination`, `TransactionsEmpty`, `WorkspaceNoTransactions`;
  - `TransactionDialog` (incluida la opción "Traspaso"), `DuplicateTransactionDialog`, `VerifyMovementsDialog`, `VerifyRow`, `RecordedPaymentActions`.
- Filas de la tabla envueltas con `RowContextMenu`, con la misma lista de acciones que su botón ⋯.
- El reordenamiento por día (SPEC 19) sigue funcionando y no choca con la pulsación larga del menú contextual.

### 5. Cuentas (`app/dashboard/personal/accounts/page.tsx`)

- Todo `src/features/accounts/components/*`: `AccountCard`, `AccountsCard`, `AccountsGrid`, `ArchivedAccounts`, `AccountSelect`, `AccountDialog`, `AdjustBalanceDialog`, `ReconcileDialog`, `TransferDialog`, `PaymentAccountSection`.
- `PaymentAccountSection` se migra aunque hoy la usen `PaymentDialog` y `ContributionDialog` (HeroUI, SPEC 52b); entra por el puente del §1.
- Tarjetas de cuenta con `RowContextMenu` (clic derecho y pulsación larga), con las mismas acciones que su menú.

### 6. Reglas comunes

- Formularios con `useActionState` + Zod y **las mismas server actions**. No cambian `actions.ts`, `schemas.ts` ni las consultas.
- Campos con `Field` + `Label` + `Input` / `Textarea` / `Select` / `Combobox` + `FieldError` de `src/components/ui/`. Errores del servidor con `aria-invalid` y `aria-describedby`; el cliente no valida antes (equivale al `validationBehavior="aria"` de hoy).
- Los campos de monto conservan su formato y parseo actuales.
- Botones con `onClick` / `disabled`; ningún archivo migrado usa `onPress` / `isDisabled`.
- Toasts de los componentes migrados con `toast` de `@/components/ui/sonner`; errores con `role="alert"`.
- **Skeletons (SPEC 51 §6):** cada componente que carga datos exporta su `…Skeleton` en el mismo archivo y con el mismo contenedor. `Suspense` por tarjeta.
- **`loading.tsx`** nuevo en `app/dashboard/personal/`, `personal/transactions/` y `personal/accounts/`, cada uno dentro de `LoadingRegion` y compuesto con los skeletons de su pantalla.
- **Tours (SPEC 27):** todos los `target` de `summary`, `transactions` y `accounts` en `src/config/tutorials.ts` siguen existiendo como `data-tour` en el DOM migrado.
- **Accesibilidad:** AA en claro y oscuro, foco con `outline-ring`, 44 × 44 px de área táctil, `Amount` leído completo, ingresos y gastos con signo e ícono, reflujo sin scroll horizontal a 320 px y a 200 % de zoom, `prefers-reduced-motion`.
- **Impeccable:** `/impeccable audit` y `polish` por pantalla (Resumen, Movimientos, Cuentas y sus diálogos) en claro, oscuro, móvil, tablet y escritorio.
  - Los hallazgos dentro de la dirección "Señalética" de SPEC 51 se corrigen directo.
  - Un cambio grande de layout o de flujo se lista y se pregunta antes de hacerlo.

### 7. Documentación

- `CLAUDE.md` (UI y tema → Formularios y Fechas): patrón nuevo `Field` + `FieldError`, `DatePickerField` con Calendar + Popover, `TimePickerField` nativo, selects con Combobox y el puente de portales. Se anota que el patrón HeroUI (`TextField`, `validationBehavior="aria"`) sigue solo en pantallas sin migrar.
- `docs/ui.md`: campos de formulario, puente de portales y estado de la migración por pantalla.
- `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Ingresos fijos, Gastos fijos, Presupuestos, Metas y Deudas, con `PaymentDialog`, aportes de meta, cobros de Me deben y sus Sheets (**SPEC 52b**).
- Reportes, Recomendaciones e Importar con sus importadores (**SPEC 52c**). De `reports` y `score` solo entran las tarjetas que pinta Resumen.
- Pantallas exclusivas de Empresa, cuenta, auth y públicas; retiro de HeroUI, `@internationalized/date`, `CardSkeleton`, `heroui-bridge.css` y del puente de portales (**SPEC 53**).
- Cambios en server actions, esquemas Zod, consultas o base de datos.
- Calendario en `Drawer` para móvil.
- Pruebas automatizadas en navegador (Playwright, Lighthouse en CI).

## Modelo de datos

Este spec no agrega tablas, migraciones ni cambia tipos de datos. Reusa el modelo de SPEC 02, 08c, 19 y 51.

Las APIs públicas de los campos compartidos se mantienen:

```ts
// src/components/forms/date-picker-field.tsx — sin cambios de props
interface DatePickerFieldProps {
  name: string
  label: string
  value: string // "YYYY-MM-DD" o ""
  onChange: (value: string) => void
  error?: string
  isRequired?: boolean
  minValue?: string // "YYYY-MM-DD"
  maxValue?: string // "YYYY-MM-DD"
  className?: string
  help?: FieldHelpKey
}

// src/components/forms/time-picker-field.tsx — value "HH:MM" o ""
```

## Plan de implementación

1. Puente de portales: hacer que un `Popover` / `Combobox` de Base UI se monte dentro del `Modal` de HeroUI que lo contiene. Probar con un campo de prueba en un diálogo de Deudas.
2. Migrar `FieldLabel` y `DatePickerField`. Los consumidores (HeroUI y nuevos) siguen funcionando sin tocarlos.
3. Migrar `TimePickerField` a `input type="time"`.
4. Migrar `AccountSelectField` y `CategorySelectField` a `Combobox`, con "+ Crear".
5. Migrar `src/features/categories/components/*` (badge, form, dialog, picker, sheet).
6. Migrar los diálogos de cuentas: `AccountDialog`, `AdjustBalanceDialog`, `ReconcileDialog`, `TransferDialog`, `PaymentAccountSection`.
7. Migrar `AccountCard`, `AccountsGrid`, `AccountsCard`, `ArchivedAccounts`, `AccountSelect` con skeletons y `RowContextMenu`; página de Cuentas y su `loading.tsx`.
8. Migrar `TransactionDialog` (incluido Traspaso) y `DuplicateTransactionDialog`.
9. Migrar `VerifyMovementsDialog`, `VerifyRow` y `RecordedPaymentActions`.
10. Migrar `TransactionsFilters`, `TransactionsTotals`, `TransactionsPagination` y vacíos, con skeletons.
11. Migrar `TransactionsTable` con `RowContextMenu` y reordenamiento; página de Movimientos y su `loading.tsx`.
12. Migrar las tarjetas de Resumen (`reports`, `score`, `budgets`, `debts`, `goals`, `recurring-expenses`) con skeletons; página de Resumen, `SummarySkeleton` y su `loading.tsx`.
13. Pasar a sonner los toasts de todo lo migrado.
14. Revisar los `data-tour` de `summary`, `transactions` y `accounts` contra `src/config/tutorials.ts`.
15. `/impeccable audit` y `polish` de Resumen, Movimientos y Cuentas en claro, oscuro, móvil, tablet y escritorio; corregir.
16. Documentación (`CLAUDE.md`, `docs/ui.md`, `CHANGELOG.md`).

## Criterios de aceptación

Verificables en código o con `check`, `eslint`, `prettier:check` y `build`:

- [ ] Ningún archivo de `src/components/forms/*`, `src/features/categories/components/*`, `src/features/accounts/components/*` ni `src/features/transactions/components/*` importa `@heroui/react` ni `@internationalized/date`.
- [ ] Tampoco lo importan las tarjetas de Resumen del §3 ni `app/dashboard/personal/page.tsx`, `transactions/page.tsx` y `accounts/page.tsx`.
- [ ] Ningún archivo migrado usa `CardSkeleton`, `onPress` ni `isDisabled`.
- [ ] Cada componente migrado que carga datos exporta su `…Skeleton` en el mismo archivo.
- [ ] Existen `loading.tsx` en `app/dashboard/personal/`, `personal/transactions/` y `personal/accounts/`, cada uno con `LoadingRegion`.
- [ ] `actions.ts`, `schemas.ts` y `queries.ts` de `transactions`, `accounts` y `categories` no cambian.
- [ ] Las props públicas de `DatePickerField`, `TimePickerField`, `AccountSelectField`, `CategorySelectField` y `CategoryBadge` no cambian.
- [ ] Cada `target` de los tours `summary`, `transactions` y `accounts` en `src/config/tutorials.ts` aparece como `data-tour` en un componente migrado.
- [ ] Todo par texto/fondo nuevo queda en la tabla de contraste de `docs/ui.md` y pasa AA en claro y oscuro.
- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan, con el lockfile sincronizado.

Verificables en navegador (los prueba el usuario a mano):

- [ ] Registrar, editar, duplicar y eliminar un movimiento en Personal funciona, y el toast sale de sonner.
- [ ] Registrar un traspaso desde el diálogo de movimiento mueve el saldo de ambas cuentas.
- [ ] Registrar y editar un movimiento en Empresa sigue funcionando con el diálogo nuevo.
- [ ] Crear, editar, archivar, ajustar saldo y conciliar una cuenta funciona.
- [ ] Crear una categoría desde "+ Crear categoría" del select la deja elegida en el formulario.
- [ ] En un diálogo de Deudas o Metas (aún en HeroUI), elegir fecha, hora y cuenta funciona con mouse, teclado y táctil.
- [ ] Un error de Zod del servidor se muestra bajo su campo y el lector lo anuncia.
- [ ] El calendario abre en la fecha del valor, respeta `minValue` / `maxValue` y empieza la semana en lunes.
- [ ] "Quitar hora" deja el campo vacío y el movimiento se guarda sin hora.
- [ ] Clic derecho sobre una fila de Movimientos o una tarjeta de cuenta muestra las mismas acciones que su botón ⋯; en táctil, una pulsación de 500 ms también.
- [ ] Reordenar movimientos de un día sigue funcionando y no abre el menú contextual.
- [ ] Al pasar de skeleton a contenido, el CLS medido con Lighthouse es ≤ 0.05 en Resumen, Movimientos y Cuentas.
- [ ] Los tours de Resumen, Movimientos y Cuentas recorren todos sus pasos sin saltarse ninguno.
- [ ] Todo control interactivo de las tres pantallas y sus diálogos mide 44 × 44 px o más de área en móvil, tablet y escritorio.
- [ ] Las tres pantallas y sus diálogos no tienen scroll horizontal a 320 px de ancho ni a 200 % de zoom en 1280 px (la tabla de Movimientos se desliza dentro de `ScrollTable`).
- [ ] Un lector de pantalla lee un gasto como "menos" seguido del monto completo, y "Monto oculto" con montos ocultos.
- [ ] `/impeccable audit` de cada pantalla no deja hallazgos críticos ni altos abiertos.

## Decisiones

- **Sí:** partir SPEC 52 en 52a, 52b y 52c. Personal son ~25.000 líneas; la propuesta 52a (Día a día + Tu plan) / 52b quedaba 18.000 contra 5.500.
- **No:** un solo SPEC 52. PR imposible de revisar.
- **Sí:** 52a lleva formularios, categorías, Movimientos y Cuentas. Son la base que reusan 52b, 52c y Empresa.
- **Sí:** migrar en sitio los componentes que comparte Empresa. Una sola versión; Empresa hereda la UI nueva y SPEC 53 solo migra lo exclusivo de Empresa.
- **No:** copia nueva para Personal. Duplicaría código hasta SPEC 53.
- **Sí:** los campos de `src/components/forms/*` se migran en sitio, con un puente de portales para que funcionen dentro de los `Modal` de HeroUI.
- **No:** copia `forms/legacy/*`. Duplica componentes y tienta a dejarlos vivos.
- **Sí:** Resumen migra todas sus tarjetas, aunque vivan en `budgets`, `debts`, `goals`, `recurring-expenses`, `score` o `reports`. La pantalla queda entera en shadcn y 52b/52c las encuentran hechas.
- **Sí:** todo `categories/components` en 52a. `CategoryBadge` está en todas partes y el sheet se abre desde acciones rápidas y el select.
- **Sí:** `PaymentAccountSection` entra con cuentas. **No:** `PaymentDialog`, aportes y cobros; son de Deudas y Metas (SPEC 52b).
- **Sí:** `TimePickerField` con `input type="time"` nativo. Accesible y con selector nativo en móvil; shadcn no trae uno.
- **No:** dos `Select` de hora y minutos. Más clics y más código.
- **Sí:** `DatePickerField` en `Popover` en todo tamaño. El Calendar cabe en 320 px y hay menos casos dentro de diálogos HeroUI.
- **No:** `Drawer` en móvil. Dos ramas de código para el mismo campo.
- **Sí:** APIs públicas de los campos sin cambios. Evita tocar los consumidores en HeroUI.
- **Sí:** las server actions, esquemas y consultas no cambian. Este spec es solo UI.
- **Sí:** `/impeccable` corrige directo dentro de la dirección de SPEC 51; los cambios grandes se preguntan.
- **Sí:** los criterios de navegador los verifica el usuario a mano. No hay sesión de prueba en el entorno de implementación; se separan de los verificables en código, como en SPEC 51.

## Riesgos

| Riesgo                                                                             | Mitigación                                                                                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Un `Popover` o `Combobox` de Base UI dentro de un `Modal` de HeroUI queda inerte   | Puente de portales como paso 1, probado en un diálogo de Deudas antes de migrar los campos; criterio específico.    |
| Migrar en sitio rompe Empresa (`TransactionDialog`, cuentas, tarjetas de reportes) | Props públicas intactas; criterio de registrar y editar un movimiento en Empresa.                                   |
| `Date` local del Calendar corre un día por zona horaria                            | Conversión `YYYY-MM-DD` ↔ `Date` a mediodía local, igual que `monthLabel`; criterio de abrir en la fecha del valor. |
| `input type="time"` se ve distinto por navegador                                   | Estilo con `--field-*` y `appearance` controlada; se revisa en Chrome, Safari iOS y Firefox durante el polish.      |
| La pulsación larga de `RowContextMenu` choca con el reordenamiento de movimientos  | El arrastre usa su asa; la pulsación larga solo en el resto de la fila; criterio específico.                        |
| Dos sistemas de toasts y dos de campos conviven en la misma pantalla de 52b/52c    | Temporal; mismo estilo vía `heroui-bridge.css`. 52b y 52c lo cierran.                                               |
| Los `data-tour` se pierden al reescribir el DOM                                    | Criterio que cruza cada `target` de `tutorials.ts` con el código migrado.                                           |

## Siguientes specs: cuándo y qué pedir

Cada uno se escribe con `/spec` cuando el anterior está en `Implementado` y mergeado en master.

| Orden | Spec     | Cuándo se crea        | Cuándo se implementa |
| ----- | -------- | --------------------- | -------------------- |
| 1     | SPEC 52a | Ya creado             | Tras aprobarlo       |
| 2     | SPEC 52b | Tras mergear SPEC 52a | Tras aprobarlo       |
| 3     | SPEC 52c | Tras mergear SPEC 52b | Tras aprobarlo       |
| 4     | SPEC 53  | Tras mergear SPEC 52c | Tras aprobarlo       |

### Prompt para SPEC 52b (copiar en `/spec`)

```text
SPEC 52b: migrar a shadcn Ingresos fijos, Gastos fijos, Presupuestos, Metas y Deudas de
Personal, siguiendo SPEC 51 y SPEC 52a (campos de forms ya migrados, puente de portales,
regla de skeletons, RowContextMenu, sonner).

Entra:
- Pantallas con sus Sheets de detalle, tabs, historial de meses y listas reordenables.
- Diálogos: PaymentDialog, DebtEntryDialog, duplicar entrada, aportes de meta, cobros
  de Me deben, recibir ingreso, presupuesto, copiar mes anterior.
- Mismas server actions; solo cambia la UI. Toasts a sonner.
- Skeleton en el mismo archivo + loading.tsx por ruta; CLS ≤ 0.05.
- data-tour de los tours de esas pantallas; /impeccable audit y polish; AA + extras de SPEC 51.

Fuera: Reportes, Recomendaciones e Importar (52c); Empresa y retiro de HeroUI (53).
```

### Prompt para SPEC 52c (copiar en `/spec`)

```text
SPEC 52c: migrar a shadcn Reportes, Recomendaciones e Importar de Personal, siguiendo
SPEC 51, 52a y 52b.

Entra:
- Reportes (gráficas, tablas, selector de periodo, exportar), Recomendaciones (score,
  factores, historial, recomendaciones ocultas) e Importar (asistente y sus pasos).
- Mismas server actions; solo cambia la UI. Toasts a sonner.
- Skeleton en el mismo archivo + loading.tsx por ruta; CLS ≤ 0.05.
- data-tour de los tours; /impeccable audit y polish; AA + extras de SPEC 51.
- Al cerrar: ninguna pantalla de /dashboard/personal/** importa @heroui/react.

Fuera: Empresa, cuenta, auth, públicas y retiro de HeroUI (SPEC 53).
```

## Qué no entra en este spec

- Ingresos fijos, Gastos fijos, Presupuestos, Metas y Deudas, con sus diálogos de pago, aportes y cobros (SPEC 52b).
- Reportes, Recomendaciones e Importar (SPEC 52c).
- Empresa, cuenta, auth, públicas y retiro de HeroUI y del puente de portales (SPEC 53).
- Cambios en server actions, esquemas, consultas o base de datos.
- Calendario en `Drawer` para móvil.
- Pruebas automatizadas en navegador.

Cada uno de esos, si llega, va en su propio spec.
