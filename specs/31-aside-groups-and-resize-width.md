# SPEC 31 — Aside agrupado y ancho ajustable

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 20, SPEC 27, SPEC 30
> **Fecha:** 2026-11-06
> **Objetivo:** Que el aside del dashboard agrupe sus secciones en "Día a día", "Tu plan" y "Entiende tu dinero" (con variante en Empresa) y que en escritorio su ancho se ajuste arrastrando el borde entre 240 y 360 px.

## Por qué existe este spec

Hoy el aside es una lista plana de diez ítems en Personal. Mezcla pantallas donde el usuario define cosas (cuentas, gastos e ingresos fijos, presupuestos, metas, deudas) con pantallas que sobre todo muestran información (resumen, movimientos, reportes, recomendaciones). El usuario no distingue dónde tiene que entrar a configurar y dónde solo consulta.

Además el aside mide 256 px fijos. Con nombres de empresa largos o ítems truncados no hay forma de darle más aire.

## Alcance

**Entra:**

- **Grupos en Personal**, en este orden y con estos ítems:
  1. **Día a día**: Resumen, Movimientos.
  2. **Tu plan**: Cuentas, Ingresos fijos, Gastos fijos, Presupuestos, Metas, Deudas.
  3. **Entiende tu dinero**: Reportes, Recomendaciones.
  - Dentro de **Tu plan** el orden sigue el flujo del dinero: dónde está, qué entra, qué sale, cómo se planea, qué se ahorra, qué se debe. **Ingresos fijos** pasa antes de **Gastos fijos**.
- **Grupos en Empresa**, mismo criterio con títulos propios:
  1. **Día a día**: Resumen, Movimientos.
  2. **Tu operación**: Cuentas, Ajustes.
  3. **Entiende tu negocio**: Flujo de caja, Reportes, Recomendaciones.
- **Marca visual:** cada grupo lleva `SidebarGroupLabel` como título y más espacio entre grupos que entre ítems. Sin líneas divisorias ni bordes.
  - Con una sola empresa, el nombre de la empresa sigue pintándose arriba de los grupos, como hoy.
- **Accesibilidad de los grupos:** cada grupo es una `<ul>` con `aria-labelledby` apuntando a su título. El `<nav aria-label="Secciones del espacio">` envuelve los tres.
- **Skeleton** (`app-sidebar-skeleton.tsx`) con tres bloques: un placeholder de título y sus filas, con la cantidad de ítems de Personal (2, 6, 2).
- **Drawer móvil:** usa el mismo `AppSidebar`, así que muestra los grupos. Su ancho (`w-72`) no cambia y no tiene agarradera.
- **Ancho ajustable (solo escritorio, `≥ 768 px`):**
  - agarradera en el borde derecho del aside, a todo el alto;
  - mínimo **240 px**, máximo **360 px**, por defecto **256 px** (el ancho actual);
  - arrastrar con puntero cambia el ancho en vivo, sin la transición de `width`;
  - doble clic en la agarradera vuelve a 256 px;
  - teclado: con foco en la agarradera, `←` / `→` restan o suman 16 px, `Home` va al mínimo y `End` al máximo;
  - la agarradera es `role="separator"` con `aria-orientation="vertical"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow` y `aria-label="Cambiar el ancho del menú"`;
  - en reposo es invisible; con hover, arrastre o foco muestra una línea fina y el cursor `col-resize`. Con foco cumple 3:1 (anillo `--focus`);
  - con el aside cerrado (`open = false`, atajo o `SidebarTrigger`) la agarradera no existe y el ancho guardado se recupera al abrir.
- **Persistencia del ancho** en la cookie `tesoro-sidebar-width` (px enteros, `path=/`, `max-age` de un año, `SameSite=Lax`). Se escribe al soltar el arrastre o tras cada tecla. Por navegador; no va a la base de datos.
  - `DashboardSidebar` (ya dentro de un `Suspense` en `app/dashboard/layout.tsx`) lee la cookie con `cookies()` y pasa el ancho a `AppSidebar`. El aside sale con el ancho correcto desde el primer render.
  - Un valor ausente o no numérico se trata como 256; uno fuera de rango se ajusta al rango (240–360), tanto al leer como al escribir.
