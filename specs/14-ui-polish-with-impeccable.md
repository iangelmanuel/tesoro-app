# SPEC 14 — Pulido de la UI con Impeccable (base, shell y pantallas principales)

> **Estado:** Aprobado
> **Depende de:** SPEC 13
> **Fecha:** 2026-10-31
> **Objetivo:** Que el dashboard de Tesoro se vea simple, compacto y ordenado sobre fondo negro, con Inter, accesos rápidos en el header y gráficas rediseñadas, usando Impeccable como guía de diseño.

## Por qué existe este spec

SPEC 13 cambió la piel a HeroUI sin tocar la distribución.
La UI quedó espaciada de más, pesada y con jerarquía poco clara.
Las referencias son los dashboards de ejemplo de HeroUI: fondo negro, tarjetas gris oscuro sin borde, radios grandes, botones pill, KPIs con badge de variación y un solo color de acento.
En Tesoro el acento es emerald en Personal y naranja en Empresa; los negros y grises son los mismos en los dos espacios.

El trabajo se parte en dos specs:

- **14 (este):** Impeccable, tema negro, Inter, shell del dashboard, accesos rápidos, sistema de gráficas, y las pantallas Resumen, Movimientos y Reportes de Personal.
- **14b:** el resto de pantallas de Personal (presupuestos, metas, deudas, cuentas, importar, recomendaciones), todas las de Empresa y cuenta, aplicando lo que este spec deja definido.

## Alcance

**Entra:**

- **Impeccable como skill del proyecto:**
  - `npx skills add pbakaus/impeccable` instalado en `.claude/skills/` y versionado en git;
  - versión fijada (commit o tag anotado en `docs/ui.md`);
  - no se instala como plugin.
- **Contexto de diseño con `/impeccable teach`:**
  - marca, tono, público (personas y pequeñas empresas en Colombia, `es-CO`, COP);
  - tema HeroUI v3, tokens de `globals.css`, primario por espacio;
  - principios: simplicidad, densidad media, negro como base, un solo acento por espacio;
  - el archivo que genere `teach` se versiona en el repo (el nombre exacto se confirma al instalar) y se referencia desde `CLAUDE.md`.
- **Auditoría inicial:** `audit` y `critique` sobre shell, Resumen, Movimientos y Reportes. Los hallazgos se registran priorizados (P0/P1/P2) en la sección "Registro de hallazgos" de este spec antes de tocar código.
- **Tema:**
  - `defaultTheme="dark"` en `src/components/theme/theme-provider.tsx`; el toggle sigue permitiendo claro;
  - oscuro re-afinado a negro: fondo casi negro (~`#0a0a0a`), superficie de tarjeta gris oscuro (~`#18181b`), superficies secundaria/terciaria y `--default` escalonadas, `--muted` gris medio, separadores muy sutiles;
  - tarjetas **sin borde**; la separación la da el contraste fondo/superficie;
  - radios grandes en tarjetas y pill en botones, tabs y selects (vía tokens de radio de HeroUI, no clases sueltas);
  - claro se mantiene AA, con la misma estructura;
  - los acentos por espacio (emerald / naranja) no cambian de familia; se reajustan solo si el nuevo fondo rompe AA;
  - `SITE.seo.themeColor` actualizado al negro nuevo.
- **Tipografía:** Inter vía `next/font/google` en `app/layout.tsx` en lugar de Geist, con `--font-sans`. Números con `tabular-nums` en montos, KPIs, tablas y ejes.
- **Shell del dashboard:**
  - aside: logo → tabs Personal / Empresa → navegación compacta (ítem activo con fondo `--default`, ícono + texto). Abajo: Ayuda, toggle de tema y menú de usuario (avatar + nombre + correo);
  - header (`app/dashboard/layout.tsx`): toggle del sidebar a la izquierda, título a la izquierda; a la derecha los accesos rápidos. Sin borde inferior pesado;
  - en el Resumen de Personal el título es un saludo según la hora en `America/Bogota` ("Buenos días/tardes/noches, {nombre}"); en las demás páginas es el título de la página;
  - el `<h1>` y la descripción que hoy repite cada página se reemplazan por el título del header o se compactan (un solo título visible por pantalla).
