# SPEC 13 — Migración completa de la UI a HeroUI

> **Estado:** Implementado
> **Depende de:** SPEC 12
> **Fecha:** 2026-10-31
> **Objetivo:** Que toda la interfaz de Tesoro use HeroUI v3 en lugar de shadcn/ui, con neutros negros y grises azulados y un primario por espacio (emerald en Personal, naranja en Empresa).

## Por qué existe este spec

Todas las pantallas existen (SPEC 12) y usan shadcn/ui sobre Radix.
Unos 140 archivos importan `@/components/ui/*`.
El cambio es solo de piel: misma funcionalidad, mismas rutas, mismos datos.
Se hace antes del rediseño de flujos (SPEC 14) y de la experiencia móvil (SPEC 15), para que esos specs trabajen ya sobre HeroUI.

## Alcance

**Entra:**

- Instalar HeroUI **v3** (`@heroui/react` y `@heroui/styles`, `3.2.7` o la última estable al arrancar, versiones exactas).
  - v3 no usa Provider: no se agrega `HeroUIProvider`.
  - Se sigue la guía oficial de Next.js de HeroUI v3. Los nombres de tokens, componentes y props se confirman contra la doc vigente antes de escribir código.
- `src/styles/globals.css`:
  - `@import "@heroui/styles"` justo después de `@import "tailwindcss"`;
  - se quitan `tw-animate-css`, `shadcn/tailwind.css` y los tokens de shadcn;
  - el modo oscuro sigue con `next-themes` y la clase `.dark` (o el selector que pida la doc de v3).
- Tema propio con tokens CSS de HeroUI v3:
  - neutros negros y grises azulados como los de heroui.com, en claro y oscuro (fondo, superficie, bordes, texto, texto atenuado);
  - **primario neutro por defecto** (estilo heroui.com: casi negro en claro, casi blanco en oscuro);
  - `[data-workspace="personal"]` cambia el primario a **emerald** (mismo tono de marca que el logo);
  - `[data-workspace="business"]` cambia el primario a **naranja** (familia orange de Tailwind);
  - el cambio de primario es solo por ese atributo, nunca por props en los componentes;
  - `success`, `warning` y `danger` alineados al tema nuevo;
  - `--chart-*` reemplazados por una paleta neutra de grises azulados.
- Colores semánticos de dinero **re-afinados** al tema nuevo, conservando su familia:
  - `--income` verde, `--expense` rojo/rose, `--balance` azul;
  - los 12 `--category-*` conservan sus nombres (las claves de `CATEGORY_COLORS` se guardan en BD), solo cambian los valores;
  - tonos distintos en claro y oscuro, AA contra la superficie donde se pintan.
- Atributo `data-workspace` decidido por la ruta:
  - wrapper cliente en `app/dashboard/layout.tsx` que lee `usePathname` y pone el atributo en el contenedor raíz del dashboard (sidebar, header y contenido cambian juntos);
  - `/dashboard/personal/**` → `personal`;
  - `/dashboard/business/[id]/**` → `business`;
  - `/dashboard/account/**`, `/dashboard/business` (estado vacío) y cualquier otra → sin atributo (neutro);
  - `/dashboard` sin sufijo sigue su comportamiento actual; si renderiza Personal, lleva `personal`.
- Fuera del dashboard (landing, auth, legales, `/account-deleted`) todo es neutro.
  - El logo, isotipo, favicon y la imagen OG **siguen en emerald**. Los assets de SPEC 12 no se regeneran.
- Reemplazar cada componente de `src/components/ui/` por HeroUI, importado **directo de `@heroui/react`**, sin wrappers:
  - landing, header y footer públicos, menú móvil, toggle de tema;
  - auth (`/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/check-email`);
  - legales;
  - shell del dashboard: sidebar, header, selector Personal / Empresa (`workspace-tabs.tsx`), menú de usuario, alta rápida;
  - Personal: movimientos, categorías, cuentas y transferencias, presupuestos, recurrentes, metas, deudas y tarjetas, reportes, score y recomendaciones, importadores;
  - Empresa: espacios, operaciones, flujo de caja, reportes y score;
  - cuenta y perfil.
- **Todo con HeroUI, sin excepción**:
  - toasts con el toast de HeroUI (se quita `sonner`);
  - fechas con el DatePicker/Calendar de HeroUI (se quita `react-day-picker`);
  - menús, diálogos, alert dialogs, popovers, selects, tabs, tablas, paginación, toggles, tooltips, skeletons y avatares con sus equivalentes HeroUI;
  - lo que HeroUI no trae como componente (sidebar del dashboard, contenedor de gráficas) se arma **solo con primitivas de HeroUI** y tokens del tema, como componente propio en `src/components/`.
