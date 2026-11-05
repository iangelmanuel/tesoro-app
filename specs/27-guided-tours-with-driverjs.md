# SPEC 27 — Tutoriales guiados por sección con Driver.js

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 15, SPEC 20, SPEC 22, SPEC 23
> **Fecha:** 2026-11-04
> **Objetivo:** Que cada una de las 9 secciones de Personal tenga un tutorial paso a paso con Driver.js que arranca solo hasta que el usuario lo termina, guardado en la base de datos, y que se pueda repetir desde el header o desde Cuenta.

## Por qué existe este spec

Tesoro tiene muchas funciones por sección (filtros, verificar, traspasos, Sheets de detalle, accesos rápidos) que el usuario nuevo no descubre. Un recorrido guiado por sección enseña qué se puede hacer sin documentación aparte.

Es el tercero de cuatro specs que salen del mismo pedido (ver SPEC 25).

## Alcance

**Entra:**

- **Dependencia:** `driver.js` con versión exacta (sin `^`), cargada con `import()` dinámico solo cuando un tutorial arranca, para no pesar en la carga inicial. Su CSS se importa en el mismo módulo cliente y se tematiza con los tokens de `globals.css` (`--overlay`, `--accent`, `--muted`, radios del proyecto), en claro y oscuro.
- **Las 9 secciones de Personal**, con su clave estable:

  | Sección         | Clave             | Ruta                                  |
  | --------------- | ----------------- | ------------------------------------- |
  | Resumen         | `summary`         | `/dashboard/personal`                 |
  | Movimientos     | `transactions`    | `/dashboard/personal/transactions`    |
  | Cuentas         | `accounts`        | `/dashboard/personal/accounts`        |
  | Gastos fijos    | `recurring`       | `/dashboard/personal/recurring`       |
  | Presupuestos    | `budgets`         | `/dashboard/personal/budgets`         |
  | Metas           | `goals`           | `/dashboard/personal/goals`           |
  | Deudas          | `debts`           | `/dashboard/personal/debts`           |
  | Reportes        | `reports`         | `/dashboard/personal/reports`         |
  | Recomendaciones | `recommendations` | `/dashboard/personal/recommendations` |

- **Pasos:** definidos en `src/config/tutorials.ts`, uno por sección, con título y descripción en español (voz de `PRODUCT.md`). Cada paso apunta a un atributo `data-tour="<sección>-<elemento>"` en el componente, nunca a clases CSS.
  - Cubren lo que el usuario puede hacer en la sección: accesos rápidos del header, menú Más, ojo de cifras, filtros, acciones de fila, Sheets de detalle, tabs, etc.
  - Variante móvil (`< 768 px`): pasos propios para barra inferior, hoja de acciones rápidas y filtros en hoja.
  - Si el elemento de un paso no existe en pantalla (por ejemplo, la lista está vacía), el paso se omite y el recorrido sigue.
- **Arranque automático:**
  - Al entrar a una sección cuyo tutorial no está completado, el recorrido arranca solo tras el primer render (sin bloquear la carga).
  - **Terminar** (último paso) lo marca completado y no vuelve a arrancar solo.
  - **Cerrar a medias** (X, Escape o clic fuera) no lo marca: vuelve a arrancar en la próxima visita a esa sección.
  - No arranca si hay un diálogo o hoja abierta (por ejemplo, la hoja de acciones rápidas que se autoabre en móvil, SPEC 15); espera a que se cierre.
- **Repetir el tutorial:**
  - **Botón `?` en el header**, junto al ojo de cifras (`aria-label="Ver tutorial de esta sección"`, `isIconOnly`, 44 px en móvil). Arranca el tutorial de la sección actual aunque esté completado. Solo aparece en las 9 secciones.
  - **Cuenta › Preferencias**: tarjeta **Tutoriales** con la lista de las 9 secciones, su estado (Completado / Pendiente) y **Ver de nuevo** (navega a la sección y lo arranca). Además, **Reiniciar todos**, que borra el progreso para que vuelvan a arrancar solos.