- **Accesos rápidos en el header:**
  - **Personal:** botón primario "Registrar movimiento" (abre `TransactionDialog`) + botón "Más" con menú: "Aporte a meta", "Pago de deuda", "Importar";
    - "Aporte a meta" abre `contribution-dialog.tsx` con un `Select` de metas activas; sin metas, el ítem lleva a `/dashboard/personal/goals`;
    - "Pago de deuda" abre `payment-dialog.tsx` con un `Select` de deudas activas; sin deudas, lleva a `/dashboard/personal/debts`;
    - "Importar" navega a `/dashboard/personal/import`;
  - **Empresa:** solo el botón primario "Registrar operación";
  - fuera de un espacio (cuenta, estado vacío de Empresa): sin accesos;
  - reemplaza a `quick-add-transaction.tsx` / `quick-add-transaction-button.tsx` (se reutilizan o se renombran, sin duplicar).
- **Tarjetas KPI con variación:**
  - componente `src/components/dashboard/stat-card.tsx`: etiqueta, valor grande, badge con flecha y porcentaje;
  - variación contra el periodo anterior equivalente, calculada en el servidor con las queries existentes de `src/features/reports/queries.ts`;
  - el color del badge depende del significado, no del signo: subir gastos es malo (`--expense`), subir ingresos es bueno (`--income`);
  - sin periodo anterior o con base 0: no hay badge.
- **Sistema de gráficas** (`src/components/charts/*` y gráficas de `src/features/reports/components/` y `src/features/score/components/score-history-chart.tsx`):
  - paleta desde tokens; ingresos/gastos/balance con `--income`/`--expense`/`--balance`;
  - barras con radio superior, sin bordes; líneas suaves de 2px, sin puntos salvo en hover;
  - grilla solo horizontal, punteada y tenue; ejes sin línea, ticks en `--muted`, montos abreviados (`$1,2 M`, `$350 k`) en `es-CO`;
  - tooltip con superficie overlay, monto completo formateado y nombre de serie;
  - leyenda compacta arriba a la derecha del título (punto de color + texto), como la referencia;
  - cabecera de gráfica: título + selector de rango a la derecha + cifra principal debajo;
  - animación de entrada corta (≤ 400 ms) desactivada con `prefers-reduced-motion`;
  - legibles en claro y oscuro (3:1 para marcas gráficas).
- **Pantallas:**
  - **Resumen Personal** (`app/dashboard/personal/page.tsx`): fila de 4 KPI (ingresos, gastos, balance del mes, saldo acumulado) → gráfica principal ingresos vs. gastos + columna lateral (score y cuentas) → movimientos recientes como tabla compacta. Tarjetas secundarias (presupuestos en riesgo, próximos pagos, metas, deudas) en una grilla debajo, con menos texto;
  - **Movimientos** (`app/dashboard/personal/transactions/page.tsx`): barra de filtros compacta en una línea (búsqueda + filtros como botones pill), totales en KPIs pequeños, tabla con filas más bajas, monto alineado a la derecha con color por tipo, acciones por fila en íconos;
  - **Reportes** (`app/dashboard/personal/reports/page.tsx`): selector de periodo y tipo en una sola barra, KPIs con variación, gráficas con el sistema nuevo, tabla de categorías compacta.
- **Ayudas y estados vacíos:**
  - `src/components/dashboard/help-hint.tsx`: ícono (i) con `Tooltip`/`Popover` de HeroUI, texto corto en `es-CO`;
  - se aplica a score, utilización de tarjeta, tasa de ahorro y saldo acumulado donde aparezcan en las tres pantallas;
  - `empty-state.tsx` rediseñado: ícono, una frase de qué es, una de qué hacer y el botón de la acción (que abre el mismo diálogo del acceso rápido);
  - los textos de ayuda viven en un solo archivo (`src/config/help.ts`) para reusarlos en 14b.