- **Tour (SPEC 27):** el paso `aside-sections` de `src/config/tutorials.ts` cambia su texto para explicar los grupos: en **Tu plan** se define todo lo que Tesoro usa para calcular; **Día a día** y **Entiende tu dinero** son para consultar. Sin pasos nuevos.
- **Documentación:** `docs/ui.md` (grupos del aside y ancho ajustable), `CLAUDE.md` si cambia la descripción del aside, y `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Grupos plegables o que recuerden su estado.
- Subtítulos o descripciones bajo cada título de grupo.
- Modo de aside colapsado a solo íconos.
- Ancho ajustable del Drawer móvil.
- Guardar el ancho en el perfil de Supabase o sincronizarlo entre dispositivos.
- Cambiar los destinos de la barra inferior del teléfono (SPEC 20).
- Cambiar la hoja **+** o los accesos rápidos del header.
- Reorganizar o renombrar las páginas mismas, o mostrar en ellas avisos de "configura aquí".
- Pasos nuevos del tour por cada grupo.

## Modelo de datos

Este spec no toca la base de datos. Cambia la forma de `SITE.navigation` y agrega una cookie.

```ts
// src/config/site.ts
navigation: {
  personal: [
    {
      label: "Día a día",
      items: [
        { name: "Resumen", href: "/dashboard/personal", icon: "LayoutDashboard" },
        { name: "Movimientos", href: "/dashboard/personal/transactions", icon: "ArrowLeftRight" }
      ]
    },
    { label: "Tu plan", items: [/* Cuentas, Ingresos fijos, Gastos fijos, Presupuestos, Metas, Deudas */] },
    { label: "Entiende tu dinero", items: [/* Reportes, Recomendaciones */] }
  ],
  business: [
    { label: "Día a día", items: [/* { name, segment, icon } Resumen, Movimientos */] },
    { label: "Tu operación", items: [/* Cuentas, Ajustes */] },
    { label: "Entiende tu negocio", items: [/* Flujo de caja, Reportes, Recomendaciones */] }
  ],
  mobile: { /* sin cambios */ }
}
```

```ts
// src/components/dashboard/nav.ts
export type NavIcon =
  | (typeof SITE.navigation.personal)[number]["items"][number]["icon"]
  | (typeof SITE.navigation.business)[number]["items"][number]["icon"]

