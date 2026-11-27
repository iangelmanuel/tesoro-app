# SPEC 57 — Rendimiento: render e hidratación del dashboard

> **Estado:** Implementado
> **Depende de:** SPEC 51, SPEC 56a, SPEC 56b
> **Fecha:** 2026-11-26
> **Objetivo:** Llevar las rutas principales del dashboard a Lighthouse móvil ≥ 90 bajando el trabajo de render e hidratación en el navegador, sin cambiar lo que ve ni puede hacer el usuario.

## Por qué existe este spec

SPEC 56b bajó el JS inicial del dashboard un tercio (`/dashboard/personal` de 2.003 kB a 1.314 kB) y el TBT entre un 35 % y un 45 % frente a `master` con la misma CPU. Pero Lighthouse móvil sigue en 45–49, lejos de la meta de 90 que fijó 56b. Ese criterio, los dos del Profiler y los Sheets que no se difirieron pasan a este spec.

Lo que dicen los reportes de 56b (`docs/rendimiento.md`, "Cliente (SPEC 56b)"):

- **El TBT no es de descarga.** En `/dashboard/personal`, ~2,7 s de script son de `react-dom`: renderizar e hidratar el árbol del dashboard con la CPU 4× simulada. Menos kB ya no lo baja más.
- **El LCP espera a la hidratación.** El elemento LCP es una cifra del resumen que llega en streaming. Casi todo su tiempo es "Render Delay": el HTML llega, pero el hilo principal está ocupado y la pinta tarde.
- **Todo el shell hidrata en cada ruta.** El aside, el header, los accesos rápidos (con categorías, cuentas, metas, deudas, cobros y pagos del espacio en el payload), la barra inferior y la hoja móvil (también en escritorio, ocultas por CSS), los atajos, la paleta y los tutoriales.
- **La cuenta de pruebas abre el tutorial de bienvenida al entrar**, que suma su motor y su diálogo a la carga.
- **Quedan Sheets sin diferir.** Deuda, Meta, Gasto fijo e Ingreso fijo entran completos en sus páginas (`/dashboard/personal/debts` bajó solo 3 % en 56b).
- **El React Compiler suma código.** Su memoización agregó ~120 kB en Movimientos antes de diferir y ~1 % en las páginas públicas.
- **El Profiler no se midió en 56b.** No hay línea base de commits ni de componentes renderizados.

## Alcance

**Entra:**

### 1. Línea base

- Profiler de React (build `next build --profile`) en `master` y en la rama, en las tres interacciones de 56b: escribir en el buscador de Movimientos, cambiar de mes en Reportes y abrir el diálogo de movimiento. Commit más largo y componentes renderizados.
- Hidratación al cargar: el track "Components" de React en el Performance panel (o el Profiler con "Record why each component rendered") para saber qué subárboles cuestan más en `/dashboard/personal`, `/dashboard/personal/transactions` y `/dashboard/personal/reports`.
- Tamaño del payload RSC de cada ruta (lo que se serializa a props de componentes cliente), con el dato más pesado de cada una.
- Lighthouse móvil con el método de 56b: Preview intercalado con producción (`master`), anotando el `benchmarkIndex` de cada corrida.

### 2. Shell más liviano

- Lo que solo existe en un tamaño de pantalla no hidrata en el otro: la barra inferior y la hoja de acciones rápidas no se montan en escritorio, y lo propio del aside de escritorio no se monta en el teléfono. Sin salto de layout: la decisión sale del CSS o de una cookie de viewport, no de un efecto que cambie lo pintado.
- Los accesos rápidos no viajan con todos los datos del espacio en cada ruta. Lo que solo usan los formularios (metas, deudas, cobros, pagos pendientes, ingresos fijos) se pide al abrir el formulario o se precarga con su disparador, como el chunk en 56b.
- Lo que no se ve al entrar no se monta al entrar: atajos de teclado, motor de tutoriales y diálogos montados con `open={false}`.

### 3. Menos componentes cliente

- Las tarjetas y listas de solo lectura del Resumen, Movimientos y Reportes se revisan una por una. Las que no tienen estado ni eventos pasan a componente de servidor; las que sí, dejan la parte estática en el servidor y solo la parte interactiva en el cliente.
- Los Sheets de Deuda, Meta, Gasto fijo e Ingreso fijo difieren su cuerpo como Categorías en 56b: cabecera fija y cuerpo con `lazyWithPreload`, conservando el estado que hoy sobrevive al cerrar.

### 4. LCP

- La cifra que hoy es LCP se pinta sin esperar a la hidratación: llega en el shell o en el primer chunk del streaming, y nada en el hilo principal la retrasa más de lo necesario.
- La hidratación de lo que no está en el primer viewport no bloquea el pintado del primero (`Suspense` por región y prioridad de transición donde aplique).