- **Microinteracciones:** hover y press en botones y filas, transición de tabs y del ítem activo del aside, aparición de tarjetas. Todo ≤ 200 ms salvo gráficas, y desactivado con `prefers-reduced-motion`.
- **UX writing** de las tres pantallas y el shell: verbos de acción, sin jerga, montos y fechas en `es-CO`.
- **Documentación:**
  - `docs/ui.md`: tokens y dónde se definen, componentes propios (`stat-card`, `help-hint`, `empty-state`, charts), dónde vive cada pieza, reglas de contraste, y cómo usar los comandos de Impeccable (`teach`, `audit`, `critique`, `polish`, `distill`, `animate`);
  - `CLAUDE.md` (sección "UI y tema"): Inter, oscuro por defecto, tarjetas sin borde, referencia al contexto de Impeccable y a `docs/ui.md`;
  - `CHANGELOG.md` en `[Unreleased]`.

**Fuera de alcance (para specs futuros):**

- Presupuestos, metas, deudas, cuentas, importar y recomendaciones de Personal; todas las pantallas de Empresa; cuenta y perfil (**SPEC 14b**).
- Rediseño de landing, auth y legales. Solo heredan Inter y los tokens nuevos.
- Layout móvil y hoja de acciones rápidas (**SPEC 15**). En móvil el shell solo no debe romperse.
- Tour guiado de primer ingreso.
- Impeccable como plugin de Claude Code.
- Funciones nuevas, cambios de esquema, migraciones o actions nuevas (la variación de KPIs usa queries existentes).
- Cambiar Recharts o HeroUI.
- Atajos de teclado (`⌘N`…).

## Modelo de datos

Sin tablas ni migraciones.

Estructuras nuevas solo de presentación:

```ts
// src/components/dashboard/stat-card.tsx
interface StatCardProps {
  label: string
  value: number // en la moneda del espacio
  previous?: number | null // periodo anterior; null/undefined = sin badge
  trend: "higher-is-better" | "lower-is-better"
  format?: "currency" | "percent" | "number"
  help?: HelpKey
}

// src/config/help.ts
export const HELP = {
  score: "…",
  utilization: "…",
  savingsRate: "…",
  accumulatedBalance: "…"
} as const
export type HelpKey = keyof typeof HELP
```

Tokens: se reutilizan los nombres de HeroUI y los propios de SPEC 13. No se renombra ninguno; cambian valores del bloque `.dark` (y `:root` si hace falta para AA) y los de radio.

## Plan de implementación

1. Instalar Impeccable en `.claude/skills/`, fijar versión, commit.
2. Correr `/impeccable teach`, ajustar el contexto (marca, público, tokens, primario por espacio, principios), versionarlo y enlazarlo desde `CLAUDE.md`.
3. Correr `audit` y `critique` sobre shell, Resumen, Movimientos y Reportes. Volcar hallazgos P0/P1/P2 en "Registro de hallazgos" de este spec.
4. Cambiar Geist por Inter en `app/layout.tsx`. `pnpm check` y `pnpm build` pasan.
5. `defaultTheme="dark"` y re-afinar tokens del bloque `.dark` (negros, superficies, radios). Quitar bordes de tarjetas. Verificar AA de cada par texto/fondo en claro y oscuro con emerald, naranja y neutro.
6. Rediseñar el aside (orden, ítems compactos, usuario abajo) en `app-sidebar.tsx` y `sidebar/`.
7. Rediseñar el header en `app/dashboard/layout.tsx`: título/saludo y slot de accesos rápidos.
8. Accesos rápidos de Personal: botón primario + menú "Más" con aporte, pago (con `Select`) e importar. Accesos de Empresa: "Registrar operación".
9. Crear `help.ts`, `help-hint.tsx` y rediseñar `empty-state.tsx`.
10. Crear `stat-card.tsx` y la función de variación en el servidor.
11. Rediseñar `src/components/charts/*` (contenedor con cabecera, tooltip, leyenda, formato abreviado, animación con reduced motion).
12. Migrar las gráficas de reportes y score al sistema nuevo.
13. Rediseñar Resumen Personal.
14. Rediseñar Movimientos.
15. Rediseñar Reportes.
16. Pasada de `polish` y `animate` de Impeccable sobre shell y las tres pantallas; corregir P0 y P1 restantes.
17. Escribir `docs/ui.md`, actualizar `CLAUDE.md` y `CHANGELOG.md`.

