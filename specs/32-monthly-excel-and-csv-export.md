# SPEC 32 — Exportar a Excel y CSV mes a mes

> **Estado:** Implementado
> **Depende de:** SPEC 03, SPEC 04, SPEC 05, SPEC 06, SPEC 08c, SPEC 10, SPEC 11, SPEC 22, SPEC 28, SPEC 30
> **Fecha:** 2026-11-06
> **Objetivo:** Que el usuario descargue desde Reportes un libro `.xlsx` de un espacio (Personal o Empresa) con una hoja de resumen, una hoja por mes y una hoja plana de movimientos, o un `.csv` de movimientos, para un mes, trimestre, año, rango de meses o todo el historial (hasta 36 meses).

## Por qué existe este spec

Los datos del usuario hoy solo se ven dentro de Tesoro. Para presentar sus cuentas a un contador, a la familia o a un banco, o para trabajarlas a su manera, necesita sacarlas en un formato estándar.

El autor llevaba sus finanzas en `FinanzasPersonalesAngel.xlsx`: una hoja por mes con datos del mes, Ingresos, Gastos fijos, Gastos variables, Ahorro, Tarjetas, Transacciones y saldo por cuenta. Este spec toma ese patrón **mes a mes** y lo mejora:

- secciones apiladas en vertical, no lado a lado (se imprimen y se leen en el celular sin desplazar a lo ancho);
- una hoja **Resumen** que compara los meses del periodo;
- una hoja plana **Movimientos** para filtrar o armar tablas dinámicas.

La idea original abarcaba Excel, CSV, Google Sheets y PDF. Se parte en dos:

- **SPEC 32 (este):** Excel y CSV.
- **SPEC 33 (futuro):** reportes PDF con gráficas, encabezados, pie de página y numeración.

Google Sheets no tiene integración propia: abre el `.xlsx` y el `.csv` directamente (Archivo → Importar).

## Alcance

**Entra:**

- **Botón "Exportar"** en los accesos rápidos del header (`quick-actions-menu.tsx`), solo en las rutas de Reportes:
  - `/dashboard/personal/reports`;
  - `/dashboard/business/[id]/reports`.
  - Ícono `Download` de `lucide-react`. Con texto en `≥ 640 px`; solo ícono (44 px, `aria-label="Exportar"`) en pantallas menores.
- **Diálogo `ExportDialog`** (`Modal` de HeroUI):
  - **Formato**: tabs **Excel (.xlsx)** | **CSV (.csv)**, Excel por defecto;
  - **Periodo**: `Select` con **Mes**, **Trimestre**, **Año**, **Rango de meses** y **Todo el historial**;
    - Mes / Trimestre / Año: `Select` del valor (meses, trimestres o años con historial);
    - Rango de meses: `Select` **Desde** y **Hasta** (meses `YYYY-MM`);
    - Todo el historial: del primer mes con un movimiento o traspaso hasta el mes actual;
  - **Prellenado** con el periodo de la página de Reportes: mes, trimestre y año pasan igual; un rango por días pasa a los meses que contienen `from` y `to`;
  - texto bajo el periodo: "Se crearán N hojas de mes" (solo Excel);
  - con **Ocultar montos** (SPEC 22) activo, aviso: "El archivo incluye los montos reales.";
  - botón **Descargar** con estado "Generando…" mientras espera; al terminar, descarga, cierra el diálogo y muestra un toast "Archivo descargado";
  - si falla, toast de error con el mensaje del servidor y el diálogo sigue abierto.
- **Solo meses completos.** Cada hoja de mes cubre del día 1 al último día del mes, en `America/Bogota`. El mes actual se exporta hasta hoy y su título lo marca "(en curso)".
- **Límite: 36 meses por archivo.** Un rango mayor se rechaza en el diálogo y en el servidor. Si el historial supera 36 meses, **Todo el historial** queda deshabilitado con el texto "Tu historial tiene N meses. Exporta por rangos de hasta 36."
- **Route Handler** `app/api/export/[workspaceId]/route.ts` (`GET`):
  - query: `format=xlsx|csv`, `from=YYYY-MM`, `to=YYYY-MM`;
  - lee con la sesión del usuario (cliente de servidor, clave publicable) y RLS; nunca `service_role`;
  - resuelve el espacio con `getWorkspace(id)` (dueño por `is_workspace_owner`). Un espacio marcado para borrar también se exporta: es la última forma de sacar los datos;
  - responde el archivo con `Content-Disposition: attachment; filename="..."` y `Cache-Control: no-store`;
  - errores en JSON `{ error: string }`: 401 sin sesión, 404 espacio ajeno o inexistente, 400 parámetros inválidos o más de 36 meses.
