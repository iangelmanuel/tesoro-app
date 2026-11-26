# SPEC 56b — Rendimiento: bundle del cliente y dashboard

> **Estado:** Implementado
> **Depende de:** SPEC 51, SPEC 52a, SPEC 56a
> **Fecha:** 2026-11-26
> **Objetivo:** Bajar el JavaScript inicial del dashboard y el trabajo de render en el navegador con el React Compiler, carga diferida de lo que no se usa al entrar y prefetch revisado, sin cambiar lo que ve ni puede hacer el usuario.

## Por qué existe este spec

Es el segundo de la serie 56 (ver SPEC 56a). 56a bajó el tiempo del servidor; este baja lo que pasa en el navegador después de que llega el HTML: cuánto JS se descarga, cuánto tarda en hidratar y cuánto se re-renderiza al interactuar.

Hallazgos del reconocimiento previo:

- **236 archivos `"use client"`** y **ningún `memo()`**. El React Compiler no está activo (`reactCompiler` ausente en `next.config.ts`).
- **Todo se descarga al entrar.** Solo hay carga diferida en el menú móvil público, la lectura de archivos de Importar, `motion` de la landing y el motor de tutoriales. Recharts (5 gráficas), `cmdk` (paleta ⌘K), `@dnd-kit/react`, `react-day-picker` y los diálogos de formulario viajan en el bundle de cada ruta que los importa, aunque no se abran.
- **`@dnd-kit/react` siempre montado** en la tabla de Movimientos (`transactions-table.tsx`), aunque el usuario no reordene.
- **`DatePickerField`** se usa en 15 archivos y arrastra el `Calendar` completo aunque el popover esté cerrado.

## Alcance

**Entra:**

### 1. Línea base

- Parte de la foto "Antes" de 56a (`docs/rendimiento.md`): JS por ruta de `next build` y Lighthouse de las rutas del dashboard.
- Se agrega `pnpm next analyze` (Bundle Analyzer de Turbopack, Next 16.1+): los 10 módulos cliente más pesados de `/dashboard/personal`, `/dashboard/personal/transactions` y `/dashboard/personal/reports`, anotados en `docs/rendimiento.md`.
- React DevTools Profiler (build de producción con perfilado) en tres interacciones: escribir en el buscador de Movimientos, cambiar de mes en Reportes y abrir el diálogo de movimiento. Se anota el tiempo de commit y cuántos componentes se renderizan.
- Tiempo de clic a skeleton al navegar desde el aside (Performance panel, 5 clics, mediana).

### 2. React Compiler

- `reactCompiler: true` en `next.config.ts` con `babel-plugin-react-compiler` en `devDependencies` (versión exacta, como todo el repo).
- Se revisan los avisos del compilador (reglas `react-hooks` de `eslint-config-next`). Los componentes que el compilador salta por romper las reglas de React se corrigen. Si no tienen arreglo sin cambiar comportamiento, llevan `"use no memo"` con un comentario del porqué.
- Los `useMemo` / `useCallback` que ya existen se quedan: quitarlos es limpieza, no rendimiento.

### 3. Carga diferida

Cada pieza diferida se carga con `next/dynamic` (o `import()` en un hook) desde un archivo `"use client"`. Mientras llega se muestra su skeleton o su forma cerrada, con las mismas medidas para que no haya salto de layout.

- **Gráficas (Recharts).** Cada gráfica de `src/components/charts/*` y de las features (`income-expense-chart`, `category-donut-chart`, `top-categories-chart`, `score-history-chart`, `cash-flow-chart`) se importa desde un `…-lazy.tsx` hermano con `dynamic(..., { loading: () => <…Skeleton /> })`. Se mantiene el render en servidor (sin `ssr: false`): el chunk se separa y la gráfica hidrata por su cuenta.
- **Paleta ⌘K (`cmdk`).** `command-palette.tsx` se carga al primer ⌘K / Ctrl+K o al tocar "Buscar o ejecutar". Se precarga con `pointerenter` / `focus` del botón. El atajo de teclado sigue registrado desde el inicio; solo el diálogo es diferido.
- **Diálogos y Sheets.** El diálogo de movimiento, el de exportar, los `FormDialog` de los accesos rápidos y el contenido de los `DetailSheet` se cargan al abrir. Se precargan con `pointerenter` / `focus` del disparador. El disparador (botón, fila) no cambia.
- **`@dnd-kit/react`.**
  - Las listas reordenables de los Sheets (categorías, entradas de deuda) lo reciben diferido gratis al diferir el Sheet.
  - En la tabla de Movimientos, el proveedor de arrastre se carga con `requestIdleCallback` (con `setTimeout` de respaldo) después de hidratar. Hasta que llega, el asa de arrastre se ve igual pero está `disabled`. Con teclado o lector de pantalla no cambia nada perceptible: el orden manual se alcanza cuando el chunk ya cargó.