## Registro de hallazgos

Se llenó en el paso 3 (2026-10-31), antes de escribir código.

**Método:**

- Impeccable 4.8.0 con tres subagentes aislados:
  - `critique` A, revisión de diseño;
  - `critique` B, detector;
  - `audit` técnico.
- Se revisó el código fuente. No hubo navegador con sesión, así que las reglas
  del detector que necesitan la página dibujada no corrieron.
- El contraste se calculó desde los tokens OKLCH de `globals.css`.

**Puntajes de partida:**

| Revisión                | Puntaje          |
| ----------------------- | ---------------- |
| `critique` (Nielsen)    | 24/40, Aceptable |
| `audit`                 | 13/20, Aceptable |
| Detector (`critique` B) | 0 hallazgos      |

La verificación de `critique` es "intercambiable con cualquier SaaS": la
identidad solo vive en el copy y en el acento.

**Cómo leer la tabla:**

- No hubo P0. Nada impide completar una tarea.
- Los P3 de Impeccable se registran como P2.
- La columna "Acción" indica el paso de este plan que lo resuelve, o "Fuera"
  si es funcionalidad nueva o una pantalla de 14b.

| Prioridad | Pantalla    | Hallazgo                                                                                                                                                                           | Acción                                                                                                   |
| --------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| P1        | Shell       | Sin `<main>` ni enlace para saltar al contenido; el teclado recorre ~13 controles del shell en cada página (`app/dashboard/layout.tsx:70`). WCAG 1.3.1, 2.4.1                      | Paso 7: `<main id="contenido">` en el header/inset + "Saltar al contenido"                               |
| P1        | Shell       | El acceso rápido usa fallback `null` en `Suspense`: el botón de registrar aparece tarde y mueve el layout (`quick-add-transaction.tsx:43`)                                         | Paso 8: fallback con el botón deshabilitado                                                              |
| P1        | Shell       | El header repite "Tesoro" (`layout.tsx:65`) y no da título ni contexto de página                                                                                                   | Paso 7: título/saludo en el header                                                                       |
| P2        | Shell       | El foco base `outline-focus/50` da 1.88–2.72:1 con emerald/naranja (enlace de marca del aside, `globals.css:176`). WCAG 1.4.11                                                     | Paso 5: quitar `/50` del outline base                                                                    |
| P2        | Shell       | El toggle del aside no expone `aria-expanded`/`aria-controls` (`sidebar/sidebar.tsx:119-133`)                                                                                      | Paso 6                                                                                                   |
| P2        | Shell       | Ctrl/⌘+B se dispara dentro de campos de texto (`sidebar.tsx:59`)                                                                                                                   | Paso 6: ignorar el atajo en elementos editables                                                          |
| P2        | Shell       | El colapso anima `width` y no respeta `prefers-reduced-motion` (`sidebar.tsx:87`); no hay `motion-reduce` en ninguna parte de la app                                               | Paso 6 + paso 16 (`animate`)                                                                             |
| P2        | Shell       | Sin isotipo en el aside; 8 ítems planos (`app-sidebar.tsx:101-106`)                                                                                                                | Paso 6: logo con isotipo arriba. Agrupar la nav: fuera (cambia `SITE.navigation`, se evalúa en 14b)      |
| P2        | Shell       | Geist en vez de Inter (`app/layout.tsx:2,15`) y `defaultTheme="system"` (`theme-provider.tsx:12`)                                                                                  | Pasos 4 y 5                                                                                              |
| P2        | Shell       | Aside vacío en `/dashboard/business` sin empresa (`app-sidebar.tsx:116`)                                                                                                           | Fuera (Empresa, 14b)                                                                                     |
| P2        | Shell       | El estado colapsado del aside no se recuerda al recargar (`sidebar.tsx:46`)                                                                                                        | Fuera (persistencia nueva; anotar para 15)                                                               |
| P2        | Shell       | `--accent-soft-foreground` oscuro mezcla 80% + 30% (`globals.css:156-160`)                                                                                                         | Paso 5                                                                                                   |
| P1        | Resumen     | ~17 tarjetas y ~25 cifras compiten; 9 KPI en dos grillas (`page.tsx:106-203`, `summary-cards.tsx:112-171`). Rompe "claridad antes que cantidad"                                    | Paso 13: 4 KPI, gráfica + columna lateral, tabla y grilla secundaria con menos texto                     |
| P1        | Resumen     | Tres "balance" que compiten ("Balance", "Balance acumulado", "Saldo en cuentas"); "Saldo en cuentas" en `text-3xl` es la cifra más grande (`accounts-card.tsx:50`)                 | Paso 13: jerarquía de los 4 KPI del spec + paso 9: ayuda de "saldo acumulado"                            |
| P1        | Resumen     | Score, tasa de ahorro y utilización sin explicar (`score-summary-card.tsx:99-106`, `summary-cards.tsx:82`, `debts-card.tsx:81-87`). Rompe el principio 2                           | Paso 9: `help-hint` + `src/config/help.ts`                                                               |
| P2        | Resumen     | Montos KPI como `<h3>` (`CardTitle`) con la etiqueta en `<p>`; salto h1→h3 (`summary-cards.tsx:116-124`)                                                                           | Paso 10: `stat-card` con `<dl>`/`<dt>`/`<dd>`; h2 en secciones                                           |
| P2        | Resumen     | Gastos siempre en rosa aunque sean normales (`summary-cards.tsx:67`); tono alarmista contra la voz de PRODUCT.md                                                                   | Paso 10: valor neutro, color solo en el badge de variación por significado                               |
| P2        | Resumen     | 7 botones outline "Ver todos/todas" con el mismo peso; ambiguos para lectores de pantalla                                                                                          | Paso 13: enlace discreto con chevron + sufijo `sr-only`                                                  |
| P2        | Resumen     | 5 widgets en `lg:grid-cols-2` dejan uno huérfano (`page.tsx:119`); el skeleton no coincide con el layout (`page.tsx:207-234`)                                                      | Paso 13                                                                                                  |
| P2        | Resumen     | Después del primer registro aparecen 4–5 tarjetas vacías ("No tienes…") seguidas                                                                                                   | Paso 9 (`empty-state` rediseñado) + paso 13 (vacíos compactos)                                           |
| P2        | Resumen     | Barras de progreso sin nombre accesible (`budget-progress-row.tsx:54-58`, `goal-progress-bar.tsx:55-58`, `debt-indicators.tsx:69`). WCAG 4.1.2                                     | Paso 13 (las que aparecen en el Resumen)                                                                 |
| P2        | Resumen     | Chips y barras de estado con paleta cruda `amber/rose/emerald/sky-*` en ~10 archivos (`score-overview.tsx:7-19`, `budget-progress-row.tsx:23-30`…)                                 | Paso 5: tokens `--*-soft`; se aplican en paso 13 a lo del Resumen, el resto en 14b                       |
| P2        | Resumen     | `getCategories` y `getAccountBalances` sin `cache()`: 2–3 llamadas por request (`categories/queries.ts:11`, `accounts/queries.ts:6`)                                               | Paso 10 (al tocar las queries del Resumen)                                                               |
| P1        | Movimientos | El botón del mes muestra "Octubre de 2026" pero su `aria-label` es "Ver todos los meses"; "Todos" hace lo mismo (`transactions-filters.tsx:118-141`). WCAG 2.5.3 (A)               | Paso 14: el mes como texto `aria-live` y un solo control "Todos los meses"                               |
| P1        | Movimientos | "Nuevo movimiento" duplicado (header + toolbar) y ~11 controles antes de la primera fila (`transactions/page.tsx:81-116`)                                                          | Pasos 8 y 14: un solo primario en el header; Importar/Categorías en "Más"; barra de filtros en una línea |
| P2        | Movimientos | Los totales no dicen a qué periodo o filtro corresponden y usan montos como `<h3>` (`transactions-totals.tsx:35-47`)                                                               | Paso 14: KPI pequeños con `stat-card` y leyenda de alcance                                               |
| P2        | Movimientos | Los filtros no tienen etiqueta visible: el trigger muestra solo "Bancolombia" (`transactions-filters.tsx:233-257`)                                                                 | Paso 14: prefijo ("Cuenta: …") en pill + "Limpiar filtros"                                               |
| P2        | Movimientos | Los filtros actualizan sin anunciarlo: solo `opacity-60`, sin `aria-busy` ni conteo en vivo (`transactions-filters.tsx:103-107`). WCAG 4.1.3                                       | Paso 14                                                                                                  |
| P2        | Movimientos | Tabla `min-w-3xl` a 375 px: monto y acciones quedan fuera de vista (`transactions-table.tsx:56`)                                                                                   | Paso 14: columna de monto visible (sticky o menos columnas en `sm`); el layout móvil completo es del 15  |
| P2        | Movimientos | Acciones por fila de 36×32 px, juntas (`transactions-table.tsx:156-163`)                                                                                                           | Paso 14                                                                                                  |
| P2        | Movimientos | Registro lento para el cierre de mes: sin "Guardar y agregar otro", descripción obligatoria, fecha que vuelve a hoy, sin atajo                                                     | Fuera (funcionalidad nueva; los atajos están excluidos). Anotar para un spec futuro                      |
| P1        | Reportes    | Gráficas enfocables sin indicador de foco ni nombre: `outline-hidden` en `.recharts-surface` (`chart-container.tsx:67`), `role="application"` sin nombre. WCAG 2.4.7               | Paso 11                                                                                                  |
| P1        | Reportes    | La tendencia mensual muestra un solo par de barras con el periodo por defecto "Mes" (`reports-view.tsx:100-116`, `period.ts:140`)                                                  | Paso 15: mostrar los meses previos hasta el periodo elegido con `getMonthlyTotals`                       |
| P1        | Reportes    | Las categorías se pintan 3 veces (dona + top 5 + tabla) y no hay totales del periodo (`reports-view.tsx:118-173`)                                                                  | Paso 15: KPI con variación + una vista de categorías ligada a la tabla compacta                          |
| P1        | Reportes    | Ingresos y gastos solo se distinguen por tono: luminancia 1.13:1 claro, 1.48:1 oscuro (`income-expense-chart.tsx:114-123`). WCAG 1.4.1                                             | Paso 5 (separar luminosidad de `--income`/`--expense` en gráficas) + paso 11                             |
| P2        | Reportes    | Dos patrones de periodo distintos (Reportes vs Movimientos)                                                                                                                        | Pasos 14 y 15: un mismo control de periodo                                                               |
| P2        | Reportes    | Aviso de periodo con `amber-*` crudo (`reports-view.tsx:84-90`)                                                                                                                    | Paso 15 con el token de warning                                                                          |
| P2        | Reportes    | Top categorías con `YAxis width={112}` y margen fijo de 96: ~100 px para barras a 375 px (`top-categories-chart.tsx:50,62`)                                                        | Paso 12                                                                                                  |
| P2        | Reportes    | El rango personalizado pone dos `DatePickerField` sin wrap; puede desbordar a 375 px (`report-period-picker.tsx:182`)                                                              | Paso 15                                                                                                  |
| P2        | Reportes    | Periodo y tipo actualizan sin `aria-busy` (`report-period-picker.tsx:63-67`, `report-type-toggle.tsx:53`)                                                                          | Paso 15                                                                                                  |
| P2        | Reportes    | Tooltip en `font-mono` (`currency-tooltip.tsx:37`); historial del score con ticks irregulares y línea en el color del acento, igual que ingresos (`score-history-chart.tsx:17,69`) | Pasos 11 y 12                                                                                            |
| P2        | Reportes    | Tokens con comentario AA que no cumplen: `text-brand` 4.19:1 en claro; `--chart-3`/`--chart-4` bajo 3:1 (sin uso hoy)                                                              | Paso 5                                                                                                   |