- **Nombre del archivo:** `tesoro-<espacio>-<periodo>.<ext>`:
  - `<espacio>`: `personal` o el slug del nombre de la empresa (minúsculas, sin tildes, guiones, máximo 40 caracteres);
  - `<periodo>`: `2026-10` (un mes), `2026` (enero a diciembre de un año) o `2026-01_2026-10` (otro rango).
- **Libro `.xlsx`** generado con `exceljs` en el servidor. Hojas en este orden:
  1. **Resumen**;
  2. una hoja por mes, en orden cronológico ascendente, llamada `Octubre 2026`;
  3. **Movimientos** (plana).
- **Hoja Resumen (Personal):** cabecera con logo, "Tesoro · Personal", periodo y "Generado el 6 nov 2026". Tabla mes a mes: Mes, Ingresos, Gastos, Balance, Tasa de ahorro, Saldo en cuentas al cierre. Fila de totales (Ingresos, Gastos y Balance suman; Tasa de ahorro del total; Saldo = último mes).
- **Hoja Resumen (Empresa):** misma cabecera con "Tesoro · <Empresa>". Tabla mes a mes: Mes, Ventas, Costos y gastos, Utilidad, Margen, Saldo en cuentas al cierre. Fila de totales con el mismo criterio.
  - Las celdas de Resumen son fórmulas que apuntan a la hoja de cada mes (`='Octubre 2026'!C6`).
- **Hoja de mes (Personal)**, secciones apiladas en vertical, cada una con título, encabezados, filas y fila de total cuando aplica, y una fila en blanco entre secciones:
  1. **Resumen del mes**: Ingresos, Gastos, Balance, Tasa de ahorro, Saldo en cuentas al inicio y al cierre;
  2. **Saldos por cuenta**: Cuenta, Saldo al inicio, Entradas, Salidas, Saldo al cierre;
  3. **Ingresos fijos** (SPEC 30): Nombre, Fecha esperada, Categoría, Cuenta, Esperado, Recibido, Estado. Las fuentes **Sin fecha fija** van con fecha vacía y Recibido del mes;
  4. **Gastos fijos** (SPEC 04): Nombre, Fecha de pago, Categoría, Monto, Pagado, Estado;
  5. **Presupuestos** (SPEC 04): Categoría, Límite, Gastado, Restante, % usado;
  6. **Metas** (SPEC 05): Meta, Aportado en el mes, Ahorrado al cierre, Objetivo, % logrado;
  7. **Deudas y tarjetas** (SPEC 06, 16, 17): Nombre, Tipo, Pagos del mes, Cargos del mes, Saldo al cierre;
  8. **Me deben** (SPEC 28, 29): Nombre, Esperado en el mes, Cobrado en el mes, Pendiente al cierre, Estado;
  9. **Movimientos**: Fecha, Hora, Tipo, Descripción, Categoría, Cuenta, Destino, Nota, Monto. Incluye traspasos (Tipo "Traspaso", sin categoría, con Destino). Orden: fecha, `day_position`.
  - Las secciones 3 a 8 se omiten si el usuario no tiene registros de esa entidad que apliquen al mes. Las secciones 1, 2 y 9 siempre aparecen; sin filas muestran "Sin movimientos este mes".
  - Los estados (Recibido / Pagado, Pendiente, De hoy, Atrasado) usan el mismo cálculo que las páginas, con hoy en `America/Bogota`.
- **Hoja de mes (Empresa)**, mismas reglas de apilado:
  1. **Resumen del mes**: Ventas, Costos y gastos, Utilidad, Margen, Saldo en cuentas al inicio y al cierre;
  2. **Saldos por cuenta**: igual que Personal;
  3. **Costos por categoría**: Categoría, Total, % del total;
  4. **Ventas**: Fecha, Hora, Descripción, Categoría, Contraparte, Factura, Cuenta, Nota, Monto;
  5. **Costos y gastos**: mismas columnas que Ventas;
  6. **Traspasos**: Fecha, Hora, Origen, Destino, Nota, Monto (se omite si no hay).