- Formularios: se mantienen `useActionState` + Zod y las server actions tal cual. Cambian solo los campos y los mensajes de error.
- Gráficas: se mantiene Recharts. Contenedor, tooltip y leyenda propios con superficie y tipografía HeroUI, colores desde los tokens del tema.
- `SITE.seo.themeColor` actualizado a los fondos nuevos de claro y oscuro.
- Quitar `shadcn`, `components.json`, `src/components/ui/` y los paquetes huérfanos (candidatos: `radix-ui`, `class-variance-authority`, `tw-animate-css`, `sonner`, `react-day-picker`, `cn`). Cada uno se quita solo si `grep` confirma cero usos.
- Actualizar `README.md` (stack), `CLAUDE.md` (UI y tema), `docs/producto.md` (sección "Marca": primarios por espacio) y `CHANGELOG.md` en `[Unreleased]`.
- Contraste AA (4.5:1 texto normal, 3:1 texto grande y bordes de foco) en claro y oscuro, con el primario neutro, emerald y naranja.

**Fuera de alcance (para specs futuros):**

- Rediseño de flujos o de la información de cada pantalla (SPEC 14).
- Experiencia móvil nueva (SPEC 15). El sidebar móvil conserva el comportamiento actual (panel deslizable).
- Cambiar Recharts por otra librería.
- Cambiar el logo, el isotipo o regenerar los assets de marca.
- Cambios de lógica, rutas, esquema, queries o actions.
- Wrappers propios sobre HeroUI en `src/components/ui/`.
- Tests visuales o de regresión automatizados.

## Modelo de datos

Sin tablas ni migraciones. Las claves de `CATEGORY_COLORS` (`emerald`, `teal`, `lime`, `amber`, `orange`, `rose`, `pink`, `violet`, `indigo`, `blue`, `sky`, `slate`) no cambian.

Tokens de tema en `src/styles/globals.css`. Los nombres exactos son los de HeroUI v3 (p. ej. su token de acento/primario). Forma:

```css
:root {
  /* neutros grises azulados + primario neutro */
}
.dark {
  /* neutros oscuros + primario neutro invertido */
}
[data-workspace="personal"] {
  /* primario emerald (claro) */
}
.dark [data-workspace="personal"] {
  /* primario emerald (oscuro) */
}
[data-workspace="business"] {
  /* primario naranja (claro) */
}
.dark [data-workspace="business"] {
  /* primario naranja (oscuro) */
}
```

- Se conservan `--income`, `--expense`, `--balance`, `--category-*` y `--chart-1..5` como nombres propios del proyecto.
- El texto sobre el primario (`*-foreground`) se elige por contraste: puede ser oscuro sobre emerald/naranja si el blanco no da AA.

Helper puro para decidir el espacio por ruta:

```ts
// src/libs/workspace-theme.ts
export type WorkspaceTheme = "personal" | "business" | null

export function getWorkspaceTheme(pathname: string): WorkspaceTheme
```

Archivos nuevos:

```text
src/libs/workspace-theme.ts
src/components/dashboard/workspace-theme-root.tsx   # wrapper cliente con data-workspace
src/components/dashboard/sidebar/                    # sidebar propio con primitivas HeroUI
src/components/charts/chart-container.tsx
src/components/charts/chart-tooltip.tsx
src/components/charts/chart-legend.tsx
```

Archivos que desaparecen: `components.json` y todo `src/components/ui/`.

## Plan de implementación

Una sola rama y un PR. Cada paso es un commit con `pnpm check`, `pnpm eslint` y `pnpm build` en verde. Mientras dura la rama conviven shadcn y HeroUI. Las pantallas aún no migradas pueden verse con colores mezclados, pero funcionan.

