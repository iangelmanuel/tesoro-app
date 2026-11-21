# Arquitectura

Guía de cómo se organiza el código de Tesoro: dónde va cada archivo, en qué
dirección van las dependencias y qué reglas hacen cumplir ESLint, TypeScript
y los tests. Nace de [SPEC 54](../specs/54-code-organization-foundation-guide-lint-and-tests.md).
Sirve para quien llega nuevo y para quien ya conoce el proyecto y quiere
saber dónde poner algo.

El producto está en [`producto.md`](producto.md), la interfaz en
[`ui.md`](ui.md) y el servidor MCP en [`mcp.md`](mcp.md). Los comandos y las
convenciones generales, en [`CLAUDE.md`](../CLAUDE.md).

## Mapa del repo

```text
app/                 Solo rutas (App Router): páginas, layouts, loading,
                     Route Handlers y archivos de metadata
src/
├── libs/            Utilidades genéricas: fechas, formato, cn, SEO,
│                    clientes de Supabase
├── config/          Datos: SITE, textos de ayuda, atajos, tutoriales
├── components/
│   ├── ui/          Primitivas de shadcn sobre Base UI (código nuestro)
│   ├── forms/       Campos de formulario y FormDialog
│   ├── charts/      Tarjeta, contenedor, tooltip y leyenda de Recharts
│   ├── dashboard/   Shell y piezas compartidas del dashboard, por rol
│   ├── site/        Header y footer de las páginas públicas
│   ├── brand/       Logo
│   ├── seo/         <JsonLd />
│   └── theme/       ThemeProvider
├── features/<área>/ Cada área del producto: datos, lógica y UI propia
├── hooks/           Hooks genéricos entre features
├── content/         Textos largos (legales)
├── styles/          globals.css: Tailwind y tokens
├── testing/         Apoyo de Vitest (stub de server-only)
└── types/           database.ts, generado por Supabase
supabase/            config.toml y migraciones versionadas
scripts/             Scripts de mantenimiento (assets de marca, demo)
specs/               Specs de implementación, uno por cambio
docs/                Producto, UI, MCP y esta guía
```

`src/components/dashboard/` se parte por rol:

| Carpeta          | Qué tiene                                                                   |
| ---------------- | --------------------------------------------------------------------------- |
| `shell/`         | Aside, header, título, menú de cuenta, tabs de espacio, tema por espacio    |
| `sidebar/`       | Primitiva del aside (columna, estaciones, ancho ajustable)                  |
| `quick-actions/` | La lista única de acciones rápidas y su menú del header                     |
| `command/`       | Paleta de comandos (⌘K / Ctrl+K)                                            |
| `shortcuts/`     | Atajos de teclado y su hoja de ayuda                                        |
| `mobile/`        | Hoja de acciones y barra inferior del teléfono                              |
| `hide-amounts/`  | Ocultar cifras: contexto y botón                                            |
| `feedback/`      | Estados vacíos, ayudas (i) y tonos de estado                                |
| `data/`          | Cifras y listas: `Amount`, `StatCard`, tablas, superficies, selector de mes |
| `overlays/`      | Panel de detalle y confirmación de borrado                                  |

## Capas y dirección de dependencias

De abajo arriba. Cada capa importa solo de las de abajo:

1. **`src/libs` y `src/config`.** La base. No importan de `src/components`,
   `src/features` ni `app/`.
2. **`src/components/ui`.** Solo importa de `src/libs` y de otros archivos de
   `ui/`.
3. **`src/components/{forms,charts,dashboard,site,brand,seo,theme}`.**
   Importan de las capas de abajo. **Excepción documentada:** `dashboard/` y
   `forms/` pueden importar de `src/features` para componer el shell (las
   acciones rápidas abren diálogos de features) y los selectores (cuentas y
   categorías se crean desde el campo).
4. **`src/features/*`.** Importan de todo lo anterior y de otras features.
5. **`app/`.** Solo rutas: compone features. Nada en `src/` importa de
   `app/`.

ESLint lo hace cumplir con `no-restricted-imports` por zonas
(`eslint.config.mjs`). Además:

- `exceljs` solo se importa desde `src/features/exports/workbook/`;
- `pdfmake`, `html-to-pdfmake` y `jsdom`, solo desde
  `src/features/exports/pdf/`;
- `@heroui/*`, `react-aria`, `react-aria-components` e
  `@internationalized/date` están prohibidos (se retiraron en SPEC 53).

En la config plana de ESLint, un bloque posterior de `no-restricted-imports`
reemplaza al anterior para los archivos que coinciden. Por eso cada zona se
arma con `restrictImports()`, que repite siempre las restricciones globales.
Una zona nueva se agrega igual.

## Anatomía de una feature

Una carpeta por área en `src/features/<área>/`. Archivos canónicos (no todos
existen en cada feature):