- **Hoja Movimientos (plana)**: una sola tabla con todo el periodo. Columnas: Mes (`YYYY-MM`), Fecha, Hora, Tipo, Descripción, Categoría, Cuenta, Destino, Nota, Monto; en Empresa, además Contraparte y Factura. Encabezado inmovilizado y autofiltro.
- **Fórmulas en los totales** con referencias A1 (`=SUM(I40:I85)`, `=SUMIFS(...)`), no con referencias estructuradas de tabla. Cada fórmula guarda su valor calculado (`result`) para que se vea bien en visores sin motor de cálculo.
  - Resumen del mes: Ingresos y Gastos con `SUMIFS` sobre Monto y Tipo de su sección Movimientos; Balance y Tasa de ahorro sobre esas celdas.
  - Los traspasos no suman a ingresos ni gastos.
- **Formato:**
  - montos con formato `"$" #,##0` (COP sin decimales);
  - fechas como fecha real de Excel con formato `dd/mm/yyyy`; hora como texto `HH:MM` o vacía;
  - porcentajes con `0.0%`;
  - montos de ingreso y venta en verde, de gasto y costo en rojo, de traspaso en gris (texto, no relleno);
  - hojas sin líneas de cuadrícula: las celdas que no son parte de una tabla quedan en blanco, sin bordes;
  - cada tabla es un bloque con borde grueso exterior del color del espacio y bordes internos finos grises;
  - título de cada tabla en una banda combinada que abarca todas sus columnas, con relleno del color del espacio (emerald en Personal, naranja en Empresa), texto blanco grande en negrita (AA, 4.5:1);
  - encabezados de columna con un tinte claro del espacio y texto del color del espacio oscuro (AA);
  - filas alternas en blanco y gris muy claro;
  - fila de total con un tinte propio del espacio, texto oscuro en negrita y borde superior grueso;
  - "Sin movimientos este mes" combinado a lo ancho de la tabla, centrado y en cursiva;
  - ancho de columnas según su contenido, con un mínimo por tipo de columna (fecha, texto, monto) y un máximo;
  - cabecera de la hoja con logo, título grande combinado, subtítulo y una línea del color del espacio debajo;
  - logo de Tesoro (PNG) en la cabecera de Resumen y de cada mes;
  - impresión: A4 vertical, ajustar a una página de ancho, pie de página "Tesoro · <hoja> · Página &P de &N".
- **CSV:** las mismas filas y columnas de la hoja **Movimientos**:
  - UTF-8 con BOM, separador `;`, decimal sin separador de miles (`35000`), fecha `YYYY-MM-DD`, salto `\r\n`;
  - campos con `;`, comillas o saltos se escapan con comillas dobles;
  - celdas que empiecen por `=`, `+`, `-`, `@`, tabulación o retorno llevan un apóstrofo delante (inyección de fórmulas).
  - Se genera con `papaparse` (`unparse`), que ya es dependencia.
- **RPC nueva `account_balances_by_month`** para los saldos por cuenta al inicio y al cierre de cada mes.
- **Documentación:** `docs/producto.md` (sección "Exportar"), `docs/ui.md` (botón y diálogo), `CLAUDE.md` si cambia una regla, `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Reportes en PDF, gráficas, QR y conversión de HTML a PDF (SPEC 33).
- Gráficas dentro del Excel (nativas o como imagen).
- Integración con la API de Google Sheets o Google Drive (OAuth, subir o sincronizar).
- Exportar varios espacios en un mismo archivo.
- Rangos por días o meses parciales.
- Hojas para el score y las recomendaciones.
- Exportaciones programadas, por correo o guardadas en Storage.
- ZIP con un CSV por sección.
- Formato `.xls` antiguo, `.ods` u OFX/QIF.
- Plantillas personalizables o elegir columnas.
- Reimportar el archivo exportado (round-trip con SPEC 08).
- Acceso de exportación desde otras pantallas que no sean Reportes.

## Modelo de datos

No hay tablas nuevas. Una función nueva en Postgres y tipos en TypeScript.

Migración `supabase/migrations/<timestamp>_account_balances_by_month.sql`:

```sql
-- Saldo de cada cuenta al cierre de cada mes del rango, más el saldo al
-- inicio del primer mes. Mismo cálculo que el saldo de Cuentas (SPEC 08c,
-- 16, 21): saldo inicial + movimientos + traspasos + ajustes.
create function public.account_balances_by_month(
  p_workspace_id uuid,
  p_from date,   -- primer día del primer mes
  p_to date      -- último día del último mes
)
returns table (month date, account_id uuid, opening numeric, inflow numeric, outflow numeric, closing numeric)
language sql
stable
security invoker
set search_path = ''
as $$ /* ... */ $$;

