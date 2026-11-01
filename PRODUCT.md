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
- **Abierto (sin decidir):** una futura capa de IA sobre esos mismos
  registros. Aún no hay alcance, proveedor ni fecha. Ninguna UI ni texto debe
  prometerla todavía.

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

- Next.js (App Router) + React + TypeScript, HeroUI v3 sin Provider,
  Tailwind 4, Recharts, Supabase con RLS. Detalle en `CLAUDE.md` y
  `docs/producto.md`.
- Marca, rutas, navegación y textos de marca viven en `src/config/site.ts`
  (`SITE`). No se duplican en componentes.
- Montos en COP por defecto y fechas en `es-CO`. Zona horaria
  `America/Bogota`.
- Score de 0 a 100 con factores y pesos definidos en `docs/producto.md`
  ("Factores y pesos").

## Brand Commitments

- Nombre "Tesoro". Slogan: "Tus finanzas, claras desde el primer registro."
- Isotipo: un cofre sobre un cuadro redondeado (`assets/brand/mark.svg`).
  Color de marca `--brand` (emerald-500).
- Voz: cercana, en tuteo, frases cortas, verbos de acción y sin jerga
  financiera sin explicar. Tranquila con las cifras, nunca alarmista.
- Restricciones visuales fijadas por SPEC 14 (se registran aquí, el detalle
  vive en DESIGN.md / `docs/ui.md`):
  - tema HeroUI v3 con los tokens de `src/styles/globals.css`;
  - oscuro por defecto sobre una base casi negra, con claro disponible;
  - un solo acento por espacio: neutro fuera de los espacios, emerald en
    Personal y naranja en Empresa, aplicado por ruta y nunca por props;
  - simplicidad y densidad media;
  - tipografía Inter.

## Evidence on Hand

- Especificación de producto: `docs/producto.md`. Specs por módulo en
  `specs/`.
- Visuales de la landing: mockups JSX interinos con datos ficticios
  (`hero-visual.tsx`, `score-visual.tsx`).
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
Toda animación respeta `prefers-reduced-motion`.
