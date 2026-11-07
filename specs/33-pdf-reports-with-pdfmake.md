# SPEC 33 — Reportes PDF con pdfmake

> **Estado:** Aprobado
> **Depende de:** SPEC 03, SPEC 07, SPEC 11, SPEC 12, SPEC 22, SPEC 32
> **Fecha:** 2026-11-07
> **Objetivo:** Que el usuario descargue desde el diálogo Exportar un reporte `.pdf` de un espacio (Personal o Empresa) con portada y QR, resumen del periodo, gráficas, score con recomendaciones y el detalle de cada mes, para hasta 12 meses, eligiendo tamaño, orientación y tema.

## Por qué existe este spec

SPEC 32 partió la exportación en dos: Excel y CSV (SPEC 32, implementado) y PDF (este). El Excel sirve para trabajar los datos; el PDF sirve para **presentarlos**: a un contador, a la familia, a un banco o para archivarlos. Por eso lleva lo que el Excel no puede tener: gráficas, portada, paginación cuidada y el score.

El motor es **pdfmake**, con el enfoque de un curso de reportes PDF (originalmente con NestJS) que el autor quiere seguir, adaptado a un Route Handler de Next:

- documento armado con **secciones reutilizables** (funciones que devuelven nodos de pdfmake);
- **encabezado, pie de página y numeración** "Página N de M";
- **temas personalizados** en un objeto, sin estilos repetidos;
- **tamaños y orientaciones** elegibles;
- **códigos QR, imágenes, SVG y gráficas**;
- **HTML a PDF** para textos ricos.

## Alcance

**Entra:**

- **Tab PDF en `ExportDialog`** (`src/features/exports/components/export-dialog.tsx`): el formato pasa a **Excel (.xlsx)** | **CSV (.csv)** | **PDF (.pdf)**, Excel sigue por defecto.
  - Con **PDF** aparecen, bajo el periodo:
    - **Tamaño**: `Select` con **A4** (por defecto) y **Carta**;
    - **Orientación**: tabs **Vertical** (por defecto) | **Horizontal**;
    - **Tema**: tabs **Color** (por defecto) | **Ahorro de tinta**, con una línea que explica cada uno.
  - Texto bajo el periodo con PDF: "Incluye N meses de detalle".
  - **Límite de 12 meses** con PDF. Un rango mayor se rechaza en el diálogo con "El PDF admite hasta 12 meses. Usa Excel para periodos más largos.". Si el historial supera 12 meses, **Todo el historial** queda deshabilitado con "Tu historial tiene N meses. El PDF admite hasta 12.". Al volver a Excel o CSV rige el límite de 36 de SPEC 32.
  - El resto del diálogo no cambia: prellenado, aviso de **Ocultar montos**, "Generando…", toast "Archivo descargado" y toast de error con el diálogo abierto.
- **Route Handler** `app/api/export/[workspaceId]/route.ts`, el mismo de SPEC 32:
  - `format=pdf` además de `xlsx` y `csv`;
  - parámetros nuevos solo con PDF: `size=a4|letter`, `orientation=portrait|landscape`, `theme=color|ink`. Si faltan, toman los valores por defecto; si no son válidos, 400;
  - más de 12 meses con PDF: 400 `{ error: "El PDF admite hasta 12 meses." }`;
  - responde `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="tesoro-<espacio>-<periodo>.pdf"` (mismo `exportFileName`) y `Cache-Control: no-store`;
  - mismas reglas de sesión, RLS, `findWorkspace` (404), 401 y espacio marcado para borrar que SPEC 32.
- **Motor:** `pdfmake` en el servidor, con su API de Node. `pdfmake`, `html-to-pdfmake` y `jsdom` solo se importan desde `src/features/exports/pdf/`, nunca desde un componente cliente.
- **Fuente Inter** embebida: Regular, SemiBold, Bold e Italic. Los TTF viven en `assets/fonts/` (licencia OFL, se añade `assets/fonts/OFL.txt`) y `pnpm brand:assets` genera `src/features/exports/pdf/fonts-data.ts` en base64, igual que `logo-data.ts` de SPEC 32.
- **Logo** como SVG vectorial desde `assets/brand/mark.svg`, generado por `pnpm brand:assets` en `src/features/exports/pdf/brand-data.ts`.
- **Metadatos del PDF:** `title` "Tesoro · <Espacio> · <Periodo>", `author` "Tesoro", `subject` "Reporte financiero", `creator` "Tesoro <versión>" (`SITE.info.version`), idioma `es-CO`.
- **Página:**
  - A4 (595 × 842 pt) o Carta (612 × 792 pt), vertical u horizontal;
  - márgenes: 40 pt a los lados, 72 pt arriba (encabezado) y 56 pt abajo (pie);
  - las gráficas y las tablas toman el ancho útil de la página, así que se adaptan a tamaño y orientación.