grant execute on function public.account_balances_by_month(uuid, date, date) to authenticated;
```

- `security invoker`: RLS filtra por dueño, igual que `account_monthly_balances`.
- Solo cuentas existentes en el mes (creadas antes del cierre). Las archivadas salen si tuvieron saldo o movimientos en el periodo.
- Tras la migración se regeneran `src/types/database.ts` y se le pasa Prettier.

Tipos en `src/features/exports/types.ts`:

```ts
export const EXPORT_FORMATS = ["xlsx", "csv"] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

export const MAX_EXPORT_MONTHS = 36

export interface ExportRange {
  /** YYYY-MM, inclusivo */
  from: string
  /** YYYY-MM, inclusivo, nunca después del mes actual */
  to: string
  /** ["2026-01", "2026-02", ...] */
  months: string[]
}

/** Fila común de la hoja Movimientos y del CSV */
export interface ExportMovementRow {
  month: string // YYYY-MM
  date: string // YYYY-MM-DD
  time: string | null // HH:MM
  kind: "Ingreso" | "Gasto" | "Traspaso" | "Venta" | "Costo o gasto"
  description: string
  category: string | null
  account: string | null
  destination: string | null // solo traspasos
  note: string | null
  amount: number // siempre positivo; el signo lo da `kind`
  counterparty?: string | null // Empresa
  invoiceRef?: string | null // Empresa
}

/** Todo lo que necesita una hoja de mes */
export interface PersonalMonthData {
  month: string
  summary: {
    income: number
    expense: number
    openingBalance: number
    closingBalance: number
  }
  accounts: {
    name: string
    opening: number
    inflow: number
    outflow: number
    closing: number
  }[]
  recurringIncomes: {
    name: string
    dueOn: string | null
    category: string
    account: string | null
    expected: number
    received: number
    status: string
  }[]
  recurringExpenses: {
    name: string
    dueOn: string
    category: string
    amount: number
    paid: number
    status: string
  }[]
  budgets: { category: string; limit: number; spent: number }[]
  goals: {
    name: string
    contributed: number
    savedAtClose: number
    target: number
  }[]
  debts: {
    name: string
    kind: string
    payments: number
    charges: number
    balanceAtClose: number
  }[]
  receivables: {
    name: string
    expected: number
    collected: number
    pendingAtClose: number
    status: string
  }[]
  movements: ExportMovementRow[]
}

export interface BusinessMonthData {
  month: string
  summary: {
    sales: number
    costs: number
    openingBalance: number
    closingBalance: number
  }
  accounts: PersonalMonthData["accounts"]
  costsByCategory: { category: string; total: number }[]
  sales: ExportMovementRow[]
  costs: ExportMovementRow[]
  transfers: ExportMovementRow[]
}
```

Archivos nuevos:

```
app/api/export/[workspaceId]/route.ts       # GET, valida, carga y responde el archivo
src/features/exports/
  types.ts                                   # tipos y constantes de arriba
  range.ts                                   # Zod de from/to, lista de meses, límite 36, nombre de archivo
  queries.ts                                 # carga los datos del rango (paginado) y arma *MonthData
  csv.ts                                     # filas → CSV con BOM, `;` y escape de fórmulas
  workbook/
    build-workbook.ts                        # orquesta: Resumen + meses + Movimientos
    theme.ts                                 # colores ARGB por espacio, formatos de número y fecha, anchos
    section.ts                               # escribe una sección apilada (título, encabezados, filas, total) y devuelve sus rangos
    summary-sheet.ts
    personal-month-sheet.ts
    business-month-sheet.ts
    movements-sheet.ts
    logo-data.ts                             # PNG del logo en base64, generado por `pnpm brand:assets`
  components/
    export-button.tsx                        # botón del header, solo en Reportes
    export-dialog.tsx                        # formato, periodo, descarga