/** Lista plana para la barra inferior, el título del header y la landing */
export function flattenNav<T>(groups: readonly { items: readonly T[] }[]): T[]
```

```ts
// src/components/dashboard/sidebar/width.ts
export const SIDEBAR_WIDTH = {
  min: 240,
  max: 360,
  default: 256,
  step: 16
} as const
export const SIDEBAR_WIDTH_COOKIE = "tesoro-sidebar-width"
/** Valor de cookie → px dentro del rango; inválido → default */
export function parseSidebarWidth(value: string | undefined): number
```

- `Sidebar` recibe `width` (px) y lo aplica con la variable CSS `--sidebar-width` en el contenedor y en el panel interno (hoy `w-64`). Cerrado sigue en `w-0`.
- La agarradera es un componente nuevo `SidebarResizeHandle` en `src/components/dashboard/sidebar/sidebar.tsx`, exportado desde `index.ts`.

## Plan de implementación

1. **Datos agrupados.** Pasar `SITE.navigation.personal` y `business` a grupos con el orden nuevo. Agregar `flattenNav` y el tipo `NavIcon` en `nav.ts`. Adaptar los consumidores de la lista plana: `bottom-nav.tsx`, `dashboard-title.tsx` y `src/features/landing/components/workspaces-section.tsx`. El aside sigue pintando la lista plana con `flattenNav`. Verificar: `pnpm check` y la barra inferior igual que antes.
2. **Aside agrupado.** `app-sidebar.tsx` pinta un título y una `<ul>` por grupo con `aria-labelledby`, más espacio entre grupos. Revisar el nombre de empresa única arriba de los grupos.
3. **Skeleton.** `app-sidebar-skeleton.tsx` con tres bloques (título + 2, 6 y 2 filas).
4. **Ancho por props.** `width.ts` con constantes y `parseSidebarWidth`. `Sidebar` recibe `width` y usa `--sidebar-width`. `DashboardSidebar` lee la cookie y la pasa por `AppSidebar`. Sin agarradera todavía; con una cookie puesta a mano el aside sale con ese ancho.
5. **Arrastre.** `SidebarResizeHandle` con eventos de puntero (`setPointerCapture`), sin transición durante el arrastre, doble clic para 256 y escritura de la cookie al soltar. Solo en escritorio y con el aside abierto.
6. **Teclado y ARIA.** Flechas, `Home` / `End`, atributos de `separator` y estilos de hover/foco con tokens. Comprobar contraste AA del foco en claro y oscuro.
7. **Tour.** Nuevo texto del paso `aside-sections` en `src/config/tutorials.ts`.
8. **Docs y CHANGELOG.** `docs/ui.md`, `CLAUDE.md` si aplica, `CHANGELOG.md` en `[Unreleased]`.
9. **Verificación.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [ ] El aside de Personal muestra los títulos **Día a día**, **Tu plan** y **Entiende tu dinero**, en ese orden, cada uno con exactamente sus ítems del alcance.
- [ ] En **Tu plan**, **Ingresos fijos** aparece antes de **Gastos fijos**.
- [ ] El aside de una empresa muestra **Día a día** (Resumen, Movimientos), **Tu operación** (Cuentas, Ajustes) y **Entiende tu negocio** (Flujo de caja, Reportes, Recomendaciones).
- [ ] Entre grupos no hay líneas ni bordes.
- [ ] Un lector de pantalla anuncia el título del grupo al entrar en su lista.
- [ ] El ítem activo se marca igual que hoy en las tres agrupaciones; el Resumen solo con coincidencia exacta.
- [ ] El skeleton del aside muestra tres bloques con título.
- [ ] A 390 px el Drawer muestra los grupos y no tiene agarradera; la barra inferior tiene los mismos cuatro destinos que antes.
- [ ] En escritorio, arrastrar el borde derecho cambia el ancho y no baja de 240 px ni pasa de 360 px.
- [ ] Doble clic en la agarradera deja el aside en 256 px.
- [ ] Con foco en la agarradera, `→` suma 16 px, `←` resta 16 px, `Home` lleva a 240 px y `End` a 360 px.
- [ ] La agarradera expone `role="separator"` y `aria-valuenow` con el ancho actual.
- [ ] Tras recargar la página, el aside sale con el último ancho elegido sin salto visible después de cargar.
- [ ] Con la cookie `tesoro-sidebar-width=9999` o `=abc`, el aside sale en 360 px o 256 px respectivamente sin errores.
- [ ] Cerrar el aside (`SidebarTrigger` o atajo) y volver a abrirlo recupera el ancho elegido.
- [ ] El paso `aside-sections` del tour describe los tres grupos.
- [ ] El foco de la agarradera da 3:1 y los títulos de grupo dan 4.5:1, en claro y oscuro.
- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

## Decisiones

- **Sí:** tres grupos en vez de dos. Separa el registro diario (Resumen, Movimientos) del análisis (Reportes, Recomendaciones) y deja a **Tu plan** en medio, como el lugar donde se configura.
- **No:** dos grupos "Consulta / Configura". Literal al pedido, pero junta Movimientos con Reportes y aleja el Resumen del flujo diario.
- **Sí:** títulos cálidos ("Día a día", "Tu plan", "Entiende tu dinero"). Explican el propósito mejor que "Configuración" o "Análisis". **No:** verbos sueltos ("Configura", "Analiza") ni sustantivos neutros.
- **Sí:** variante en Empresa ("Tu operación", "Entiende tu negocio"). "Tu plan" y "tu dinero" suenan personales para una empresa.
- **Sí:** en Empresa, Ajustes va en **Tu operación** y Flujo de caja en **Entiende tu negocio**. Ajustes se configura; Flujo de caja se consulta.
- **Sí:** título + espacio. Sigue el estilo sin bordes del proyecto. **No:** líneas divisorias, subtítulos ni grupos plegables (más ruido o más estado que mantener).
- **Sí:** orden de **Tu plan** por flujo del dinero (Cuentas, Ingresos, Gastos, Presupuestos, Metas, Deudas). **No:** el orden actual, que dejaba Ingresos fijos después de Gastos fijos por cómo se agregó en SPEC 30.
- **Sí:** grupos como arrays en `SITE.navigation`, con `flattenNav` para los consumidores planos. Una sola fuente de verdad y el orden de grupos explícito. **No:** un campo `group` por ítem (el orden de los grupos quedaría implícito).
- **Sí:** arrastrar el borde, 240–360 px. Libertad acotada sin romper el layout. **No:** dos tamaños con botón (poca libertad) ni 200–400 px (por debajo de 240 se truncan "Entiende tu dinero" y "Recomendaciones").
- **Sí:** cookie para el ancho. El servidor la lee y el primer render sale con el ancho correcto. **No:** localStorage (salto de ancho al hidratar) ni perfil en Supabase (migración para una preferencia visual).
- **Sí:** la cookie se lee en `DashboardSidebar`, que ya es dinámico y está en un `Suspense`. No vuelve dinámico nada que hoy no lo sea.
- **Sí:** barra inferior del teléfono y Drawer sin cambios de destinos ni de ancho. Lo móvil ya se ajustó en SPEC 18 y SPEC 20.
- **Sí:** el tour solo cambia el texto del paso existente. **No:** un paso por grupo (alarga el tour).

## Riesgos

| Riesgo                                                                          | Mitigación                                                                                            |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Cambiar la forma de `SITE.navigation` rompe consumidores de la lista plana      | Paso 1 adapta todos con `flattenNav` antes de tocar el aside; `pnpm check` detecta los que falten.    |
| Arrastrar sobre el contenido selecciona texto o dispara hovers                  | `setPointerCapture` en la agarradera y `user-select: none` en el body solo mientras dura el arrastre. |
| La transición de `width` hace que el arrastre se sienta con retraso             | La transición se quita mientras se arrastra y vuelve al soltar; sigue activa para abrir y cerrar.     |
| El skeleton (256 px) no coincide con un ancho guardado distinto                 | Es solo mientras carga la sesión; se acepta. El aside real sale con el ancho de la cookie.            |
| El paso `aside-sections` del tour apunta a un elemento que cambió de estructura | `data-tour="aside-sections"` se mantiene en el `<nav>` que envuelve los tres grupos.                  |

## Qué **no** entra en este spec

- Grupos plegables, subtítulos de grupo o aside de solo íconos.
- Ancho ajustable en el Drawer móvil o guardado en Supabase.
- Cambios en la barra inferior, la hoja **+** o los accesos rápidos.
- Cambios en las páginas mismas o pasos nuevos del tour.

Cada uno, si llega, va en su propio spec.