- **Encabezado** en todas las páginas menos la portada: logo pequeño y "Tesoro · Personal" (o "Tesoro · <Empresa>") a la izquierda, periodo a la derecha, línea fina del color del espacio debajo.
- **Pie de página** en todas las páginas menos la portada: "Generado el 7 nov 2026" a la izquierda y "Página N de M" a la derecha. La portada cuenta como página 1.
- **Temas** (`src/features/exports/pdf/theme.ts`):
  - acento por espacio: emerald en Personal y naranja en Empresa, tomado de `COLORS` de `workbook/theme.ts` (no se duplican valores);
  - **Color**: bandas de título de tabla con relleno del acento y texto blanco, encabezados de columna con tinte claro, filas alternas, montos de ingreso o venta en verde, de gasto o costo en rojo y de traspaso en gris;
  - **Ahorro de tinta**: sin rellenos. Títulos en texto del acento oscuro con una línea debajo, encabezados en negrita con línea inferior, sin filas alternas, montos en gris oscuro con signo `+` (ingreso, venta) o `−` (gasto, costo); traspasos sin signo. Gráficas con trazos y patrones de grises en vez de rellenos de color;
  - cada tema es un objeto con `styles` y `defaultStyle` de pdfmake, colores y grosores. Las secciones leen el tema; ninguna fija un color a mano;
  - todo par texto/fondo del tema Color da AA (4.5:1). El tema Ahorro de tinta usa texto ≥ `#4b5563` sobre blanco.
- **Estructura del documento**, en este orden:
  1. **Portada** (página propia, sin encabezado ni pie):
     - logo grande, "Reporte financiero", nombre del espacio, periodo ("Enero – Octubre 2026", "Octubre 2026 (en curso)") y "Generado el 7 nov 2026";
     - **QR** nativo de pdfmake con la URL de Reportes del espacio y el mismo periodo: `<SITE_URL>/dashboard/personal/reports?...` o `<SITE_URL>/dashboard/business/<id>/reports?...`, con los parámetros que usa `report-period-picker.tsx`. Debajo: "Escanéalo para abrir este periodo en Tesoro. Necesitas iniciar sesión.";
     - un párrafo de introducción (texto rico) que explica qué contiene el reporte.
  2. **Resumen del periodo** (nueva página):
     - KPIs en una fila de tarjetas. Personal: Ingresos, Gastos, Balance, Tasa de ahorro. Empresa: Ventas, Costos y gastos, Utilidad, Margen. Cada uno con su variación contra el periodo anterior de igual largo, con el cálculo de `src/features/reports/change.ts`;
     - tabla mes a mes con las mismas columnas y fila de totales que la hoja **Resumen** del Excel.
  3. **Gráficas** (nueva página):
     - Personal: **Ingresos vs gastos por mes** (barras agrupadas), **Gastos por categoría** (dona, top 6 + "Otras"), **Top categorías de gasto** (barras horizontales, top 8), **Saldo en cuentas al cierre** (línea);
     - Empresa: **Ventas vs costos por mes**, **Costos por categoría**, **Top categorías de costo**, **Utilidad por mes** (barras con negativos bajo el eje);
     - con un solo mes, las dos gráficas por mes se reemplazan por una tarjeta "Un solo mes: compara periodos más largos para ver la tendencia." y se mantienen dona y top;
     - cada gráfica con título, leyenda y montos abreviados con `src/components/charts/chart-format.ts` ("$1,2 M");
     - sin datos: la gráfica muestra "Sin datos en este periodo" en vez del dibujo.
  4. **Score y recomendaciones** (nueva página):
     - score **actual** al día de generación (Personal SPEC 07, Empresa SPEC 11), rotulado "Score al 7 nov 2026", con su banda y medidor semicircular en SVG;
     - tabla de factores (nombre, peso, valor, estado);
     - recomendaciones activas (no descartadas), con el mismo texto que la pantalla de Recomendaciones, como texto rico;
     - datos insuficientes: las razones que muestra la pantalla, sin número de score.
  5. **Detalle por mes**: cada mes empieza en página nueva, en orden cronológico, con título "Octubre 2026" y "(en curso)" si aplica. Mismas secciones, columnas, reglas de omisión y textos vacíos que las hojas de mes del Excel (SPEC 32):
     - Personal: Resumen del mes, Saldos por cuenta, Ingresos fijos, Gastos fijos, Presupuestos, Metas, Deudas y tarjetas, Me deben, Movimientos;
     - Empresa: Resumen del mes, Saldos por cuenta, Costos por categoría, Ventas, Costos y gastos, Traspasos.