### 5. Render al interactuar

- Con el Profiler de §1, se corrigen los commits de más de 200 ms y los re-renders que el compilador no resuelva.

### 6. Documentación

- `docs/rendimiento.md`: sección "Render e hidratación (SPEC 57)" con "Antes" y "Después" de Lighthouse (con su control), Profiler, hidratación por subárbol y payload RSC.
- `docs/arquitectura.md`: cuándo un componente va en el servidor y cuándo en el cliente después de este spec; qué datos viajan en el layout.
- `docs/ui.md`: el patrón de Sheet con cuerpo diferido.
- `CHANGELOG.md` `[Unreleased]`: entrada en inglés.

**Fuera de alcance:**

- Base de datos y consultas del servidor (56a).
- Landing, páginas públicas, videos y Speed Insights (56c).
- Cambiar de librería de componentes, gráficas, tabla o arrastre.
- Quitar el React Compiler. Si su costo pesa, se mide y se decide en un spec propio.
- Rediseños de UI.

## Modelo de datos

Este spec no introduce estructuras de datos nuevas. Puede mover lecturas que hoy hace el layout a actions o queries que se piden al abrir un formulario; esas lecturas siguen pasando por RLS con la sesión del usuario.

## Plan de implementación

1. **Línea base.** Profiler de `master` y de la rama de 56b, hidratación por subárbol, payload RSC por ruta y Lighthouse con control. Anotar en `docs/rendimiento.md`.
2. **Shell por tamaño de pantalla.** Barra inferior y hoja móvil solo en el teléfono, lo del aside solo en escritorio, sin salto de layout.
3. **Datos de los accesos rápidos bajo demanda.** Sacar del layout lo que solo usan los formularios y pedirlo al abrir o precargarlo.
4. **Montaje diferido de lo que no se ve.** Atajos, tutoriales y diálogos cerrados.
5. **Componentes de servidor.** Revisar las tarjetas y listas de Resumen, Movimientos y Reportes, una por commit.
6. **Sheets diferidos.** Deuda, Meta, Gasto fijo e Ingreso fijo, uno por commit.
7. **LCP.** La cifra principal del Resumen y de Reportes sin esperar a la hidratación.
8. **Render al interactuar.** Corregir lo que el Profiler muestre por encima de 200 ms.
9. **Medición "Después".** Repetir §1 en el Preview, intercalado con producción.
10. **Documentación** (§6).

## Criterios de aceptación

