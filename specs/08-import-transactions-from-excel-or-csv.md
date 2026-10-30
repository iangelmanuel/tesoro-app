# SPEC 08 — Importar movimientos desde Excel o CSV

> **Estado:** Aprobado
> **Depende de:** SPEC 02
> **Fecha:** 2026-10-30
> **Objetivo:** Que el usuario importe sus movimientos personales desde una o varias hojas de un `.xlsx` o desde un `.csv`, ubicando la tabla, mapeando columnas y categorías y revisando una vista previa antes de guardar, con la opción de deshacer la importación.

## Por qué existe este spec

Quien llega a Tesoro casi siempre trae meses de registros en una hoja de cálculo. Sin importador, empezar implica volver a escribirlos a mano.
No hay un formato estándar. El Excel de referencia (`fpangeldm.xlsx`, del autor) tiene una hoja por mes. Cada hoja trae varias tablas lado a lado, y la de "Transacciones" tiene los encabezados en la fila 24, en las columnas I a O. Su tipo viene como "Entrada"/"Salida" y mezcla traspasos entre cuentas propias y filas "Mes anterior" con saldos iniciales. Por eso el importador **no asume una estructura**: detecta tablas, deja corregirlas y mapea columnas y valores.
El archivo **se lee en el navegador**. Al servidor solo llegan las filas ya mapeadas, que se revalidan y se guardan en una sola transacción.
Este spec importa solo **movimientos**. Gastos fijos, tarjetas, deudas y aportes a metas usan el mismo motor de lectura en el SPEC 08b.

## Alcance

**Entra:**

- Página `/dashboard/personal/import` con un flujo de 6 pasos: archivo → tabla → columnas → categorías → vista previa → resumen.
- Botón "Importar" en Movimientos y en su estado vacío.
- Archivos `.xlsx` y `.csv` de hasta 5 MB, leídos en el navegador con `read-excel-file` (`.xlsx`) y `papaparse` (`.csv`), cargados con `import()` dinámico.
- Detección automática de tablas por hoja (fila de encabezados y rango de columnas), con ajuste manual.
- Selección de varias hojas. El mapeo de la primera se aplica a las demás si sus encabezados coinciden. Las que no coinciden se marcan y se excluyen.
- Mapeo de columnas a fecha, monto, tipo, categoría, descripción y nota.
- Tipo con 3 modos: columna con valores (`Entrada` → ingreso), signo del monto o dos columnas Ingreso/Gasto.
- Mapeo de cada valor de categoría de origen a una categoría existente, a una categoría nueva o a "No importar".
- Fechas reales de Excel, números de serie de Excel y fechas en texto con selector de formato (DD/MM/AAAA por defecto, MM/DD/AAAA, AAAA-MM-DD).
- Montos numéricos y en texto, en formato es-CO (`1.500.000,50`) o en-US (`1,500,000.50`).
- Vista previa con validación por fila, detección de duplicados, filtro por estado y casilla por fila.
- Límite de 2.000 filas por importación, sumando todas las hojas.
- Guardado todo o nada en una RPC, con resumen final: importadas, omitidas, duplicadas omitidas y con error.
- Historial de importaciones en la misma página, con "Deshacer" disponible siempre.
- Tabla `imports` y columna `transactions.import_id`.

**Fuera de alcance (para specs futuros):**

- Importar gastos fijos, movimientos de tarjeta o deuda y aportes a metas (SPEC 08b).
- Cuentas bancarias y métodos de pago (Nequi, Bancolombia, efectivo), editables como las categorías, y traspasos entre cuentas (spec propio de cuentas).
- Guardar la columna Método. Hoy se ignora.
- Importar en el espacio Empresa (SPEC 10 y 11).
- Archivos `.xls`, `.ods`, `.numbers` o Google Sheets por enlace.
- Recordar el mapeo entre importaciones.
- Editar una fila dentro de la vista previa.
- Sincronización continua, conexión con bancos y exportar.
- Guardar el archivo original en el servidor o en Storage.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_create_imports.sql`:

```sql
create type public.import_status as enum ('completed', 'undone');

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  filename text not null check (char_length(filename) between 1 and 255),
  sheets text[] not null default '{}', -- hojas importadas; vacío en CSV
  status public.import_status not null default 'completed',
  stats jsonb not null, -- ImportStats
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  check ((status = 'undone') = (undone_at is not null))
);

create index imports_workspace on public.imports (workspace_id, created_at desc);