- **Tablas** (`sections/table.ts`, reutilizable):
  - banda de título, encabezado de columnas, filas, fila de total opcional y fila vacía "Sin movimientos este mes" en cursiva;
  - `headerRows: 1` (el encabezado se repite al saltar de página) y `dontBreakRows: true`;
  - la banda de título no queda sola al final de una página (se mantiene con el encabezado y la primera fila);
  - montos alineados a la derecha en columna de ancho fijo (pdfmake no aplica `tabular-nums`).
- **Movimientos del mes** completos, en tabla compacta (8 pt):
  - **Vertical**: Fecha, Descripción, Categoría, Cuenta, Monto. Los traspasos muestran "Origen → Destino" en Cuenta;
  - **Horizontal**: Fecha, Hora, Tipo, Descripción, Categoría, Cuenta, Destino, Nota, Monto;
  - Empresa no tiene tabla de Movimientos (igual que su hoja del Excel): **Ventas** y **Costos y gastos** van en vertical con las mismas 5 columnas y en horizontal con las 9 del Excel (Fecha, Hora, Descripción, Categoría, Contraparte, Factura, Cuenta, Nota, Monto). **Traspasos** usa las 6 del Excel (Fecha, Hora, Origen, Destino, Nota, Monto) en ambas orientaciones;
  - orden: fecha, `day_position`, igual que SPEC 32.
- **Gráficas en SVG propio** (`src/features/exports/pdf/charts/`): funciones puras que reciben datos, tamaño y tema y devuelven un string SVG que pdfmake inserta como vector. Sin Chart.js, canvas ni servicios externos.
  - Escala y marcas del eje con valores redondos; etiquetas con `chart-format.ts`;
  - colores de las series desde el tema (`--income`, `--expense`, `--balance`, `--chart-*` vía `COLORS`);
  - todo texto del SVG se escapa (`&`, `<`, `>`, comillas). Los nombres de categoría vienen del usuario.
- **HTML a PDF** (`src/features/exports/pdf/rich-text.ts`) con `html-to-pdfmake` y una ventana de `jsdom`:
  - solo para textos de Tesoro: introducción de la portada, recomendaciones del score y notas explicativas de secciones;
  - etiquetas permitidas: `p`, `strong`, `em`, `ul`, `ol`, `li`, `br`, `a` (solo `href` `https:` o del propio sitio). Cualquier otra se elimina antes de convertir;
  - los valores interpolados (montos, nombres de categoría o de meta) se escapan antes de entrar al HTML;
  - las notas y descripciones del usuario **nunca** pasan por HTML: van como texto plano de pdfmake.
- **Documentación:** `docs/producto.md` (sección "Exportar", formato PDF), `docs/ui.md` (diálogo con PDF), `CLAUDE.md` (regla de imports de `pdfmake`/`jsdom` junto a la de `exceljs`, y que `pdf/theme.ts` también depende de los tokens), `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Más de 12 meses en un PDF.
- Elegir qué secciones incluir.
- Score histórico por mes del periodo.
- Gráficas dentro del Excel.
- Página pública para verificar la autenticidad de un PDF (QR con hash).
- PDF accesible etiquetado (PDF/UA): pdfmake no genera PDF etiquetado.
- Enviar el PDF por correo, guardarlo en Storage o programarlo.
- Descargar el PDF desde otras pantallas que no sean Reportes.
- Exportar el PDF desde el MCP (SPEC 34 lo deja fuera).
- Plantillas o logos personalizados del usuario (p. ej. el logo de su empresa).
- Notas del usuario con formato (HTML o Markdown).

## Modelo de datos

No hay tablas ni funciones nuevas en Postgres. Reusa `loadExportData` (SPEC 32), las consultas de Reportes (SPEC 03 y 11) y las del score (SPEC 07 y 11).

Cambios en `src/features/exports/types.ts`:

```ts
export const EXPORT_FORMATS = ["xlsx", "csv", "pdf"] as const