- **Calendario (`react-day-picker`).** En `DatePickerField`, el `Calendar` dentro del `Popover` se carga al abrir. Se precarga con `pointerenter` / `focus` del botón de fecha. El botón muestra la fecha igual que hoy.

### 4. Prefetch y navegación

- El aside (`app-sidebar.tsx`), la barra inferior móvil y la paleta usan `<Link>` con el prefetch por defecto de Next con `partialPrefetching`. Se verifica que cada ítem del aside haga prefetch de su shell estático al entrar en vista.
- Cada ruta del dashboard tiene su `loading.tsx` (SPEC 51). Se verifica que el clic muestre el skeleton desde el prefetch, sin esperar al servidor.
- Las rutas que no cumplan se corrigen (por ejemplo, un `loading.tsx` que falta o un dato dinámico fuera de `Suspense` que bloquea el shell).

### 5. Render del dashboard

- Con el Profiler de §1, se corrigen los re-renders que el compilador no resuelva:
  - contextos que cambian de valor en cada render (`QuickActionsContext`, `HideAmountsProvider`, `TutorialProvider`, `ShortcutsPreferenceProvider`);
  - estado alto que re-renderiza toda la tabla de Movimientos al escribir en el buscador.
- Listas largas: si la tabla de Movimientos con 2.000 filas (datos de 56a) tarda más de 200 ms en un commit, se pagina o virtualiza. La decisión y la medición quedan en `docs/rendimiento.md`.

### 6. Documentación

- `docs/rendimiento.md`: tablas "Antes" y "Después" de JS por ruta, analyzer, Profiler, Lighthouse del dashboard y clic a skeleton.
- `docs/ui.md`: patrón `…-lazy.tsx` con skeleton y precarga en `pointerenter` / `focus`.
- `docs/arquitectura.md`: React Compiler activo y cuándo usar `"use no memo"`.
- `CLAUDE.md` (UI y tema): nota del patrón de carga diferida y del compilador.
- `CHANGELOG.md` `[Unreleased]`: entrada en inglés.

**Fuera de alcance (para 56c u otros specs):**

- Base de datos, sesión y consultas del servidor (56a).
- Landing, páginas públicas, videos, fuentes y Speed Insights (56c).
- Caché entre requests de datos de usuario.
- Cambiar de librería de gráficas, de tabla o de arrastre.
- Quitar `useMemo` / `useCallback` existentes.
- Rediseños de UI.

## Modelo de datos

Este spec no introduce estructuras de datos nuevas. Cambia la configuración y aparece un patrón de archivo:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  reactCompiler: true
  // …lo demás igual
}