alter table public.transactions
  add column import_id uuid references public.imports (id) on delete set null;

create index transactions_import on public.transactions (import_id)
  where import_id is not null;
```

- **RLS** de `imports`: `select` con `is_workspace_owner(workspace_id)`. Sin políticas de `insert`, `update` ni `delete`. Solo las RPC escriben.
- **RPC** (`security definer`, `search_path = ''`). Cada una valida al inicio que `is_workspace_owner` se cumpla para el espacio, o lanza una excepción. `grant execute` solo a `authenticated`:
  - `import_transactions(p_workspace_id uuid, p_filename text, p_sheets text[], p_stats jsonb, p_new_categories jsonb, p_rows jsonb) returns uuid`:
    - rechaza más de 2.000 filas;
    - crea `imports`;
    - inserta las categorías nuevas (`[{ key, type, name }]`) con ícono y color por defecto (`receipt`/`slate` para gasto, `coins`/`lime` para ingreso);
    - inserta los movimientos (`[{ type, amount, occurred_on, category_id | new_category_key, description, note }]`) con `import_id`;
    - todo en la misma transacción. Los `check` y el trigger `check_transaction_category` del SPEC 02 siguen aplicando.
  - `undo_import(p_import_id uuid) returns integer`:
    - borra los movimientos con ese `import_id`, aunque se hayan editado;
    - marca `status = 'undone'` y `undone_at = now()`;
    - devuelve cuántos borró. Falla si ya estaba deshecha.
  - `transactions_for_duplicates(p_workspace_id uuid, p_from date, p_to date)` (`security invoker`, `stable`) devuelve `occurred_on, type, amount, description` de los movimientos del rango.
- `security definer` es necesario porque `imports` no tiene políticas de escritura. Las RPC verifican al dueño igual que las políticas.
- Tras la migración se regenera `src/types/database.ts` y se le pasa Prettier.

Tipos (en `src/features/imports/types.ts`):

```ts
type ImportField =
  | "date"
  | "amount"
  | "type"
  | "income_amount"
  | "expense_amount"
  | "category"
  | "description"
  | "note"

type TypeMode = "column" | "sign" | "split" // valores, signo, dos columnas
type DateFormat = "dmy" | "mdy" | "ymd"

type DetectedTable = {
  sheet: string
  headerRow: number // índice 0
  startCol: number
  endCol: number // inclusivo
  headers: string[]
}

type CategoryTarget =
  | { kind: "existing"; categoryId: string }
  | { kind: "new"; name: string }
  | { kind: "skip" }

type RowStatus = "ready" | "duplicate" | "error" | "skipped"

type PreviewRow = {
  sheet: string
  sourceRow: number // fila como la ve el usuario en Excel (1-based)
  status: RowStatus
  reasons: string[] // errores o motivo de omisión
  selected: boolean // ready → true; duplicate, error, skipped → false
  value?: {
    type: "income" | "expense"
    amount: number
    occurred_on: string
    categoryKey: string
    description: string
    note: string | null
  }
}