```

- `range.ts` exporta `parseExportRange(from, to, today)`, `listMonths(from, to)` y `exportFileName(workspace, range, format)`.
- `section.ts` es la pieza reutilizable: recibe columnas (`{ header, key, kind: "date" | "time" | "text" | "money" | "percent" }`), filas y opciones de total; escribe desde una fila dada y devuelve `{ firstRow, lastRow, totalRow, columnLetters }` para que otras celdas armen fórmulas.
- Los colores de `theme.ts` copian los valores en claro de `--accent` de cada espacio y de `--income` / `--expense` de `globals.css`, con un comentario que lo indica.

## Plan de implementación

1. **Dependencia y rango.** `pnpm add exceljs` con versión exacta. Crear `types.ts` y `range.ts` (Zod, `listMonths`, límite 36, `exportFileName`). Verificar: `pnpm check`.
2. **RPC.** Migración `account_balances_by_month`, `supabase db push` y regenerar `src/types/database.ts`. Probar la función contra el saldo que muestra Cuentas para un mes cerrado.
3. **Consultas.** `queries.ts`: cargar movimientos y traspasos del rango paginando de 1000 en 1000, saldos por cuenta y las entidades de Personal (fijos, presupuestos, metas, deudas, Me deben) reutilizando los cálculos de estado de sus features. Armar `PersonalMonthData[]` y `BusinessMonthData[]`.
4. **CSV y Route Handler.** `csv.ts` y `app/api/export/[workspaceId]/route.ts` respondiendo solo `format=csv`, con los errores 400/401/404. Verificar abriendo el CSV en Excel es-CO y en Google Sheets.
5. **Sección reutilizable y tema.** `theme.ts`, `section.ts` y `logo-data.ts` (agregar la generación del base64 a `scripts/generate-brand-assets.mjs`).
6. **Hoja Movimientos y libro mínimo.** `movements-sheet.ts` y `build-workbook.ts` con solo esa hoja. El Route Handler responde `format=xlsx`.
7. **Hojas de mes de Personal.** `personal-month-sheet.ts` con las nueve secciones, fórmulas con `result` y omisión de secciones vacías.
8. **Hojas de mes de Empresa.** `business-month-sheet.ts` con sus seis secciones.
9. **Hoja Resumen.** `summary-sheet.ts` con fórmulas entre hojas, cabecera con logo y configuración de impresión en todas las hojas.
10. **Diálogo y botón.** `export-dialog.tsx` (formato, periodo, prellenado, aviso de montos, límite de 36, descarga por `fetch` + `Blob` + enlace temporal, toasts) y `export-button.tsx` en `quick-actions-menu.tsx` solo en Reportes. Comprobar AA de textos y foco en claro y oscuro.
11. **Docs y CHANGELOG.** `docs/producto.md`, `docs/ui.md`, `CLAUDE.md` si aplica y `CHANGELOG.md` en `[Unreleased]`.
12. **Verificación.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [x] `exceljs` está en `package.json` con versión exacta y `pnpm install --frozen-lockfile` funciona.
- [x] `exceljs` no aparece en ningún bundle del navegador (solo lo importa el Route Handler).
- [ ] El botón **Exportar** aparece en el header de Reportes de Personal y de una empresa, y en ninguna otra pantalla.
- [ ] A 390 px el botón es solo ícono, mide al menos 44 px y tiene `aria-label="Exportar"`.
- [x] Al abrir el diálogo desde Reportes con `period=year&value=2026`, el periodo viene en **Año** 2026.
- [x] Un rango de Reportes del 10 oct al 5 nov 2026 llega al diálogo como **Rango de meses** oct 2026 – nov 2026.
- [x] Un rango de 37 meses muestra un error en el diálogo y no permite descargar.
- [x] `GET /api/export/<id>?format=xlsx&from=2023-01&to=2026-02` (38 meses) responde 400.
- [ ] `GET /api/export/<id-de-otro-usuario>?...` responde 404 y no entrega datos.
- [x] Sin sesión, el Route Handler responde 401.
- [x] Exportar Personal de ene–oct 2026 descarga `tesoro-personal-2026-01_2026-10.xlsx` con 12 hojas: Resumen, Enero 2026 … Octubre 2026 y Movimientos.
- [x] Exportar una empresa "Café Ñuñoa" del año 2026 descarga `tesoro-cafe-nunoa-2026.xlsx`.
- [ ] El libro abre sin aviso de reparación en Excel, en LibreOffice y al importarlo en Google Sheets.
- [x] En cada hoja de mes de Personal, Ingresos, Gastos y Balance del **Resumen del mes** coinciden con las tarjetas de Reportes para ese mes.
- [x] El **Saldo al cierre** de cada cuenta en una hoja de mes coincide con el saldo que muestra Cuentas al último día de ese mes.
- [x] Los traspasos aparecen en la sección Movimientos con Tipo "Traspaso" y no cambian Ingresos ni Gastos.
- [ ] Editar un monto de la sección Movimientos en Excel recalcula el **Resumen del mes** y la fila de ese mes en **Resumen**.
- [x] Un mes sin movimientos tiene su hoja con ceros y "Sin movimientos este mes".
- [x] Un usuario sin metas no ve la sección **Metas** en ninguna hoja de mes.
- [x] Las hojas de mes de Empresa tienen Resumen del mes, Saldos por cuenta, Costos por categoría, Ventas y Costos y gastos, y Traspasos solo si hubo.
- [x] La hoja **Movimientos** tiene el encabezado inmovilizado y autofiltro, y una fila por movimiento o traspaso del periodo.
- [x] Un periodo con más de 1000 movimientos los exporta todos.
- [ ] Las fechas se muestran `dd/mm/yyyy` y Excel las reconoce como fecha (se pueden ordenar y filtrar por fecha).
- [x] Una fecha `2026-10-01` se exporta como 1 de octubre, no 30 de septiembre.
- [ ] Los montos se muestran con formato `$ 35.000` en Excel es-CO.
- [x] El encabezado de tabla con texto blanco sobre el color del espacio da 4.5:1 en Personal y en Empresa.
- [x] La vista de impresión de una hoja de mes es A4 vertical, una página de ancho y con "Página 1 de N" en el pie.
- [ ] El CSV abre con tildes y ñ correctas en Excel es-CO con doble clic, con una columna por campo.
- [x] Una descripción `=HYPERLINK("x")` sale en el CSV como `'=HYPERLINK("x")`.
- [ ] Con **Ocultar montos** activo, el diálogo muestra el aviso y el archivo trae los montos reales.
- [ ] Con un historial de más de 36 meses, **Todo el historial** está deshabilitado con su texto explicativo.
- [ ] Si la descarga falla, el diálogo sigue abierto y aparece un toast de error.