export const MAX_EXPORT_MONTHS = 36
export const MAX_PDF_MONTHS = 12

export const PDF_SIZES = ["a4", "letter"] as const
export const PDF_ORIENTATIONS = ["portrait", "landscape"] as const
export const PDF_THEMES = ["color", "ink"] as const

export interface PdfOptions {
  size: (typeof PDF_SIZES)[number] // por defecto "a4"
  orientation: (typeof PDF_ORIENTATIONS)[number] // por defecto "portrait"
  theme: (typeof PDF_THEMES)[number] // por defecto "color"
}
```

Datos extra que necesita el PDF y no tiene el Excel (`src/features/exports/pdf/types.ts`):

```ts
export interface PdfReportData {
  export: ExportData // el mismo de SPEC 32
  previousTotals: { income: number; expense: number } // periodo anterior
  categoryTotals: { name: string; total: number }[] // del periodo
  score: PdfScore // actual, Personal o Empresa
  reportsUrl: string // destino del QR
}

export type PdfScore =
  | {
      status: "ok"
      value: number
      band: string
      factors: { name: string; weight: number; value: string; state: string }[]
      recommendations: { title: string; html: string }[]
    }
  | { status: "insufficient"; reasons: string[] }
```

Tema (`src/features/exports/pdf/theme.ts`):

```ts
export interface PdfTheme {
  accent: string // del espacio
  accentDark: string
  accentTint: string
  text: string
  muted: string
  zebra: string | null // null en "ink"
  tone: Record<AmountTone, string> // reusa AmountTone de workbook/theme.ts
  signedAmounts: boolean // true en "ink"
  styles: StyleDictionary // pdfmake
  defaultStyle: Style
}

export function pdfTheme(
  type: WorkspaceType,
  variant: "color" | "ink"
): PdfTheme
```

## Estructura de archivos

```text
assets/fonts/Inter-{Regular,SemiBold,Bold,Italic}.ttf
assets/fonts/OFL.txt
src/features/exports/pdf/
  build-pdf.ts           # (workspace, data, range, today, options) → Buffer
  load-pdf-data.ts       # PdfReportData: export + totales previos + categorías + score
  fonts.ts               # registra Inter en pdfmake
  fonts-data.ts          # generado por brand:assets
  brand-data.ts          # generado por brand:assets (SVG del logo)
  theme.ts
  page.ts                # tamaño, orientación, márgenes, ancho útil
  rich-text.ts           # html-to-pdfmake + jsdom + allowlist
  layout/header.ts
  layout/footer.ts
  sections/cover.ts
  sections/period-summary.ts
  sections/charts.ts
  sections/score.ts
  sections/table.ts
  sections/movements-table.ts
  sections/personal-month.ts
  sections/business-month.ts
  charts/svg.ts          # escape, escalas, marcas de eje
  charts/grouped-bars.ts
  charts/horizontal-bars.ts
  charts/donut.ts
  charts/line.ts
  charts/gauge.ts