**Hallazgos de la pasada `polish` (paso 16)**, con capturas en claro, en
oscuro y a 375 px de una vista con datos ficticios:

| Prioridad | Pantalla          | Hallazgo                                                                                                                                           | Acción                                                                                                            |
| --------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| P0        | Resumen, Reportes | `incomeExpenseLegend()` se exportaba desde un módulo `"use client"` y la llamaban componentes de servidor: la página fallaba al renderizar         | Resuelto: movida a `src/features/reports/series.ts`                                                               |
| P1        | Gráficas          | Las líneas (balance, score) quedaban cortadas: Recharts fija `stroke-dasharray` con el ancho inicial del contenedor y no lo recalcula              | Resuelto: `ChartContainer` quita el dasharray de `.recharts-line-curve`                                           |
| P1        | Reportes          | Top categorías: `barCategoryGap={22}` dejaba barras de 2 px y las etiquetas `inside*` se partían y se encimaban                                    | Resuelto: `barSize={12}` y "Nombre · monto" en una línea sobre la barra                                           |
| P1        | Score             | El tick "100" del eje Y se cortaba (".00")                                                                                                         | Resuelto: eje de 40 px                                                                                            |
| P2        | Todas             | Paleta de 12 colores de categorías: no pasa el validador de dataviz (ΔE con daltonismo 0.6 entre violeta e índigo; tonos 400 muy claros en oscuro) | Fuera (rediseño del sistema de colores de categoría; spec propio). Mitigado con nombre y monto junto a cada barra |