type ImportStats = {
  read: number // filas con datos
  imported: number
  skipped: number // "No importar", desmarcadas y vacías
  duplicates: number // duplicadas no incluidas
  errors: number
}
```

### Lectura y detección de tablas

En `src/features/imports/detect.ts`, funciones puras sobre una matriz de celdas por hoja.

- **Fila de encabezados:** una fila con ≥ 3 celdas de texto contiguas. Dentro del mismo rango, la fila siguiente que no esté vacía tiene al menos una celda tipo fecha y una tipo número.
- **Rango de columnas:** el tramo contiguo de celdas no vacías de esa fila. Una fila puede dar varias tablas si los tramos están separados por al menos una columna vacía.
- **Fin de la tabla:** 3 filas seguidas vacías dentro del rango, o el fin de la hoja. Las filas vacías intermedias se ignoran.
- Si no se detecta nada, se usa la fila 1 y todas las columnas con datos.
- El usuario puede cambiar la fila de encabezados y las columnas inicial y final.
- **Varias hojas:** en cada hoja se busca la tabla cuyos encabezados normalizados coinciden con los de la elegida, sin importar en qué columna empiece. Normalizar es pasar a minúsculas, quitar tildes y recortar espacios.
- Los encabezados se normalizan igual para sugerir el mapeo:

| Campo            | Encabezados que lo sugieren                        |
| ---------------- | -------------------------------------------------- |
| `date`           | fecha, date, día                                   |
| `amount`         | monto, valor, importe, amount                      |
| `type`           | tipo, salida entrada, entrada salida, movimiento   |
| `income_amount`  | ingreso, entrada, abono, crédito                   |
| `expense_amount` | gasto, salida, cargo, débito                       |
| `category`       | categoría, category, rubro                         |
| `description`    | descripción, concepto, detalle, notas, description |
| `note`           | nota, observación, comentario                      |

- En el Excel de referencia, "Tipo" (Normal / Necesario / Evitable) **no** es el tipo de movimiento. La sugerencia es solo un punto de partida y el usuario la corrige.

### Normalización por fila

En `src/features/imports/normalize.ts`:

| Campo       | Regla                                                                                                                                                                                                                                                                       | Error si falla                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Fecha       | Celda fecha de Excel → `YYYY-MM-DD` con los componentes UTC (`read-excel-file` la entrega a las 00:00 UTC), sin conversión de zona. Número entre 20.000 y 80.000 → serie de Excel (sistema 1900). Texto → según el formato elegido. Válida entre `2000-01-01` y hoy + 1 año | "Fecha inválida"                                |
| Monto       | Número → tal cual. Texto → si tiene coma y punto, el último separador es el decimal. Si solo tiene uno, `parseAmount` (es-CO). Se redondea a 2 decimales. Debe quedar > 0 y ≤ `MAX_AMOUNT`, con el valor absoluto en los modos `column` y `split`                           | "Monto inválido"                                |
| Tipo        | `column`: cada valor distinto de la columna se mapea a ingreso, gasto u "Omitir fila" (sugerencia: entrada, ingreso, income → ingreso; salida, gasto, egreso, expense → gasto). `sign`: negativo → gasto, positivo → ingreso. `split`: la columna con valor ≠ 0             | "Tipo desconocido" o "Ingreso y gasto a la vez" |
| Categoría   | Cada par (tipo, valor de origen) se mapea. Sin columna de categoría, todas van a "Otros ingresos" u "Otros gastos". Valor vacío → par (tipo, "Sin categoría")                                                                                                               | —                                               |
| Descripción | Texto recortado. Vacío → el valor de categoría de origen. Si ese también está vacío, error. Más de 120 caracteres se recorta y se avisa                                                                                                                                     | "Falta la descripción"                          |
| Nota        | Opcional. Más de 500 caracteres se recorta                                                                                                                                                                                                                                  | —                                               |

- Fila **vacía**: sin fecha ni monto. Cuenta en `skipped` y no se muestra.
- Fila con categoría o tipo mapeado a "No importar" u "Omitir fila": estado `skipped`, con el motivo.
- Las categorías nuevas se proponen con el valor de origen como nombre (máximo 40 caracteres). Si choca con una existente del mismo tipo sin distinguir mayúsculas, se propone mapear a la existente.
- Las categorías archivadas no aparecen como destino.

### Duplicados

- **Clave:** `occurred_on | type | amount con 2 decimales | descripción normalizada`. La descripción normalizada va en minúsculas, sin tildes y con los espacios colapsados.
- Se compara contra `transactions_for_duplicates` en el rango `[min fecha, max fecha]` del archivo, y contra filas anteriores del mismo archivo.
- Fila duplicada: estado `duplicate`, desmarcada, con "Posible duplicado de un movimiento del 12/10/2026" o "Posible duplicado de la fila 37 (Octubre)". El usuario puede marcarla.

### Ejemplo con el Excel de referencia

Hoja "Octubre", tabla en la fila 24, columnas I a O. Mapeo:

- Fecha → `date`;
- Salida Entrada → `type`, con `Entrada` → ingreso, `Salida` → gasto y `N/A` → Omitir fila;
- Categoría → `category`, con `Traspaso` y `Mes anterior` → No importar, `Compra` (gasto) → Compras y `Regalo` (ingreso) → nueva "Regalos";
- Monto → `amount`;
- Notas → `description`;
- Tipo y Método sin mapear.

| Fila | Datos                                       | Estado  |
| ---- | ------------------------------------------- | ------- |
| 25   | N/A, Mes anterior, 60.086                   | Omitida |
| 29   | Entrada, Regalo, 35.000, "Regalo Irma - …"  | Lista   |
| 30   | Salida, Compra, 34.265, "Compra de curso …" | Lista   |
| 31   | Salida, Traspaso, 35.000                    | Omitida |

Las filas 30 y 33 tienen la misma fecha, tipo y monto, pero descripciones distintas. Por eso ninguna es duplicada.

## Plan de implementación

1. **Migración.**
   - Crear `imports`, `transactions.import_id`, RLS y las tres RPC.
   - Aplicarla con `supabase db push` y regenerar `src/types/database.ts`.
   - Verificar en la BD:
     - `import_transactions` con 2.001 filas falla;
     - con una categoría de otro espacio falla sin dejar ni `imports` ni movimientos;
     - `undo_import` sobre un import ajeno falla.
2. **Dependencias.**
   - `pnpm add read-excel-file papaparse` y `pnpm add -D @types/papaparse`, con versión exacta.
   - Verificar que el lockfile queda sincronizado.
3. **Lectura.**
   - `src/features/imports/read-file.ts`: valida extensión y tamaño (≤ 5 MB) y carga la librería con `import()`. Devuelve `{ sheets: { name, cells: unknown[][] }[] }`.
   - El CSV va como una sola hoja, con el delimitador detectado por `papaparse`.
4. **Detección y normalización.**
   - `src/features/imports/constants.ts`: límites, sinónimos de encabezados y de tipo, categorías por defecto.
   - `src/features/imports/detect.ts` y `src/features/imports/normalize.ts`: funciones puras de las tablas anteriores.
   - `src/features/imports/duplicates.ts`: clave y marcado.
5. **Acciones y consultas.**
   - `src/features/imports/schemas.ts`: Zod para filas, categorías nuevas y stats. Reutiliza `amountSchema` y los límites de `transactionSchema`.
   - `src/features/imports/actions.ts` (`"use server"`), con el workspace Personal del usuario de la sesión:
     - `getDuplicateCandidates(from, to)`;
     - `confirmImport(input)`: revalida, llama a `import_transactions` y `revalidatePersonalPages()`;
     - `undoImport(importId)`.
   - `src/features/imports/queries.ts`: `getImports(workspaceId)`.
6. **Pasos 1 y 2 (archivo y tabla).**
   - `app/dashboard/personal/import/page.tsx` con `buildMetadata` `noindex` y `Suspense`.
   - `src/features/imports/components/import-wizard.tsx` (cliente, `useReducer`).
   - `file-step.tsx`: zona de arrastre y selector.
   - `table-step.tsx`: lista de hojas con casillas, tabla detectada por hoja, ajuste de fila y columnas, y vista de las primeras 5 filas.
7. **Pasos 3 y 4 (columnas y categorías).**
   - `columns-step.tsx`: un `select` por campo con la sugerencia, modo de tipo, formato de fecha y mapeo de valores de tipo.
   - `categories-step.tsx`: cada par (tipo, valor de origen) con su número de filas y un `select` (existentes, "Crear «valor»", "No importar").
8. **Pasos 5 y 6 (vista previa y resumen).**
   - `preview-step.tsx`: contadores por estado, filtro, tabla paginada de 100 filas con casilla, hoja, fila de origen, datos normalizados y motivos, y el botón "Importar N movimientos".
   - `summary-step.tsx`: importadas, omitidas, duplicadas omitidas y con error, con enlaces a Movimientos y "Importar otro archivo".
9. **Historial y deshacer.**
   - `import-history.tsx` bajo el asistente: archivo, hojas, fecha, stats, estado y "Deshacer". Pide confirmación con el número de movimientos.
   - Estado vacío "Aún no has importado archivos".
10. **Entradas.**
    - Botón "Importar" en `app/dashboard/personal/transactions/page.tsx` y en `transactions-empty.tsx`.
    - Ruta en `SITE.routes` si las demás rutas del espacio se leen de ahí.
11. **Docs.**
    - `docs/producto.md`: sección "Importar" con formatos, detección, mapeo, duplicados y límites. Agrega `imports` a la tabla del modelo de datos.
    - `ROADMAP.md`: respuestas a las preguntas abiertas del SPEC 08, más las entradas "SPEC 08b — Importar gastos fijos, deudas y metas" y "Cuentas y métodos de pago".
    - `CHANGELOG.md` `[Unreleased]` (en inglés).

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] `pnpm install --frozen-lockfile` funciona y `read-excel-file`, `papaparse` y `@types/papaparse` tienen versión exacta.
- [ ] La migración se aplica sin errores y `src/types/database.ts` incluye `imports`, `transactions.import_id`, `import_transactions`, `undo_import` y `transactions_for_duplicates`.
- [ ] `read-excel-file` y `papaparse` no están en el bundle de otras páginas: solo se cargan al elegir un archivo.
- [ ] Un archivo de 6 MB o con extensión `.xls` muestra un error y no avanza.
- [ ] Con `fpangeldm.xlsx`, la hoja "Octubre" propone una tabla con encabezados en la fila 24 y columnas I a O ("Fecha", "Salida Entrada", "Categoría", "Tipo", "Método", "Monto", "Notas").
- [ ] Al elegir las hojas Mayo a Octubre, todas usan el mismo mapeo. Una hoja con encabezados distintos aparece como "No coincide" y se excluye.
- [ ] El ejemplo de la sección "Ejemplo con el Excel de referencia" da exactamente esos estados por fila.
- [ ] Un CSV con `;` como delimitador y montos `1.500.000,50` se lee bien. Uno con `,` y `1,500,000.50` también.
- [ ] Con formato DD/MM/AAAA, `03/10/2026` es el 3 de octubre. Con MM/DD/AAAA es el 10 de marzo.
- [ ] Una fecha guardada como fecha de Excel conserva el mismo día al importarse, sin desfase por zona horaria.
- [ ] En modo signo, `-50000` es un gasto de 50.000 y `50000` un ingreso. En modo dos columnas, una fila con ambas columnas > 0 queda en error con "Ingreso y gasto a la vez".
- [ ] Una fila con "Total" en la columna de fecha queda en error con "Fecha inválida". Una fila sin fecha ni monto no aparece y suma en omitidas.
- [ ] Una categoría de origen mapeada a "Crear «Regalos»" crea la categoría al confirmar, y sus movimientos quedan en ella.
- [ ] Una fila con la misma fecha, tipo, monto y descripción que un movimiento existente aparece como "Posible duplicado", desmarcada. Al marcarla, se importa.
- [ ] Dos filas iguales dentro del archivo: la primera queda lista y la segunda como duplicada.
- [ ] Un archivo con 2.001 filas con datos en las hojas elegidas muestra "Máximo 2.000 filas por importación" y no deja continuar.
- [ ] Confirmar crea una fila en `imports` con sus stats y los movimientos con su `import_id`. El resumen muestra los mismos números.
- [ ] Si la RPC falla (por ejemplo, con una categoría ajena forzada desde el cliente), no queda ni la fila de `imports` ni ningún movimiento.
- [ ] Tras importar, Movimientos, Resumen, Reportes y Recomendaciones reflejan los movimientos sin recargar a mano.
- [ ] "Deshacer" pide confirmación con el número de movimientos, borra todos los del import (también los editados después) y deja el import como "Deshecho" sin botón.
- [ ] Deshacer una importación no borra las categorías creadas en ella.
- [ ] Un usuario A, con su sesión y la clave publicable, no puede leer `imports` de B, ni llamar `import_transactions` o `undo_import` sobre el espacio o el import de B, ni leer `transactions_for_duplicates` de B.
- [ ] Un cliente `anon` no puede ejecutar las tres RPC.
- [ ] Nadie puede insertar, editar ni borrar filas de `imports` directamente con la clave publicable.
- [ ] El archivo no se envía al servidor. En la pestaña de red solo aparece la llamada de la Server Action con las filas mapeadas.

## Decisiones

- **Sí:** solo movimientos en este spec, y gastos fijos, deudas y metas en el SPEC 08b con el mismo motor. Un spec con 4 destinos toca SPEC 02, 04, 05 y 06 a la vez.
- **Sí:** lectura en el navegador. El archivo no sale del equipo, no hay límite de cuerpo para subirlo y no hace falta Storage.
- **No:** procesar en el servidor o subir a Storage. Más carga, más superficie y más limpieza, sin beneficio para 2.000 filas.
- **Sí:** `read-excel-file` + `papaparse`. Son livianas, leen el valor calculado de las fórmulas y detectan el delimitador.
- **No:** SheetJS. La versión de npm está abandonada y tiene CVE, y la segura se distribuye fuera del registro.
- **No:** `exceljs`. Es pesada y está pensada para escribir.
- **Sí:** detección automática de tablas con ajuste manual. El Excel de referencia tiene varias tablas por hoja y encabezados en la fila 24.
- **No:** exigir que la tabla empiece en A1. Obligaría a editar el archivo.
- **Sí:** varias hojas con el mismo mapeo. Las hojas mensuales tienen la misma estructura.
- **Sí:** 3 modos de tipo y mapeo de valores de categoría con "No importar". Así se omiten traspasos y saldos iniciales sin un filtro aparte.
- **Sí:** columnas sin destino, como Método o la clasificación Normal/Necesario/Evitable, se ignoran. Las cuentas y métodos de pago tendrán su propio spec, con entidades editables como las categorías.
- **No:** meter Método en la nota, ni guardarlo crudo en `transactions`. Lo primero ensucia la nota; lo segundo toca el modelo del SPEC 02 con un dato a medias.
- **Sí:** descripción vacía → valor de la categoría de origen. Muchas hojas no tienen descripción en todas las filas, y la del SPEC 02 es obligatoria.
- **Sí:** duplicado = fecha + tipo + monto + descripción normalizada, desmarcado por defecto. Sin la descripción, dos pagos iguales el mismo día darían falsos positivos.
- **Sí:** límite de 2.000 filas y 5 MB. Cubre años de registros personales y la vista previa no necesita virtualizarse.
- **Sí:** todo o nada en una RPC. La validación ya pasó antes; un fallo no deja importaciones a medias.
- **No:** lotes de 500 con estado "Parcial". Más estados y reintentos para un volumen que cabe en una llamada.
- **Sí:** RPC `security definer` con verificación de dueño y `imports` sin políticas de escritura. Así el historial no se puede falsear desde el cliente.
- **Sí:** deshacer en cualquier momento, borrando también los editados. Es predecible y el usuario confirma con el número exacto.
- **No:** plazo de 7 días ni omitir los editados. Deja movimientos sueltos de un import "deshecho".
- **Sí:** las categorías creadas se quedan al deshacer. En el SPEC 02 las categorías solo se archivan.
- **Sí:** página propia `/dashboard/personal/import` con entrada desde Movimientos. Una vista previa de 2.000 filas no cabe en un diálogo.
- **No:** ítem en el aside. Importar es ocasional.
- **Sí:** el estado del asistente vive en el cliente y se pierde al recargar. Rehacer el mapeo de un archivo cuesta poco.

## Riesgos

| Riesgo                                                                     | Mitigación                                                                                                                                                       |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un `.xlsx` de 5 MB comprimido se expande mucho y congela la pestaña        | Se valida el tamaño antes de leer y se muestra "Leyendo archivo…". Si en pruebas bloquea más de 2 s, se mueve la lectura a un Web Worker                         |
| Las fechas de Excel se corren un día por la zona horaria                   | Se usan los componentes UTC de la fecha que entrega `read-excel-file` (00:00 UTC), y un criterio de aceptación lo prueba                                         |
| La detección elige la tabla equivocada en hojas con varias tablas          | Se listan todas las tablas detectadas, se muestran las primeras filas y el usuario ajusta fila y columnas                                                        |
| El payload de 2.000 filas supera el límite de cuerpo de las Server Actions | ~300 bytes por fila son ~600 KB. Antes de implementar se consulta `node_modules/next/dist/docs/` y, si hace falta, se sube `serverActions.bodySizeLimit` a `2mb` |
| Deshacer borra un movimiento que después se enlazó a un pago de deuda      | `debt_entries.transaction_id` es `on delete set null`: el pago queda sin movimiento. Se avisa en la confirmación de deshacer                                     |
| Montos de Excel con decimales flotantes (33.333,3333)                      | Se redondean a 2 decimales antes de validar                                                                                                                      |
| El usuario sube un archivo con datos reales al repo por error              | Los archivos de ejemplo no se versionan. `fpangeldm.xlsx` queda fuera del repo o en `.gitignore`                                                                 |
| `security definer` salta RLS si la verificación falla                      | Cada RPC verifica `is_workspace_owner` al inicio, fija `search_path = ''` y un criterio prueba el acceso cruzado                                                 |
| Una categoría nueva choca con una existente al confirmar                   | Se propone mapear a la existente. Si aun así choca, el índice único hace fallar la RPC sin dejar nada a medias                                                   |
| `cacheComponents` exige `Suspense` alrededor de lecturas dinámicas         | El historial lee la sesión dentro de `Suspense`. El asistente es un componente cliente                                                                           |

## Lo que **no** entra en este spec

- Gastos fijos, deudas, tarjetas y aportes a metas (SPEC 08b).
- Cuentas bancarias, métodos de pago y traspasos (spec propio).
- Importar en Empresa.
- `.xls`, `.ods` y Google Sheets.
- Recordar el mapeo.
- Editar filas en la vista previa.
- Sincronización continua, bancos y exportar.
- Guardar el archivo original.

Cada uno de esos puntos, si llega, va en su propio spec.