```

## Plan de implementación

1. **Dependencias.** `pnpm add pdfmake html-to-pdfmake jsdom` con versiones exactas, y sus `@types` si hacen falta. Revisar en `node_modules/next/dist/docs/` si `pdfmake` y `jsdom` van en `serverExternalPackages` de `next.config.ts` y agregarlos si el build lo pide. `pnpm build` pasa.
2. **Fuentes y logo.** Añadir los TTF de Inter y `OFL.txt` en `assets/fonts/`. Extender `scripts/generate-brand-assets.mjs` para generar `fonts-data.ts` y `brand-data.ts`. `pnpm brand:assets` genera ambos.
3. **Esqueleto del PDF.** `fonts.ts`, `page.ts`, `theme.ts` (los dos temas) y `build-pdf.ts` con portada mínima, encabezado y pie. Prueba: un script local genera un PDF de 2 páginas con "Página 2 de 2".
4. **Ruta.** `format=pdf` y los parámetros `size`, `orientation` y `theme` en `range.ts` y el Route Handler, con el límite de 12 meses. Prueba: `GET /api/export/<id>?format=pdf&from=2026-10&to=2026-10` descarga el PDF mínimo.
5. **Diálogo.** Tab PDF, selects de tamaño, orientación y tema, límite de 12 y textos. Prueba: descargar desde Reportes.
6. **Portada completa.** Logo, periodo, QR con la URL de Reportes y texto rico (`rich-text.ts` con allowlist).
7. **Tabla reutilizable.** `sections/table.ts` con los dos temas, total, vacío, `headerRows` y `dontBreakRows`.
8. **Detalle por mes Personal.** `personal-month.ts` y `movements-table.ts` (vertical y horizontal).
9. **Detalle por mes Empresa.** `business-month.ts`.
10. **Resumen del periodo.** `load-pdf-data.ts` (totales del periodo anterior) y `period-summary.ts`.
11. **Gráficas SVG.** `charts/*` y `sections/charts.ts` para Personal y Empresa, con el caso de un solo mes y sin datos.
12. **Score.** `load-pdf-data.ts` agrega el score y las recomendaciones; `sections/score.ts` y `charts/gauge.ts`.
13. **Documentación.** `docs/producto.md`, `docs/ui.md`, `CLAUDE.md`, `CHANGELOG.md`.

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] El diálogo Exportar muestra el formato **PDF (.pdf)** y, al elegirlo, Tamaño, Orientación y Tema.
- [ ] Con PDF, un rango de 13 meses muestra el error del diálogo y no llama al servidor.
- [ ] `GET` con `format=pdf` y 13 meses responde 400 con "El PDF admite hasta 12 meses.".
- [ ] `GET` con `format=pdf&size=a3` responde 400.
- [ ] Un PDF de un espacio ajeno responde 404 y sin sesión responde 401.
- [ ] El archivo se llama `tesoro-personal-2026-10.pdf` para octubre 2026 en Personal.
- [ ] La portada no tiene encabezado ni pie; las demás páginas sí.
- [ ] El pie de la última página dice "Página M de M" con M igual al total de páginas.
- [ ] Escanear el QR de la portada abre Reportes del mismo espacio con el mismo periodo (tras iniciar sesión).
- [ ] Los totales del Resumen del periodo coinciden con los de la hoja Resumen del Excel para el mismo periodo.
- [ ] La página de Gráficas tiene 4 gráficas vectoriales (el texto del eje se puede seleccionar).
- [ ] Un periodo de un solo mes muestra la tarjeta de un solo mes en lugar de las dos gráficas por mes.
- [ ] El score del PDF coincide con el de la pantalla de Recomendaciones el mismo día, con las mismas recomendaciones activas.
- [ ] Con datos insuficientes para el score, la página muestra las razones y ningún número.
- [ ] Cada mes del detalle empieza en página nueva y tiene las mismas secciones que su hoja del Excel.
- [ ] Un mes con más movimientos de los que caben en una página repite el encabezado de la tabla en la página siguiente y ninguna fila queda partida.
- [ ] En horizontal, la tabla de movimientos de Personal tiene 9 columnas y las de Ventas y Costos y gastos de Empresa, las 9 del Excel; en vertical, 5 en ambos.
- [ ] Carta horizontal y A4 vertical generan páginas del tamaño correcto (612 × 792 pt rotado y 595 × 842 pt).
- [ ] Con el tema **Ahorro de tinta** no hay rellenos de color y los montos llevan `+` o `−`.
- [ ] Con el tema **Color**, el texto blanco sobre la banda del acento da 4.5:1 en Personal y en Empresa.
- [ ] Una categoría llamada `<b>Comida & más</b>` se ve tal cual en tablas y gráficas, sin romper el SVG.
- [ ] Una nota de movimiento con `<script>` o `<a href="javascript:...">` sale como texto plano.
- [ ] Las tildes y la ñ se ven correctas con Inter en todo el documento.
- [ ] Las propiedades del PDF muestran título, autor "Tesoro" y asunto "Reporte financiero".
- [ ] Un PDF de 12 meses con más de 1000 movimientos se genera en menos de 10 s en local con `pnpm build && pnpm start`.
- [ ] Con **Ocultar montos** activo, el diálogo muestra el aviso y el PDF trae los montos reales.
- [ ] Ningún componente cliente importa `pdfmake`, `html-to-pdfmake` ni `jsdom` (el bundle del cliente no los incluye).

## Decisiones

- **Sí:** pdfmake. Es el motor del curso que el autor quiere seguir: definición declarativa del documento, encabezado y pie con número de página, tablas con encabezado repetido, QR nativo y soporte de SVG.
- **No:** `@react-pdf/renderer`. Estable y liviano, pero se aleja del enfoque del curso.
- **No:** HTML a PDF con Chromium (puppeteer). Unos 50 MB por función, arranque lento y frágil en serverless.
- **No:** imprimir desde el navegador. El resultado depende del navegador y no hay control de encabezado, pie ni numeración.
- **Sí:** el mismo Route Handler y el mismo diálogo de SPEC 32. Un solo lugar para exportar; reusa sesión, RLS, periodo y nombre de archivo.
- **Sí:** gráficas como SVG propio en el servidor. Vectoriales, sin dependencias nativas, sin enviar datos a terceros y con los colores del tema.
- **No:** Chart.js con `chartjs-node-canvas`. Necesita `canvas` nativo, pesa en serverless y da imágenes rasterizadas.
- **No:** QuickChart. Los datos financieros saldrían a un servicio externo.
- **No:** reusar Recharts. Renderiza en el DOM del navegador; en el servidor habría que simularlo.
- **Sí:** QR al reporte en Tesoro. No expone datos: la página pide sesión del dueño.
- **No:** QR de verificación de autenticidad. Requiere tabla y página pública nuevas; puede llegar en otro spec.
- **Sí:** el usuario elige tamaño (A4, Carta), orientación y tema. Carta es común en Colombia y horizontal da más columnas a los movimientos.
- **Sí:** tema **Ahorro de tinta**. Muchos reportes se imprimen en blanco y negro; el signo `+`/`−` reemplaza el color.
- **Sí:** colores del tema tomados de `workbook/theme.ts`. Un solo lugar refleja los tokens de `globals.css` para los dos formatos.
- **Sí:** HTML a PDF solo para textos de Tesoro, con allowlist de etiquetas. Recomendaciones y textos explicativos ganan formato sin abrir la puerta a HTML del usuario.
- **No:** pasar notas del usuario por HTML. Sería una vía de inyección; como texto plano no hay nada que sanitizar.
- **Sí:** límite de 12 meses. Con detalle por mes, 36 meses pasan de 150 páginas y del tiempo razonable de la función. Para más, está el Excel.
- **Sí:** todas las secciones fijas, omitiendo las que no tienen datos. Mismo criterio que el Excel y un diálogo simple.
- **Sí:** todos los movimientos del mes, en tabla compacta. El PDF es un reporte completo; recortar a un top haría que no cuadre con los totales.
- **Sí:** score actual, no histórico. El cálculo de SPEC 07 y 11 no está pensado para fechas pasadas; se rotula con la fecha de generación.
- **Sí:** Inter embebida en base64 generada por `brand:assets`. Mismo criterio que el logo del Excel: no depende de leer archivos con `fs` en el despliegue.
- **Sí:** montos reales aunque **Ocultar montos** esté activo. Igual que SPEC 32.

## Riesgos

| Riesgo                                                         | Mitigación                                                                                                                                      |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `jsdom` y `pdfmake` no se empaquetan bien en el build de Next  | Paso 1 los prueba antes de escribir secciones; si hace falta, `serverExternalPackages`.                                                         |
| 12 meses con muchos movimientos tardan demasiado               | Datos con las consultas paginadas de SPEC 32. Criterio de 10 s; si se pasa, se baja el límite o se generan los movimientos en tabla más simple. |
| Las fuentes en base64 inflan la función del servidor (~1,5 MB) | Solo cuatro pesos de Inter. Es código de servidor: no llega al navegador.                                                                       |
| El SVG usa algo que el conversor de pdfmake no soporta         | `charts/*` usa solo `rect`, `path`, `line`, `circle`, `text` y `g`, sin CSS, filtros ni `foreignObject`.                                        |
| Los totales del PDF no cuadran con el Excel o las pantallas    | El PDF parte de `loadExportData` y de las mismas consultas de Reportes y score; criterios comparan ambos.                                       |
| Una categoría con caracteres especiales rompe el SVG           | Escape obligatorio en `charts/svg.ts` y criterio de aceptación con `<b>Comida & más</b>`.                                                       |
| La URL del QR cambia si cambian los parámetros de Reportes     | La URL se arma con la misma función de `report-period-picker.tsx`, no con un string a mano.                                                     |
| La API de servidor de pdfmake cambia entre versiones           | Versión exacta fijada; el uso de la API queda en `fonts.ts` y `build-pdf.ts`.                                                                   |

## Lo que **no** entra en este spec

- Más de 12 meses por PDF.
- Elegir secciones.
- Score histórico por mes.
- QR de verificación de autenticidad.
- PDF etiquetado accesible (PDF/UA).
- Correo, Storage o exportaciones programadas.
- PDF desde el MCP.
- Logos o plantillas propias del usuario.

Cada uno, si llega, va en su propio spec.