> Los criterios sin marcar requieren verificación manual en el navegador con
> sesión o abriendo los archivos en Excel es-CO, LibreOffice y Google Sheets.
> El código que los cubre está implementado (botón, diálogo, formatos,
> fórmulas y CSV); falta confirmarlos a mano.

## Decisiones

- **Sí:** partir en SPEC 32 (Excel y CSV) y SPEC 33 (PDF). Dos motores de documentos y dos diseños en un solo spec es demasiado.
- **No:** integración con la API de Google Sheets. Exige OAuth y permisos sobre Drive; Sheets ya importa `.xlsx` y `.csv`.
- **Sí:** `exceljs` en un Route Handler. Escribe estilos, fórmulas, imágenes, autofiltro, paneles inmovilizados y configuración de impresión. En el servidor no pesa en el bundle.
- **No:** `exceljs` en el navegador. Son cerca de 1 MB de JS para el usuario.
- **No:** SheetJS. Igual que en SPEC 08: la versión de npm está abandonada y tiene CVE.
- **No:** Server Action que devuelve bytes. Una descarga es un GET; un Route Handler da `Content-Disposition` y errores HTTP claros.
- **Sí:** el SPEC 08 descartó `exceljs` porque era pesada y pensada para escribir. Aquí justamente se escribe y corre en el servidor, así que ese motivo no aplica.
- **Sí:** Resumen + una hoja por mes + Movimientos plana. Resumen y meses sirven para presentar; la plana, para analizar.
- **Sí:** secciones apiladas en vertical. Se imprimen bien y no dependen de que las tablas paralelas tengan el mismo largo.
- **No:** el layout lado a lado del Excel del autor. Muchas celdas combinadas y frágil con longitudes distintas.
- **Sí:** combinar solo la banda de título de cada tabla y la cabecera de la hoja; datos y totales nunca se combinan, así ordenar, filtrar y las fórmulas siguen funcionando. Revisión de diseño pedida tras la primera implementación.
- **Sí:** sin líneas de cuadrícula y bordes solo en las tablas. El libro se lee como un reporte, no como una hoja en blanco.
- **Sí:** solo meses completos. Mantiene el patrón mes a mes y evita hojas parciales.
- **Sí:** límite de 36 meses. Acota el tiempo del Route Handler y el tamaño del libro.
- **Sí:** fórmulas en los totales con su valor guardado. Si el usuario edita, recalcula; si el visor no calcula, igual ve el número.
- **No:** referencias estructuradas de tabla (`Tabla[Monto]`). Google Sheets y LibreOffice no las leen bien al importar; las referencias A1 funcionan en todos.
- **No:** gráficas en el Excel. `exceljs` no crea gráficas nativas y una imagen no es editable. Van en el PDF (SPEC 33).
- **Sí:** montos reales aunque **Ocultar montos** esté activo. Ocultar montos es para la pantalla; el archivo es del usuario.
- **Sí:** CSV plano de movimientos con BOM y `;`. Es lo que Excel en es-CO abre bien con doble clic.
- **Sí:** escapar celdas que empiezan por `=`, `+`, `-`, `@` en el CSV. Evita inyección de fórmulas al abrirlo.
- **Sí:** hojas en orden cronológico ascendente. Coincide con el orden de la tabla de Resumen.
- **Sí:** el botón vive en los accesos rápidos del header de Reportes, siguiendo la regla de que las acciones principales van en el header.
- **Sí:** exportar también un espacio marcado para borrar. Es la última oportunidad del usuario de sacar sus datos.
- **Sí:** logo en base64 generado por `pnpm brand:assets`. Leer `public/` con `fs` desde un Route Handler depende del trazado de archivos del despliegue.
- **Sí:** RPC `account_balances_by_month` en Postgres. `account_monthly_balances` solo da el total, y la regla del SPEC 03 es no sumar saldos en el cliente.