1. **Instalar HeroUI.** Agregar `@heroui/react` y `@heroui/styles` exactos. Leer la guía de Next.js y la de theming de v3. Importar `@heroui/styles` tras `tailwindcss`. Un `Button` de HeroUI se ve bien en `/` en claro y oscuro.
2. **Tema neutro.** Definir neutros grises azulados y primario neutro en `:root` y `.dark`. Mapear temporalmente los tokens de shadcn a los nuevos para que las pantallas sin migrar sigan legibles. Actualizar `SITE.seo.themeColor`.
3. **Primarios por espacio.** Bloques `[data-workspace="personal|business"]` en claro y oscuro. `getWorkspaceTheme` y `WorkspaceThemeRoot` en el layout del dashboard. Verificar el atributo en el DOM en `/dashboard/personal`, `/dashboard/business/<id>`, `/dashboard/account` y `/dashboard/business`.
4. **Semánticos y gráficas.** Re-afinar `--income`, `--expense`, `--balance`, `--category-*`, `success`, `warning`, `danger` y `--chart-*`. Medir contraste AA de cada par contra su superficie.
5. **Toasts.** Toaster de HeroUI en `app/layout.tsx` y las ~34 llamadas de `sonner` migradas. Quitar `sonner`.
6. **Gráficas.** `src/components/charts/*` con Recharts y superficie HeroUI. Migrar los 6 usos de `@/components/ui/chart`.
7. **Público y auth.** Landing, header, footer, menú móvil, toggle de tema, legales, auth y `/account-deleted`.
8. **Shell del dashboard.** Sidebar propio con primitivas HeroUI, header, `workspace-tabs.tsx`, `user-menu.tsx`, alta rápida y skeleton del sidebar.
9. **Movimientos y categorías.** Listado, tabla, paginación, filtros, formularios y diálogos.
10. **Cuentas y transferencias.**
11. **Presupuestos y recurrentes.**
12. **Metas.**
13. **Deudas y tarjetas.**
14. **Reportes, score y recomendaciones de Personal.**
15. **Importadores** (movimientos, recurrentes, deudas y metas). Fechas con el DatePicker de HeroUI desde aquí o desde el primer paso que lo use. Quitar `react-day-picker` cuando no quede ninguno.
16. **Empresa.** Estado vacío, espacios, operaciones, flujo de caja, reportes y score.
17. **Cuenta y perfil.**
18. **Limpieza.** Borrar `src/components/ui/` y `components.json`. Quitar el mapeo temporal de tokens de shadcn. Quitar paquetes huérfanos tras confirmar con `grep`. `pnpm install` deja el lockfile sincronizado.
19. **Documentación.** `README.md`, `CLAUDE.md`, `docs/producto.md` y `CHANGELOG.md`.

## Criterios de aceptación

- [ ] `grep -r "@/components/ui/" src app` no devuelve nada.
- [ ] No existen `src/components/ui/` ni `components.json`.
- [ ] `package.json` no contiene `shadcn`, `radix-ui`, `class-variance-authority`, `tw-animate-css`, `sonner` ni `react-day-picker`.
- [ ] `package.json` contiene `@heroui/react` y `@heroui/styles` con versión exacta (sin `^` ni `~`).
- [ ] `globals.css` importa `@heroui/styles` en la línea siguiente a `@import "tailwindcss"`.
- [ ] Ningún componente recibe un prop de color para fijar el primario del espacio: `grep` de `data-workspace` solo aparece en `globals.css` y `workspace-theme-root.tsx`.
- [ ] `/dashboard/personal/**` renderiza con `data-workspace="personal"` y botones primarios emerald.
- [ ] `/dashboard/business/<id>/**` renderiza con `data-workspace="business"` y botones primarios naranja.
- [ ] `/dashboard/account`, `/dashboard/business` (sin empresa), landing, auth y legales no tienen `data-workspace` y su primario es neutro.
- [ ] El logo y el favicon siguen en emerald en todas las páginas.
- [ ] El ítem activo del sidebar y el selector Personal / Empresa usan el primario del espacio actual.
- [ ] Cambiar entre claro y oscuro funciona en todas las pantallas sin parpadeo de tema al cargar.
- [ ] Cada par texto/fondo del tema (texto normal, atenuado, primario y su foreground, success, warning, danger, income, expense, balance) da ≥ 4.5:1 en claro y oscuro, con el primario neutro, emerald y naranja. Los valores medidos quedan anotados en el PR.
- [ ] Todos los formularios siguen enviando con `useActionState` y muestran los errores de Zod en su campo.
- [ ] Todas las acciones que antes mostraban un toast lo siguen mostrando, con el toast de HeroUI.
- [ ] Los campos de fecha se eligen con el DatePicker de HeroUI y guardan el mismo valor que antes.
- [ ] Diálogos y menús se abren y cierran con teclado (Enter/Espacio, Esc) y devuelven el foco al disparador.
- [ ] Las gráficas de Personal y Empresa usan los colores del tema nuevo y su tooltip y leyenda tienen superficie HeroUI.
- [ ] Ninguna ruta, query, action ni migración cambió (`git diff master -- supabase/ src/**/actions.ts src/**/queries.ts` vacío salvo imports).
- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan con `pnpm install --frozen-lockfile`.
- [ ] Lighthouse móvil Accesibilidad ≥ 90 en `/`, `/sign-in` y `/dashboard/personal`.
- [ ] `README.md`, `CLAUDE.md`, `docs/producto.md` y `CHANGELOG.md` (`[Unreleased]`) describen HeroUI y los primarios por espacio.