// src/features/reports/components/income-expense-chart-lazy.tsx
"use client"
export const IncomeExpenseChartLazy = dynamic(
  () => import("./income-expense-chart").then((m) => m.IncomeExpenseChart),
  { loading: () => <IncomeExpenseChartSkeleton /> }
)
```

## Plan de implementación

1. **Línea base del cliente.** Correr `pnpm next analyze`, el Profiler de las tres interacciones y el clic a skeleton sobre `master` (con lo de 56a ya fusionado). Anotar en `docs/rendimiento.md`.
2. **React Compiler.** Agregar `babel-plugin-react-compiler` exacto y `reactCompiler: true`. `pnpm build` pasa. Repasar los avisos de lint y corregirlos o marcarlos con `"use no memo"`.
3. **Gráficas diferidas.** Crear los `…-lazy.tsx` con su skeleton y cambiar los imports de las páginas. Verificar en el analyzer que Recharts sale del chunk inicial de `/dashboard/personal`.
4. **Paleta diferida.** Separar el diálogo de `command-palette.tsx` del registro del atajo. Precarga en el botón. ⌘K abre igual que antes.
5. **Diálogos y Sheets diferidos.** Uno por commit: movimiento, exportar, accesos rápidos y `DetailSheet`. Cada uno con precarga en su disparador.
6. **Calendario diferido.** `DatePickerField` carga `Calendar` al abrir. Probar los 15 usos a mano en escritorio y móvil.
7. **Arrastre diferido.** Tabla de Movimientos con proveedor cargado en idle y asa `disabled` hasta entonces. Reordenar sigue funcionando con ratón, táctil y teclado.
8. **Prefetch y `loading.tsx`.** Revisar aside, barra móvil y paleta. Corregir las rutas que no muestren su skeleton al instante.
9. **Re-renders.** Con el Profiler, estabilizar los valores de contexto y el estado de la tabla que lo necesiten. Paginar o virtualizar la tabla solo si supera los 200 ms.
10. **Medición "Después".** Repetir §1 en un Preview de Vercel y llenar las tablas.
11. **Documentación** (§6).

## Criterios de aceptación

- [x] `next.config.ts` tiene `reactCompiler: true` y `babel-plugin-react-compiler` está en `devDependencies` con versión exacta.
- [x] Cada `"use no memo"` del repo lleva un comentario con el motivo.
- [x] El JS inicial (First Load JS) de `/dashboard/personal` baja al menos un 20 % respecto a la línea base de 56a.
- [ ] Lighthouse móvil de `/dashboard/personal`, `/dashboard/personal/transactions` y `/dashboard/personal/reports`: Performance ≥ 90, LCP ≤ 2,5 s, CLS ≤ 0,1 y TBT ≤ 200 ms. **Pasa a SPEC 57.**
- [x] En el analyzer, `recharts`, `cmdk`, `react-day-picker` y `@dnd-kit/react` no están en el chunk inicial de `/dashboard/personal`.
- [x] Abrir la paleta con ⌘K / Ctrl+K funciona en la primera pulsación, también sin haber pasado el ratón por el botón.
- [x] Cada gráfica, diálogo, Sheet y calendario diferido muestra su skeleton o forma cerrada sin salto de layout (CLS de la ruta ≤ 0,1).
- [ ] Reordenar movimientos funciona con ratón, táctil y teclado después de que la página termina de cargar. **Prueba manual pendiente en el PR.**
- [x] El clic en un ítem del aside muestra el skeleton de la ruta en ≤ 100 ms (mediana de 5).
- [ ] Escribir en el buscador de Movimientos con 2.000 filas no da commits de más de 200 ms en el Profiler. **Pasa a SPEC 57.**
- [ ] Las tres interacciones del Profiler renderizan menos componentes que en la línea base. **Pasa a SPEC 57.**
- [x] `docs/rendimiento.md` tiene las tablas "Antes" y "Después" de este spec.
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm test` y `pnpm build` pasan.

Notas de la verificación (detalle en `docs/rendimiento.md`):

- JS inicial: `/dashboard/personal` baja de 2.003 kB a 1.314 kB (−34 %). `master` reconstruido con el mismo script da exactamente la línea base de 56a.
- Lighthouse: Preview de la rama intercalado con producción (`master`) en la misma ventana. Con la misma CPU, el TBT baja 45 % en `/dashboard/personal` y 35 % en Movimientos, y queda igual en Reportes; el CLS es ≤ 0,002. El Performance sigue en 45–49: lo dominan el TBT restante (render e hidratación en `react-dom`) y el LCP, una cifra en streaming que espera a la hidratación. Ese trabajo no es de bundle y sigue en SPEC 57.
- Profiler: no se midió (no se puede contra el Preview y la línea base de §1 no se tomó). Sus dos criterios y la medición de línea base pasan a SPEC 57. La tabla de Movimientos pagina de 50 en 50, así que nunca pinta 2.000 filas; no se virtualizó.
- Arrastre: verificado con Playwright que el asa se habilita en idle y dnd-kit la engancha (`aria-roledescription`). Falta probar a mano con ratón, táctil y teclado antes de fusionar.
- ⌘K: abre en la primera pulsación sin precarga (~400 ms con la descarga del chunk). Clic a skeleton: mediana 66 ms.
- Diferidos: de los `DetailSheet`, solo Categorías difiere su cuerpo. Los de Deuda, Meta, Gasto fijo e Ingreso fijo pasan a SPEC 57.