## Riesgos

| Riesgo                                                                   | Mitigación                                                                                                                                                       |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 36 meses con muchos movimientos tardan más que el límite de la función   | Consultas por rango completo (no por mes) y paginadas. Si en pruebas pasa de 10 s, se baja el límite o se mueve a streaming del libro (`exceljs` stream writer). |
| Supabase corta en 1000 filas y se pierden movimientos sin aviso          | Paginación obligatoria en `queries.ts` y un criterio de aceptación con más de 1000 movimientos.                                                                  |
| Fechas corridas un día por zona horaria                                  | Fechas construidas desde `YYYY-MM-DD` con componentes UTC, sin `new Date(string)` local. Criterio de aceptación con el 1 de octubre.                             |
| Los saldos por cuenta del Excel no cuadran con Cuentas                   | La RPC reutiliza la lógica de saldo de SPEC 08c / 16 / 21 y un criterio compara ambos.                                                                           |
| Los estados de fijos o Me deben difieren de las páginas                  | `queries.ts` reutiliza las funciones de estado de cada feature, no las reimplementa.                                                                             |
| Fórmulas con `result` desactualizado si cambia el cálculo                | El valor guardado sale del mismo dato que la fórmula suma; la fórmula manda al abrir en Excel.                                                                   |
| Nombre de hoja inválido o repetido                                       | Los nombres son `<Mes> <año>`, siempre únicos y de menos de 31 caracteres, sin `: \ / ? * [ ]`.                                                                  |
| El CSV abre en una sola columna en Excel con otra configuración regional | `;` es el separador de Excel en es-CO; Google Sheets detecta el separador al importar. Se documenta en `docs/producto.md`.                                       |

## Lo que **no** entra en este spec

- PDF, gráficas, QR y HTML a PDF (SPEC 33).
- Gráficas dentro del Excel.
- API de Google Sheets o Drive.
- Varios espacios en un archivo.
- Rangos por días o meses parciales.
- Score y recomendaciones en el archivo.
- Exportaciones programadas, por correo o en Storage.
- ZIP de CSVs, `.xls`, `.ods`, OFX o QIF.
- Plantillas o columnas configurables.
- Reimportar el archivo exportado.

Cada uno, si llega, va en su propio spec.