## Criterios de aceptación

- [ ] Impeccable está en `.claude/skills/`, versionado, y sus comandos responden en una sesión nueva tras clonar.
- [ ] El contexto de `teach` está en el repo y `CLAUDE.md` lo enlaza.
- [ ] La sección "Registro de hallazgos" tiene al menos un hallazgo por pantalla auditada, cada uno con prioridad, y todos los P0 están resueltos.
- [ ] La app usa Inter; `grep -r "Geist" app src` no devuelve resultados.
- [ ] Un usuario sin preferencia guardada ve el dashboard en oscuro; el toggle cambia a claro y lo recuerda.
- [ ] En oscuro el fondo es casi negro y las tarjetas gris oscuro sin borde, igual en Personal y Empresa; solo cambia el acento (emerald / naranja).
- [ ] Todo par texto/fondo nuevo da ≥ 4.5:1 y toda marca gráfica y foco ≥ 3:1, en claro y oscuro.
- [ ] El aside muestra logo, tabs Personal/Empresa, navegación, y abajo Ayuda, tema y usuario.
- [ ] En el Resumen de Personal el header saluda según la hora de Bogotá con el nombre del usuario.
- [ ] Cada pantalla de este spec muestra un solo título visible.
- [ ] En Personal, "Registrar movimiento" abre el diálogo de movimiento desde cualquier página del espacio.
- [ ] El menú "Más" registra un aporte a una meta elegida y un pago a una deuda elegida sin salir de la página, y navega a Importar.
- [ ] Sin metas (o sin deudas) el ítem del menú lleva a la página de metas (o deudas).
- [ ] En Empresa el header muestra solo "Registrar operación"; en cuenta no hay accesos.
- [ ] Las KPI muestran badge de variación vs. el periodo anterior; un aumento de gastos se pinta como negativo y uno de ingresos como positivo; sin periodo anterior no hay badge.
- [ ] Todas las gráficas de Resumen, Reportes y score usan el contenedor, tooltip y leyenda nuevos, ejes con montos abreviados en `es-CO` y grilla solo horizontal.
- [ ] Con `prefers-reduced-motion: reduce` no hay animaciones de entrada en gráficas ni tarjetas.
- [ ] Score, utilización, tasa de ahorro y saldo acumulado tienen ayuda (i) donde aparecen en las tres pantallas.
- [ ] Los estados vacíos de las tres pantallas tienen botón que abre la acción correspondiente.
- [ ] Landing, auth y legales cargan con Inter y tema nuevo sin errores visuales (texto ilegible, superposiciones).
- [ ] A 375 px de ancho el shell y las tres pantallas no tienen scroll horizontal.
- [ ] `docs/ui.md` existe y cubre tokens, componentes propios, ubicación de piezas y comandos de Impeccable.
- [ ] `CHANGELOG.md` tiene la entrada en `[Unreleased]`.
- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] No hay migraciones nuevas en `supabase/migrations/`.