## Decisiones

- **Sí:** React Compiler con el plugin de Babel estable. Memoiza los 236 componentes cliente sin tocarlos uno a uno.
- **No:** `experimental.turbopackRustReactCompiler`. Es experimental; el costo extra de build del plugin de Babel es pequeño.
- **No:** `memo()` manual en todos lados. El compilador lo hace mejor y sin ruido en el código.
- **Sí:** `"use no memo"` con comentario como salida para los componentes que el compilador no puede optimizar sin cambiar comportamiento.
- **Sí:** gráficas diferidas con render en servidor. Separan el chunk sin perder el SVG inicial ni mover el layout.
- **No:** `ssr: false` en las gráficas. Dejaría un hueco hasta que llega el JS y empeoraría el LCP de Reportes.
- **Sí:** precarga en `pointerenter` / `focus` del disparador. El usuario no nota la espera al abrir.
- **Sí:** el atajo ⌘K se registra desde el inicio y solo el diálogo es diferido. Si no, la primera pulsación se perdería.
- **Sí:** `@dnd-kit/react` en idle en la tabla de Movimientos, con el asa `disabled` hasta que carga. Nadie reordena en el primer segundo.
- **Sí:** prefetch y `loading.tsx` en este spec. Pesan en la velocidad percibida tanto como el bundle.
- **Sí:** paginar o virtualizar la tabla solo si la medición supera los 200 ms. No se agrega complejidad sin evidencia.
- **Sí:** metas numéricas duras. Sin ellas, "más rápido" no se puede cerrar.
- **No:** quitar los `useMemo` / `useCallback` existentes. No mejora el rendimiento y agranda el diff.
- **Sí (en la implementación):** `lazy()` + `Suspense` en vez de `next/dynamic` para las gráficas. `loading` de `next/dynamic` no recibe las props y el tamaño de varias gráficas depende de ellas (alto por filas, clase por página).
- **Sí (en la implementación):** diferir el formulario dentro del diálogo, no el diálogo. El disparador, el título y la animación no cambian y los usos fuera de los accesos rápidos lo heredan.
- **Sí (en la implementación):** el arrastre de Movimientos se engancha desde un árbol al lado de la tabla. Envolver la tabla en el proveedor al llegar el chunk la remontaría y movería el foco.
- **No (en la implementación):** diferir el cuerpo de los Sheets de Deuda, Meta, Gasto fijo e Ingreso fijo. Su contenido está acoplado al Sheet; pasa a SPEC 57.
- **Sí (en la implementación):** `useEffectEvent` en vez de `eslint-disable` de `react-hooks`. Un `eslint-disable` también deja el componente sin compilar.

## Riesgos

| Riesgo                                                                                | Mitigación                                                                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| El compilador cambia el comportamiento de un componente que rompe las reglas de React | Revisar sus avisos antes de activarlo. `"use no memo"` en los casos dudosos. Probar a mano los flujos principales. |
| Un diálogo diferido tarda en abrir con red lenta                                      | Precarga en `pointerenter` / `focus`. El disparador da respuesta inmediata (estado de carga) si el chunk no llegó. |
| Salto de layout al llegar una pieza diferida                                          | Mismo contenedor y medidas que su skeleton (regla de SPEC 51). Criterio de CLS ≤ 0,1.                              |
| El asa de arrastre `disabled` confunde al usuario                                     | Se ve igual y el chunk llega en idle, antes de que se use. Se verifica en móvil con red 4G simulada.               |
| La virtualización rompe atajos, foco o el menú contextual de fila                     | Solo si la medición lo exige. Si se hace, se prueban `RowContextMenu`, el teclado y el lector de pantalla.         |

## Lo que **no** entra en este spec

- Base de datos, sesión y consultas del servidor (SPEC 56a).
- Landing, públicas, videos y Speed Insights (SPEC 56c).
- Caché entre requests de datos de usuario.
- Cambiar de librerías o rediseñar pantallas.

Cada uno, si llega, va en su propio spec.