## Decisiones

- **Sí:** HeroUI v3 (3.2.7, última estable). Sin Provider, estilos por CSS, encaja con Tailwind 4.
- **No:** HeroUI v2 con `HeroUIProvider`. Versión anterior, requiere plugin de Tailwind y Provider cliente en la raíz.
- **Sí:** primario neutro fuera de los espacios. La landing, auth y cuenta se ven como heroui.com; el color identifica el espacio en el que estás.
- **No:** verde por defecto fuera de los espacios. Diluye la señal "verde = Personal".
- **Sí:** emerald de marca para Personal. Coherente con el logo y `--income` de SPEC 12.
- **No:** usar success/warning de HeroUI como primarios. Se confundirían primario y estados.
- **Sí:** logo y assets siguen emerald aunque la UI sea neutra. La marca no cambia en este spec.
- **Sí:** `data-workspace` decidido por ruta en un wrapper del layout del dashboard. Sidebar, header y contenido comparten el mismo primario.
- **No:** atributo solo en los layouts de `personal/` y `business/[id]/`. El sidebar vive arriba en el árbol y quedaría neutro.
- **Sí:** importar directo de `@heroui/react`. Menos indirección y la doc de HeroUI aplica tal cual.
- **No:** wrappers finos en `src/components/ui/`. Repetirían el patrón shadcn sin beneficio claro.
- **Sí:** todo con HeroUI, sin excepción. Se quitan `sonner` y `react-day-picker`; lo que falte se arma con primitivas HeroUI.
- **No:** conservar librerías propias cuando HeroUI no cubra el caso. Dos sistemas de estilo a la vez.
- **Sí:** re-afinar income/expense/balance y categorías al tema nuevo, conservando familia de color y claves.
- **No:** renombrar claves de `CATEGORY_COLORS`. Están guardadas en BD.
- **Sí:** una rama, un PR, commits por área. Master nunca mezcla dos librerías.
- **No:** varios PR por área. Más revisión y master con UI mixta por semanas.
- **Sí:** Recharts se queda. HeroUI no trae gráficas.

## Riesgos

| Riesgo                                                                                      | Mitigación                                                                                                                                |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens de shadcn y HeroUI chocan (`--accent`, `--border`, `--background`) mientras conviven | Paso 2 mapea los tokens de shadcn a los nuevos de forma temporal. El paso 18 lo quita.                                                    |
| HeroUI v3 no trae DatePicker, Toast o algún componente usado                                | Se verifica en el paso 1 contra la doc. Si falta y no se puede armar con primitivas, se detiene y se actualiza este spec antes de seguir. |
| Blanco sobre emerald o naranja no da AA                                                     | El foreground del primario se elige por contraste medido; puede ser texto oscuro.                                                         |
| `usePathname` en el wrapper fuerza render cliente o rompe PPR con `cacheComponents`         | El wrapper es una isla cliente fina que solo pone el atributo; `pnpm build` debe seguir marcando las rutas como antes.                    |
| Parpadeo del primario al navegar entre espacios                                             | El atributo se calcula en el render (también en SSR), no en un efecto.                                                                    |
| Regresión de accesibilidad en componentes armados a mano (sidebar)                          | Se arman con primitivas HeroUI (React Aria). Criterio de teclado y foco en la checklist.                                                  |
| Diff enorme difícil de revisar                                                              | Un commit por área con build verde; el PR lista las áreas en orden.                                                                       |

## Lo que **no** entra en este spec

- Rediseño de flujos o información (SPEC 14).
- Experiencia móvil nueva (SPEC 15).
- Otra librería de gráficas.
- Cambios de logo o assets de marca.
- Cambios de lógica, rutas, datos o esquema.
- Wrappers propios sobre HeroUI.
- Tests visuales automatizados.

Cada uno, si llega, va en su propio spec.