## Decisiones

- **Sí:** partir en 14 y 14b. El 14 fija el sistema (tema, shell, gráficas, componentes) y lo prueba en las tres pantallas más usadas; 14b lo replica.
- **No:** un solo spec con las ~17 pantallas. PR enorme y difícil de revisar.
- **Sí:** oscuro por defecto con claro disponible. El diseño se piensa en negro sin quitar una opción que ya existe.
- **No:** solo oscuro. Pierde accesibilidad para quien prefiere claro.
- **Sí:** Impeccable como skill versionado en `.claude/skills/`. Llega a todos al clonar, sin pasos extra.
- **No:** plugin. Cada colaborador tendría que instalarlo y la versión no queda fija en el repo.
- **Sí:** ayudas en contexto y estados vacíos que enseñan.
- **No:** tour de primer ingreso. Necesita persistir "tour visto"; eso es un cambio de datos.
- **Sí:** accesos en el header: un primario + menú "Más". Limpio y disponible en todo el espacio.
- **No:** cuatro botones visibles. Ruido y no caben en anchos medios.
- **Sí:** aporte y pago desde el menú con `Select` de meta/deuda en el diálogo existente. Reusa los diálogos de SPEC 05 y 06.
- **Sí:** en Empresa solo "Registrar operación". No hay metas ni deudas en ese espacio.
- **Sí:** badge de variación calculado en el servidor con queries existentes. Da contexto sin esquema nuevo.
- **Sí:** color del badge por significado (gastos arriba = malo). El signo solo confunde.
- **Sí:** tarjetas gris oscuro sin borde, radios grandes y botones pill, como las referencias.
- **No:** tarjetas con borde sutil. Más ruido visual sobre negro.
- **Sí:** tabs Personal/Empresa arriba del aside y usuario abajo. Respeta la regla de `CLAUDE.md`.
- **No:** usuario arriba como en la referencia. Rompe la convención del proyecto.
- **Sí:** saludo solo en el Resumen; título de página en el resto.
- **Sí:** landing, auth y legales solo heredan fuente y tokens. El foco es el dashboard.
- **Sí:** Inter vía `next/font/google`. Pedido explícito; misma integración que Geist.
- **Sí:** textos de ayuda centralizados en `src/config/help.ts`. 14b los reusa sin duplicar.
- **No:** atajos de teclado. Funcionalidad nueva; fuera de este spec.