- **Accesibilidad:** foco atrapado en el popover del paso, botones **Anterior / Siguiente / Terminar** en español, Escape cierra, contador "Paso 2 de 6". Con `prefers-reduced-motion`, sin animación (`animate: false`).
- **Progreso en la base de datos** (ver Modelo de datos), leído en el layout del dashboard y entregado por contexto, como `hide_amounts` en SPEC 22, para decidir el arranque sin parpadeo ni consulta extra por página.
- Documentar en `docs/producto.md` (secciones y comportamiento) y `docs/ui.md` (cómo agregar pasos y `data-tour`); anotar en `[Unreleased]` del `CHANGELOG.md` (en inglés).

**Fuera de alcance (para otros specs):**

- Tutoriales de Empresa (la tabla ya acepta nuevas claves; se agregan en otro spec).
- Tutoriales de Cuenta, Importar o el onboarding de registro.
- Guardar en qué paso quedó el usuario para retomarlo.
- Analítica de abandono por paso.

## Modelo de datos

**Propuesta (el usuario pidió la mejor forma):** una fila por sección **completada**, creada al terminar. La ausencia de fila significa "pendiente". Se descarta crear las 9 filas al registrarse (ver Decisiones).

```sql
-- supabase/migrations/<timestamp>_create_tutorial_progress.sql
create table public.tutorial_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  section text not null check (section in (
    'summary', 'transactions', 'accounts', 'recurring', 'budgets',
    'goals', 'debts', 'reports', 'recommendations'
  )),
  completed_at timestamptz not null default now(),
  primary key (user_id, section)
);

alter table public.tutorial_progress enable row level security;

create policy "tutorial_progress_select_own" on public.tutorial_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "tutorial_progress_insert_own" on public.tutorial_progress
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "tutorial_progress_update_own" on public.tutorial_progress
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "tutorial_progress_delete_own" on public.tutorial_progress
  for delete to authenticated using (user_id = (select auth.uid()));
```

```ts
// src/config/tutorials.ts
export const TUTORIAL_SECTIONS = [
  "summary",
  "transactions",
  "accounts",
  "recurring",
  "budgets",
  "goals",
  "debts",
  "reports",
  "recommendations"
] as const
export type TutorialSection = (typeof TUTORIAL_SECTIONS)[number]

interface TutorialStep {
  /** Valor de data-tour del elemento resaltado; sin él, el paso va centrado */
  target?: string
  title: string
  description: string
  /** Solo en escritorio, solo en móvil o en ambos (por defecto) */
  viewport?: "desktop" | "mobile"
}

export const TUTORIALS: Record<TutorialSection, readonly TutorialStep[]>
```

Actions en `src/features/tutorials/actions.ts`, con Zod sobre `TutorialSection` y el usuario autenticado:

- `completeTutorialAction(section)`: `upsert` de la fila (`completed_at = now()`).
- `resetTutorialsAction()`: borra todas las filas del usuario.

Al agregar Empresa, se amplía el `check` con una migración nueva.

## Plan de implementación