| Archivo                       | Rol                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `schemas.ts`                  | Esquemas Zod de entrada (formularios, MCP)                                                             |
| `types.ts`                    | Tipos de la feature                                                                                    |
| `constants.ts`                | Constantes en `UPPER_SNAKE_CASE`                                                                       |
| `queries.ts`                  | Lecturas. Empieza con `import "server-only"`                                                           |
| `service.ts` / `*-service.ts` | Escrituras compartidas entre las actions y el MCP. Empiezan con `import "server-only"`                 |
| `actions.ts`                  | `"use server"`, delgadas: validar → `requireWritableWorkspace` → servicio → revalidar                  |
| `calculations.ts` y otros     | Lógica pura, sin I/O, con su `*.test.ts` al lado                                                       |
| `components/`                 | UI de la feature. Cada componente que carga datos exporta su `…Skeleton` en el mismo archivo (SPEC 51) |

Los servicios devuelven `ServiceResult<T>` (`features/workspaces/service-result.ts`):
`{ ok: true, … }` o `{ ok: false, error?, fieldErrors? }`. Así la action lo
convierte en estado de formulario y el MCP en `needs_input` o error.

## Flujo de un dato

### Escritura: registrar un movimiento

```text
TransactionDialog (cliente)
  └─ useActionState(createTransaction)
       └─ transactions/actions.ts  "use server"
            1. parseForm + createTransactionSchema (Zod) → errores al formulario
            2. requireWritableWorkspace(workspace_id)    → dueño y sin marca de borrado
            3. createTransactionRecord(supabase, …)      → transactions/service.ts
                 └─ Supabase con la sesión del usuario: RLS decide qué se puede
            4. revalidateWorkspacePages(workspace)       → workspaces/revalidate.ts
```

El MCP llama al mismo `createTransactionRecord` con el cliente del agente:
la regla de negocio vive una sola vez, en el servicio.

### Lectura: la página de Movimientos

```text
app/dashboard/personal/transactions/page.tsx   (servidor)
  └─ <Suspense> → TransactionsContent
       1. await searchParams → parseTransactionFilters
       2. getPersonalWorkspace, getTransactions, getTransactionTotals…
          (transactions/queries.ts, con server-only)
       3. transactionsScope(filters), previousTotalsOrNull(…)  (lógica pura)
       4. compone TransactionsTotals, TransactionsTable…
```

La página solo lee params, llama queries y compone. Un cálculo que no sea
composición va a un módulo de la feature, con su test.

## Servidor y cliente

- **`server-only`** en `queries.ts`, servicios y `src/libs/supabase/server.ts`:
  si un componente cliente los importa, el build falla. Si un cliente
  necesita una función pura que vive en `queries.ts`, esa función se mueve a
  un módulo propio de la feature.
- **`"use client"` lo más abajo posible** en el árbol: la página y las
  tarjetas que solo leen datos son de servidor; el cliente empieza en el
  componente que necesita estado o eventos.
- Funciones que llaman componentes de servidor no van en archivos
  `"use client"`.
- Las lecturas dinámicas (`searchParams`, `cookies`, la sesión, `todayISO()`)
  van dentro de un `Suspense` (`cacheComponents` de Next).

## Nombres

- Identificadores en **inglés**; comentarios, JSDoc, UI y docs en
  **español**.
- Archivos en **kebab-case** (ESLint: `unicorn/filename-case`; los
  segmentos dinámicos de Next como `[workspaceId]` quedan exentos).
- Componentes en **PascalCase**; hooks en `use-*.ts` exportando `useX`.
- Booleanos con `is` / `has` / `can` / `should`.
- Handlers internos `handleX`; props de evento `onX`.
- **Dos funciones exportadas no comparten nombre si hacen cosas distintas.**
  Ejemplo: `listMonths` (lista de meses) y `countMonths` (cuántos meses), en
  vez de dos `monthsBetween`.
- `import { type X, y }`: los tipos se importan con `type` en línea
  (`consistent-type-imports`).

## Dónde va el código compartido

- **Genérico** (fechas, formato, matemática, `cn`): `src/libs/`.
  `src/libs/format.ts` es el único lugar con `Intl.NumberFormat` /
  `DateTimeFormat` para la UI de `src/components/`.
- **Lógica de dominio que usan dos features:** la exporta la feature dueña y
  la otra la importa. Ejemplo: `revalidateWorkspacePages` y `ServiceResult`
  son de `features/workspaces/`, porque hablan de espacios.
- **No hay carpeta `shared/`:** se vuelve un cajón de sastre.
- **Se extrae a la tercera repetición**, no antes.

## Hooks

Los de una sola feature viven junto a sus componentes
(`features/<área>/components/use-*.ts`). Los genéricos entre features, en
`src/hooks/` (hoy, `use-is-mobile.ts`).

## Sin barrels

No hay `index.ts` que reexporte: se importa del archivo que define. Un barrel
esconde de dónde viene cada cosa y mezcla en un import lo de servidor con lo
de cliente.

## Tamaño

**400 líneas** (sin blancos ni comentarios) es la alerta: ESLint avisa con
`max-lines` en warning. Exentos `src/types/database.ts` (generado) y
`src/config/**` (datos). Para partir un archivo:

1. subcomponentes en la misma carpeta;
2. estado y efectos en un hook `use-*.ts`;
3. lógica pura a un módulo con su test.

## Comentarios y JSDoc

- **JSDoc en español** en todo export de `src/libs`, en los servicios y en
  los cálculos, y en las props públicas de `forms/`, `charts/` y
  `dashboard/`.
- Se documenta **el porqué** y la referencia al spec (`SPEC 41`), no lo que
  el código ya dice.
- No se pone JSDoc en todo export: es ruido que se desactualiza.

## Tests

- **Vitest**, solo lógica pura (`pnpm test`, `pnpm test:watch`).
- Archivos `*.test.ts` **junto al módulo**, no en una carpeta aparte: así se
  mueven con él.
- Entorno `node`, alias `@` y `server-only` cambiado por un stub
  (`vitest.config.mts`, `src/testing/server-only-stub.ts`).
- **Antes de mover o cambiar un cálculo, un test de caracterización** fija lo
  que hace hoy (con salidas medidas, no supuestas). Si el test sigue verde
  después, el refactor no cambió el comportamiento.
- Los textos de `Intl` llevan espacio duro (U+00A0): en los tests se escribe
  como `String.fromCharCode(0xa0)` para que se vea.
- Por ahora no hay tests de componentes ni de navegador.

## Glosario dominio ↔ código

| En la UI y los docs                                                    | En el código                                                                      |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Espacio Personal / Empresa                                             | `workspace`, `type: "personal" \| "business"`                                     |
| Movimiento                                                             | `transaction` (tabla `transactions`)                                              |
| Entrada / Salida                                                       | `income` / `expense` (`transaction_type`)                                         |
| Traspaso                                                               | `transfer` (tabla `transfers`)                                                    |
| Cuenta (efectivo, banco…)                                              | `account` (`account_kind`)                                                        |
| Ajuste de saldo                                                        | `account_adjustments`                                                             |
| Categoría                                                              | `category`                                                                        |
| Presupuesto                                                            | `budget`                                                                          |
| Gasto fijo                                                             | `recurring_expense`; su cuota del mes, `recurring_occurrences`                    |
| Ingreso fijo                                                           | `recurring_income`; cada cobro, `recurring_income_occurrences` y sus asignaciones |
| Meta de ahorro                                                         | `savings_goal`; el aporte, `goal_contribution`                                    |
| Deuda: tarjeta, préstamo                                               | `debt` con `kind: "credit_card" \| "loan"`                                        |
| Me deben (cuenta por cobrar)                                           | `debt` con `kind: "receivable"`                                                   |
| Pago y abono (pago extra) / compra o avance / cuota de manejo / ajuste | `debt_entry` con `kind: "payment" \| "advance" \| "fee" \| "adjustment"`          |
| Score de salud financiera                                              | `score` (Personal) y `business-score` (Empresa)                                   |
| Recomendación                                                          | `recommendation` (descartadas en `dismissed_recommendations`)                     |
| Importar un extracto                                                   | `import` (tabla `imports`, `import_target`)                                       |
| Agente de IA conectado                                                 | MCP (`mcp_connections`, `mcp_operations`)                                         |

## Receta: agregar una feature nueva

1. Escribe el spec en `specs/` y llévalo a "Aprobado".
2. Si hay datos nuevos: migración en `supabase/migrations/` con RLS y
   políticas explícitas (`is_workspace_owner` para leer,
   `is_workspace_writable` para escribir); `supabase db push` y regenera
   `src/types/database.ts`.
3. Crea `src/features/<área>/` con `schemas.ts` y `types.ts`.
4. Lecturas en `queries.ts` y escrituras en `service.ts`, los dos con
   `import "server-only"`.
5. `actions.ts` delgadas: validar, `requireWritableWorkspace`, servicio,
   `revalidateWorkspacePages`.
6. Cálculos puros en su módulo, con `*.test.ts` al lado.
7. UI en `components/`, con su `…Skeleton` y las piezas de
   `src/components/` (`StatCard`, `EmptyState`, `FormDialog`…).
8. La página en `app/` solo lee params, llama queries y compone, con
   `buildMetadata` y su `loading.tsx`.
9. Rutas y textos de marca en `SITE`; ayudas en `src/config/help.ts`.
10. Si el agente debe poder usarla, la tool del MCP reusa las queries y el
    servicio (ver [`mcp.md`](mcp.md)).
11. Actualiza `docs/producto.md`, `docs/ui.md` si aplica y el `CHANGELOG.md`.

## Lista de chequeo de PR

- [ ] `pnpm check` sin errores
- [ ] `pnpm eslint` sin errores (los warnings de `max-lines` se anotan)
- [ ] `pnpm prettier:check` sin cambios pendientes
- [ ] `pnpm test` pasa, con tests para la lógica pura nueva
- [ ] `pnpm build` termina
- [ ] Lockfile sincronizado (`pnpm install --frozen-lockfile`)
- [ ] Sin imports que crucen capas al revés ni barrels nuevos
- [ ] `docs/` y `CHANGELOG.md` actualizados si aplica
