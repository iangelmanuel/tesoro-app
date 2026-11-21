# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Principal:** una persona en Colombia que registra a mano sus ingresos y
  gastos, a diario o al cierre del mes, para entender en qué se le va la plata
  y si va bien. No es experta en finanzas. Trabaja en `es-CO` y en COP.
- **Secundario:** el dueño de un negocio pequeño o independiente que usa el
  espacio Empresa para separar las cuentas del negocio de las personales.

## Product Purpose

Tesoro convierte los registros del usuario (ingresos, gastos, deudas, metas,
cuentas) en un panorama claro: gráficas, un score de salud financiera y
recomendaciones concretas. Hay éxito cuando el usuario entiende su mes de un
vistazo y sabe qué hacer después, sin aprender contabilidad.

## Positioning

- No conecta bancos y no obliga a armar las finanzas desde cero. Parte de lo
  que el usuario registra o importa (Excel/CSV).
- El score y las recomendaciones salen de los movimientos propios del usuario,
  no de consejos genéricos.
- Código abierto (MIT) y privado por defecto: cada usuario solo ve sus datos.
- **Se conecta con tu agente de IA (SPEC 34).** Tesoro no tiene IA propia:
  expone un servidor MCP para que el agente que el usuario ya usa (Claude,
  ChatGPT, Claude Code, Cursor u otro) lea y registre sus datos, con su login
  y bajo su control. Los textos hablan de "conectar tu agente", nunca de una
  IA de Tesoro que analiza, decide o recomienda por su cuenta.
- **Abierto (sin decidir):** una capa de IA propia sobre esos registros. Aún
  no hay alcance, proveedor ni fecha. Ninguna UI ni texto debe prometerla
  todavía.

## Operating Context

- Dos espacios por cuenta, con selector arriba del aside:
  - **Personal**, por defecto: resumen, movimientos, cuentas, presupuestos,
    metas, deudas, reportes y recomendaciones;
  - **Empresa**, opcional: flujo de caja, ventas, costos, reportes y
    recomendaciones.
- La tarea más frecuente es registrar un movimiento. Le siguen revisar el
  resumen del mes, abonar a una meta o pagar una deuda, e importar un
  extracto.
- Uso principal en escritorio. En móvil la UI no debe romperse (el layout
  móvil es un spec aparte).

## Capabilities and Constraints

- Next.js (App Router) + React + TypeScript, shadcn con primitivas de
  Base UI en `src/components/ui/` (SPEC 51 a SPEC 53), Tailwind 4,
  Recharts, Supabase
  con RLS. Detalle en `CLAUDE.md` y
  `docs/producto.md`.
- Marca, rutas, navegación y textos de marca viven en `src/config/site.ts`
  (`SITE`). No se duplican en componentes.
- Montos en COP por defecto y fechas en `es-CO`. Zona horaria
  `America/Bogota`.
- Score de 0 a 100 con factores y pesos definidos en `docs/producto.md`
  ("Factores y pesos").

## Brand Commitments

- Nombre "Tesoro". Slogan: "Tus finanzas, claras desde el primer registro."
- Isotipo: monograma T geométrico (SPEC 50). El asta son dos barras que
  suben, como una gráfica; la alta sostiene el travesaño. Va sin cuadro ni
  fondo, a un solo color: en tinta (el color del texto) en la UI y en el
  emerald de marca (`#059669`) en favicon, íconos de app, logo y OG
  (`assets/brand/mark.svg` y `mark-color.svg`). Wordmark "Tesoro" en paths.
  Color de marca de la UI `--brand` (emerald-500, sin cambios en SPEC 51).
- Voz: cercana, en tuteo, frases cortas, verbos de acción y sin jerga
  financiera sin explicar. Tranquila con las cifras, nunca alarmista.
- Restricciones visuales fijadas por SPEC 14 y SPEC 51 (se registran aquí,
  el detalle vive en DESIGN.md / `docs/ui.md`):
  - shadcn (Base UI, estilo Maia personalizado) con los tokens de
    `src/styles/globals.css`; dirección "Señalética": cada pantalla es una
    estación con la letra de su atajo y el espacio activo es la línea
    encendida del aside;
  - en el dashboard, oscuro por defecto sobre una base casi negra, con
    claro disponible; las páginas públicas (landing, legales) siempre en
    claro sobre blanco (SPEC 40);
  - un solo acento por espacio: neutro fuera de los espacios, emerald en
    Personal y naranja en Empresa, aplicado por ruta y nunca por props;
  - simplicidad y densidad media, tarjetas sin borde y campos con relleno;
  - dinero por significado y apto para daltonismo rojo-verde: ingreso
    turquesa, gasto coral y balance en tinta, siempre con signo e ícono;
  - tipografía Atkinson Hyperlegible Next (OFL), hecha para baja visión,
    con cifras tabulares; también en los PDF exportados.

## Evidence on Hand

- Especificación de producto: `docs/producto.md`. Specs por módulo en
  `specs/`.
- Videos de la landing (SPEC 24) en `public/videos/`: la app real grabada
  con un usuario demo y datos de ejemplo, en un escritorio estilo macOS propio
  (sin marcas de Apple), renderizados con Hyperframes. Un video principal de
  ~56 s y 5 clips de funciones, todos con la nota "Datos de ejemplo".
- Ejemplo del score con datos ficticios que lo dicen (`score-visual.tsx`).
- Video de ambiente del hero (SPEC 40): tomas de stock con licencia libre
  (Pexels), sin caras ni marcas, con tinte verde. No muestra la app; sus
  créditos están en `docs/creditos-media.md`.
- No hay testimonios, clientes, métricas de uso ni prensa. No se inventan.

## Product Principles

1. **Parte de tus registros.** Nada exige configuración previa ni conexión
   bancaria. Toda cifra sale de lo que el usuario registró.
2. **Claridad antes que cantidad.** Pocas métricas, bien explicadas, con ayuda
   en contexto donde haya un concepto (score, utilización, tasa de ahorro).
3. **Registrar es lo primero.** La acción de registrar un movimiento está a un
   clic desde cualquier pantalla del espacio.
4. **Privacidad por defecto.** Sin analítica de terceros, sin cookies de
   terceros, datos aislados por usuario y por espacio.

## Accessibility & Inclusion

WCAG AA en claro y oscuro: 4.5:1 en texto, 3:1 en marcas gráficas y foco.
Toda animación respeta `prefers-reduced-motion`. Desde SPEC 51, además:
áreas táctiles de 44 × 44 px en todo tamaño, foco siempre visible, enlace
"Saltar al contenido", montos leídos completos ("menos 120.000 pesos") o
"Monto oculto", errores anunciados al momento y atajos de una tecla que se
pueden apagar.