1. **Migración y tipos.** Crear `tutorial_progress` con RLS; `supabase db push` en local; regenerar `src/types/database.ts`.
2. **Config y actions.** `src/config/tutorials.ts` con las claves y pasos vacíos; `src/features/tutorials/actions.ts` y `queries.ts` (`getCompletedTutorials`).
3. **Contexto.** Leer el progreso en el layout del dashboard (dentro de `Suspense`) y exponerlo con `TutorialProvider`.
4. **Motor.** Hook `useTutorial(section)` que carga `driver.js` con `import()`, filtra pasos por viewport y elementos presentes, aplica textos en español, reduced motion y tema, y llama a `completeTutorialAction` al terminar.
5. **Arranque automático.** Arrancar al entrar a una sección pendiente cuando no hay diálogo ni hoja abierta.
6. **Botón `?` del header.** Junto al ojo, solo en las 9 secciones.
7. **Pasos por sección.** Escribir los pasos y poner los `data-tour` en los componentes, una sección por commit, escritorio y móvil.
8. **Cuenta › Preferencias.** Tarjeta **Tutoriales** con estado, **Ver de nuevo** y **Reiniciar todos**.
9. **Tema.** Estilos del popover con tokens; verificar AA en claro y oscuro.
10. **Docs y CHANGELOG.**
11. **Verificación.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [x] `driver.js` figura en `package.json` con versión exacta y el lockfile está sincronizado.
- [x] `driver.js` no aparece en el bundle inicial del dashboard; se descarga solo al arrancar un tutorial.
- [ ] Un usuario nuevo que entra a cada una de las 9 secciones ve arrancar su tutorial automáticamente.
- [ ] Terminar el último paso crea la fila en `tutorial_progress` y el tutorial no vuelve a arrancar solo en esa sección.
- [ ] Cerrar el tutorial a medias no crea fila y el tutorial vuelve a arrancar en la próxima visita.
- [ ] El botón `?` del header arranca el tutorial de la sección actual aunque esté completado.
- [x] El botón `?` no aparece fuera de las 9 secciones (Empresa, Cuenta, Importar).
- [ ] Cuenta › Preferencias lista las 9 secciones con su estado correcto.
- [ ] **Reiniciar todos** borra el progreso y los tutoriales vuelven a arrancar solos.
- [ ] En móvil (`< 768 px`) el tutorial resalta los elementos móviles (barra inferior, hoja de acciones) y no los del aside.
- [ ] Un paso cuyo elemento no está en pantalla se omite sin error.
- [ ] El tutorial no arranca encima de la hoja de acciones rápidas autoabierta en móvil.
- [x] Con teclado se recorre el tutorial completo y Escape lo cierra.
- [x] Con `prefers-reduced-motion` el tutorial no anima.
- [x] Un usuario no puede leer ni escribir el progreso de otro (RLS probada con dos usuarios).
- [x] El popover cumple AA en claro y oscuro.

## Decisiones

- **Sí:** filas perezosas, solo para secciones completadas (propuesta aceptada por delegación del usuario). Motivos:
  - Sin trigger de registro ni backfill para usuarios existentes.
  - Agregar secciones (Empresa) no obliga a crear filas para todos.
  - "Reiniciar" es un `delete`, sin estados intermedios.
  - El estado de las 9 secciones se deriva igual: con fila = completado, sin fila = pendiente.
- **No:** 9 filas creadas al registrarse con `completed_at` nulo. Más escrituras, backfill y trigger para el mismo dato.
- **No:** columna `jsonb` en `profiles`. Sin restricción de claves por `check` y actualizaciones con riesgo de pisar otras claves.
- **Sí:** cerrar a medias no completa (decisión del usuario). El tutorial insiste hasta que se termina.
- **Sí:** escritorio y móvil con pasos propios. Los layouts difieren (SPEC 15, SPEC 20).
- **Sí:** `data-tour` como ancla. Las clases cambian con el diseño; un atributo dedicado no.
- **Sí:** carga perezosa de `driver.js`. Solo los usuarios que ven un tutorial pagan su peso.
- **Sí:** solo Personal por ahora (decisión del usuario).

## Riesgos

| Riesgo                                                 | Mitigación                                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| El tutorial insistente molesta a quien no quiere verlo | Se acepta por decisión del usuario; si genera quejas, otro spec agrega "No volver a mostrar".       |
| Selectores rotos tras refactors de UI                  | Anclas `data-tour` documentadas en `docs/ui.md`; un paso sin elemento se omite en vez de romper.    |
| Choque con diálogos, Drawer o hoja móvil abiertos      | El arranque espera a que no haya overlays; el paso que necesita el Drawer móvil lo abre o se omite. |
| `cacheComponents` y lectura del progreso en el layout  | Mismo patrón que `hide_amounts` (SPEC 22), dentro de `Suspense`.                                    |
| Estilos de Driver.js con contraste bajo en oscuro      | Sobrescribir su CSS con tokens y medir AA.                                                          |

## Qué **no** entra en este spec

- Tutoriales de Empresa, Cuenta o Importar.
- Retomar un tutorial desde el paso donde quedó.
- Analítica de tutoriales.
- Lo de SPEC 25, 26 y 28.