## Riesgos

| Riesgo                                                               | Mitigación                                                                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| El negro más profundo baja el contraste de `--muted` y categorías    | Verificar AA de cada token en el paso 5; ajustar solo la luminosidad, sin cambiar familia ni claves.           |
| Impeccable cambia de formato o de nombre de archivos entre versiones | Versión fijada en `docs/ui.md`; el nombre del archivo de contexto se confirma al instalar.                     |
| Las pantallas de 14b quedan con estilo viejo entre los dos specs     | Los tokens y componentes base se aplican globalmente; 14b solo reordena. Se acepta inconsistencia de layout.   |
| El cálculo de variación agrega queries y vuelve lento el Resumen     | Pedir periodo actual y anterior en la misma llamada `Promise.all`; reusar `getMonthlyTotals` con rango amplio. |
| Quitar bordes deja tarjetas indistinguibles en modo claro            | En claro la superficie se separa del fondo por contraste o sombra suave; se valida en el paso 5.               |

## Lo que **no** entra en este spec

- Presupuestos, metas, deudas, cuentas, importar, recomendaciones, Empresa y cuenta (SPEC 14b).
- Rediseño de landing, auth y legales.
- Layout móvil y hoja de acciones rápidas (SPEC 15).
- Tour guiado.
- Atajos de teclado.
- Cambios de esquema, migraciones o funciones nuevas.

Cada uno, si llega, va en su propio spec.