- [ ] Lighthouse móvil de `/dashboard/personal`, `/dashboard/personal/transactions` y `/dashboard/personal/reports` en el Preview: Performance ≥ 90, LCP ≤ 2,5 s, CLS ≤ 0,1 y TBT ≤ 200 ms (mediana de 3, con `benchmarkIndex` ≥ 1.200 en las corridas). **No se cumple:** Performance 57 en el Preview. Lo frenan el LCP y el costo de estilos, que quedan fuera de este spec (ver notas).
- [ ] En las mismas corridas, el TBT de cada ruta es menor que el de `master` medido en la misma ventana. **Solo en Movimientos** (889 frente a 1.541 ms). `/dashboard/personal` y Reportes quedan iguales dentro del ruido.
- [x] Escribir en el buscador de Movimientos no da commits de más de 200 ms en el Profiler.
- [x] Las tres interacciones del Profiler renderizan menos componentes que en la línea base de `master`.
- [x] En escritorio no se monta la barra inferior ni la hoja de acciones rápidas, y en el teléfono no se monta lo propio del aside, sin salto de layout (CLS ≤ 0,1).
- [x] El payload RSC de `/dashboard/personal` baja respecto a la línea base.
- [x] Los Sheets de Deuda, Meta, Gasto fijo e Ingreso fijo cargan su cuerpo al abrir, con su skeleton, y conservan el estado que hoy sobrevive al cerrar.
- [ ] Ningún flujo cambia: registrar, editar, pagar, aportar, recibir, reordenar, filtrar, exportar e importar funcionan igual en Personal y Empresa, en escritorio y teléfono. **Prueba manual pendiente en el PR** para Empresa, reordenar, exportar, importar y pagar una deuda real.
- [x] `docs/rendimiento.md` tiene las tablas "Antes" y "Después" de este spec.
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm test` y `pnpm build` pasan.

Notas de la verificación (detalle en `docs/rendimiento.md`, "Render e hidratación (SPEC 57)"):

- **Método.** Build de producción local contra la Supabase remota. Control: un worktree de `master` (`de555fb`) servido a la vez, con las corridas intercaladas. El Profiler y la hidratación se midieron con un hook mínimo de DevTools sobre `next build --profile`.
- **Lighthouse.** En local, con `benchmarkIndex` de 1.558 a 1.778, la rama da 50–60 de Performance y `master` 53–55. En el Preview, 57. LCP de 4,8 a 6,0 s y CLS ≤ 0,002. Lighthouse no manda la cookie `tesoro-viewport`, así que cada corrida es una primera visita.
- **LCP.** El HTML de la cifra llega 0,5–0,9 s después del primer byte, por la cadena auth → espacio → consultas. Después, React agrupa los revelados del streaming (300 ms por nivel de `Suspense`). La pintura espera al recálculo de estilos, que suma 1,1–1,8 s por carga a 4×. Se probaron y revirtieron tres cambios sin efecto medible: preferencias del layout como promesa, `:has()` con sujeto y `content-visibility`. Bajarlo exige tocar la cadena de datos del servidor o cachear los KPI, montar las gráficas como SVG estático, tener menos componentes cliente en el shell y revisar el costo de estilos. Nada de eso entra en este spec.
- **Hidratación** (CPU 4×, con cookie de viewport). Movimientos en el teléfono pasa de 2.307 a 1.695 componentes y Reportes de 2.211 a 1.847. El commit más largo de `/dashboard/personal` en escritorio baja de 508 a 238 ms.
- **Profiler.** Buscar: commit más largo de 47,8 a 30,4 ms, componentes de 1.590 a 1.080. Cambiar de mes: de 4.138 a 3.638 componentes; casi todo son fotogramas de la animación de Recharts, así que el total varía entre 3.600 y 4.050 en las dos versiones. Abrir el diálogo: de 298 a 295.
- **Payload RSC.** En la cuenta de pruebas queda igual, porque no tiene metas ni deudas. Con 5 elementos temporales (borrados después), `/dashboard/personal` pasa de 212,7 a 210,7 kB.
- **JS inicial.** Deudas de 1.774 a 1.578 kB, Metas de 1.559 a 1.416 kB e Ingresos fijos de 1.567 a 1.422 kB.
- **Revertido por subir el payload RSC:** pasar al servidor `ui/table.tsx` (+5,9 kB) y los ítems de recomendación (+3,4 kB).
- **Flujos verificados con Playwright en el build:** el shell al girar y al redimensionar; los accesos rápidos (precarga, tabs de pago, atajo T y Aportar, Pagar y Cobro sin datos); Categorías conserva la pestaña; las acciones de fila en escritorio, el menú contextual y el teléfono. También los 5 Sheets con datos temporales, y "Marcar como pagado" y "Eliminar" desde el Sheet de Gasto fijo.

## Decisiones

- **Sí:** medir siempre con control (`master` intercalado) y anotar el `benchmarkIndex`. En 56b la CPU de la máquina que corre Lighthouse varió a la mitad entre corridas y duplicó el TBT.
- **Sí:** atacar render e hidratación, no más kB. En 56b el bundle bajó un tercio y el Performance no se movió.
- **Sí:** la línea base del Profiler en `master`, no en la rama. Sin ella, "menos componentes" no se puede cerrar.
- **No:** `ssr: false` para esconder trabajo de hidratación. Deja huecos hasta que llega el JS y empeora el LCP.
- **No:** decidir el layout de escritorio o teléfono con un efecto en el cliente. Pinta uno y lo cambia: salto de layout.
- **Sí:** metas numéricas duras, las mismas de 56b. Sin ellas, "más rápido" no se puede cerrar.

## Riesgos

| Riesgo                                                                        | Mitigación                                                                                                             |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Pasar un componente a servidor rompe una interacción que dependía del cliente | Revisar uno por commit; probar a mano su flujo y el menú contextual de fila.                                           |
| Pedir los datos de un formulario al abrir lo hace tardar                      | Precarga en `pointerenter` / `focus` del disparador, como el chunk en 56b; el formulario muestra su skeleton mientras. |
| No montar la barra móvil en escritorio produce un salto al cambiar de tamaño  | La decisión sale del CSS o de una cookie leída en el servidor; se prueba al girar el teléfono y al redimensionar.      |
| El Performance depende de la CPU de la máquina y no del código                | Control intercalado y mínimo de `benchmarkIndex` en el criterio.                                                       |
| Diferir los Sheets pierde el estado que hoy sobrevive al cerrar               | El estado se queda en la cabecera fija y se pasa al cuerpo, como en Categorías (56b).                                  |

## Lo que **no** entra en este spec

- Base de datos, sesión y consultas del servidor (SPEC 56a).
- Landing, públicas, videos y Speed Insights (SPEC 56c).
- Quitar el React Compiler o cambiar de librerías.
- Rediseñar pantallas.

Cada uno, si llega, va en su propio spec.
