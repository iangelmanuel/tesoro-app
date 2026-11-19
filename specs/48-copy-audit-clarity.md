# SPEC 48 — Auditoría de textos: claridad en toda la app

> **Estado:** Aprobado
> **Depende de:** SPEC 47
> **Fecha:** 2026-11-18
> **Objetivo:** Reescribir los textos ambiguos, técnicos o inconsistentes que quedan después de SPEC 47 con una guía de voz corta y verificable.

## Por qué existe este spec

SPEC 47 cambia el vocabulario de movimientos y agrega ayuda a cada campo. Quedan textos que confunden por otras razones:

- Una misma palabra con dos sentidos: "Avance" es un retiro con la tarjeta y también el progreso de un presupuesto.
- Un mismo concepto con dos nombres: "Cuenta habitual" y "Cuenta por defecto".
- Jerga contable o técnica: "Conciliar", "Ocurrencias", "Revertir operación".
- Frases poco claras: "Si pagaras al mes", "Recomendación oculta este mes".

Este spec fija una guía de voz y aplica los cambios encontrados en el análisis.

## Alcance

**Entra:**

- Guía de voz en `docs/ui.md#voz` (reglas abajo).
- Cambios de la tabla de hallazgos: etiquetas, títulos, toasts, vacíos, tours y textos de `HELP`.
- Una pasada final por área para encontrar textos que rompan la guía, con la misma tabla como formato.

**Fuera de alcance:**

- El vocabulario Entrada / Salida y las ayudas por campo (SPEC 47).
- Las descripciones del MCP y la página `/mcp`.
- Los textos legales (`/legal/*`).
- Los videos de la landing.
- Cambiar rutas, nombres de código o datos.

## Guía de voz

1. **Tuteo, español neutro (es-CO), sin anglicismos** cuando hay una palabra común. Se mantienen "score" y "email", que ya son conocidas.
2. **Botones: verbo + objeto, máximo 3 palabras.** Ej.: "Registrar movimiento", "Crear meta", "Actualizar saldo".
3. **Títulos: sustantivo, sin verbo ni signos.** Ej.: "Próximos vencimientos".
4. **Toasts de éxito: objeto + participio.** Ej.: "Meta creada". Sin "¡", sin "exitosamente".
5. **Errores: qué pasó + qué hacer.** Ej.: "No se pudo guardar. Revisa tu conexión e intenta de nuevo". Nunca un código ni un término interno.
6. **Vacíos: qué falta + para qué sirve, en una frase.** La acción va en el botón.
7. **Un concepto, una palabra.** Las equivalencias quedan en el glosario de SPEC 47 y en la tabla de abajo.
8. **Frases de máximo 20 palabras.** Si hace falta más, se parte o se mueve a una ayuda (?).

## Hallazgos y cambios

| Dónde                                                         | Antes                                                  | Ahora                                                      | Por qué                                      |
| ------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------- |
| Presupuestos (`budgets/`)                                     | Avance por categoría; "sigue tu avance durante el mes" | Progreso por categoría; "sigue tu progreso durante el mes" | "Avance" ya es un retiro con tarjeta         |
| Deudas, Me deben (`debt-dialog`, `receivable-dialog`)         | Cuenta habitual (opcional)                             | Cuenta por defecto (opcional)                              | Ingresos fijos ya dice "Cuenta por defecto"  |
| Gastos fijos (`recurring-expense-dialog`)                     | Cuenta habitual (opcional)                             | Cuenta por defecto (opcional)                              | Mismo concepto, mismo nombre                 |
| Cuentas, Deudas (`adjust-balance-dialog`, `reconcile-dialog`) | Saldo real                                             | Saldo en tu banco                                          | "Real" sugiere que el de Tesoro es falso     |
| Cuentas (`reconcile-dialog`, `HELP.reconciliation`, toast)    | Conciliar / Cuenta conciliada                          | Cuadrar saldo / Saldo cuadrado                             | Término contable; "cuadrar" es el uso común  |
| Gastos fijos, Ingresos fijos                                  | Ocurrencias; "5 ocurrencias, del…"                     | Periodos; "5 periodos, del…"                               | `HELP.frequency` ya habla de periodos        |
| Deudas (`debt-sheet`)                                         | Si pagaras al mes                                      | Simula un pago mensual                                     | Condicional confuso como etiqueta            |
| Importar (`columns-step`)                                     | Ajuste a la baja                                       | Ajuste que baja el saldo                                   | Explícito, igual que "Cargo (sube el saldo)" |
| Importar (`columns-step`)                                     | Signo del monto                                        | Cómo distinguir entradas y salidas                         | Dice qué se decide, no el mecanismo          |
| Exportar (`export-dialog`)                                    | Ahorro de tinta                                        | Para imprimir                                              | Dice el uso                                  |
| Recomendaciones (toast)                                       | Recomendación oculta este mes                          | Oculta hasta el próximo mes                                | Dice cuándo vuelve                           |
| Cuenta → Agentes IA (`mcp/components`)                        | ¿Revertir esta operación? / Operación revertida        | ¿Deshacer este cambio? / Cambio deshecho                   | "Revertir operación" es jerga técnica        |
| Resumen (`upcoming-debt-payments`)                            | Próximos pagos                                         | Próximos vencimientos                                      | Son fechas límite, no pagos hechos           |
| Toasts de error con punto final vs. sin él                    | Mezcla ("Intenta de nuevo" / "…conexión.")             | Sin punto final en toasts                                  | Consistencia (regla 4/5)                     |
| `HELP.utilization`                                            | "Cuánto de tu cupo de tarjetas estás usando"           | "Qué parte del cupo de tus tarjetas estás usando"          | Más claro; enlaza con la ayuda de Cupo       |
| `HELP.accumulatedBalance`                                     | "…no cuenta traspasos ni saldos iniciales."            | Igual, y "entrado / gastado" pasa a "entradas / salidas"   | Vocabulario de SPEC 47                       |

Lo que se revisó y **se queda**:

- "Me deben" / "Debo": claro y corto.
- "Movimiento rápido" y "Verificar movimientos".
- "Cuota de manejo": término de los bancos, con su ayuda.
- "Score": tiene `HelpHint` y es marca de la landing.
- Los grupos del aside ("Día a día", "Tu plan", "Entiende tu dinero").

## Modelo de datos

No hay datos nuevos. Solo cambian textos en componentes, `src/config/help.ts`, `src/config/tutorials.ts`, `src/config/site.ts` y `docs/`.

## Plan de implementación

1. Escribir la guía de voz en `docs/ui.md#voz`.
2. Aplicar los cambios de Presupuestos, Cuentas y Deudas (Progreso, Cuenta por defecto, Saldo en tu banco, Cuadrar saldo, Simula un pago mensual, Próximos vencimientos).
3. Aplicar los de Gastos fijos e Ingresos fijos (Periodos, Cuenta por defecto).
4. Aplicar los de Importar y Exportar.
5. Aplicar los de Recomendaciones, Agentes IA y toasts (punto final y textos).
6. Actualizar `HELP`, `HELP_LABELS` y los tours (`tutorials.ts`) que nombren los textos cambiados.
7. Hacer una pasada por área (`src/features/*/components`, `src/components/dashboard`, `src/config`). Cada texto que rompa la guía se agrega a la tabla de hallazgos y se corrige en el mismo commit del área.
8. Anotar en `CHANGELOG.md` en `[Unreleased]`.

## Criterios de aceptación

- [ ] `docs/ui.md` tiene la sección **Voz** con las 8 reglas.
- [ ] `grep -rn "Cuenta habitual" src` no devuelve nada.
- [ ] `grep -rni "ocurrencia" src` no devuelve textos visibles.
- [ ] `grep -rn "Avance por categoría" src` no devuelve nada; "Avance" solo aparece como tipo de movimiento de deuda.
- [ ] `grep -rn "Saldo real\|conciliad" src --include=*.tsx` no devuelve textos visibles.
- [ ] Ningún toast termina en punto ni empieza con "¡".
- [ ] Los tours (`tutorials.ts`) no nombran textos que ya no existen.
- [ ] La tabla de hallazgos refleja también lo encontrado en el paso 7.
- [ ] `pnpm check`, `pnpm eslint` y `pnpm prettier:check` pasan.

## Decisiones

- **Sí:** guía de voz con reglas verificables (número de palabras, forma del toast) en vez de adjetivos ("claro", "amable").
- **Sí:** "Cuadrar saldo" en lugar de "Conciliar". Más común para alguien sin formación contable.
- **No:** cambiar "Me deben". Ya es corto y claro.
- **No:** traducir "Score". Es parte de la marca y tiene ayuda.
- **Sí:** "Próximos vencimientos". "Pagos" sugiere que ya se pagaron.
- **Sí:** el paso 7 queda abierto a nuevos hallazgos, siempre en la misma tabla. Así el spec registra lo que cambió.

## Riesgos

| Riesgo                                                       | Mitigación                                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Los tours de driver.js apuntan a textos o anclas que cambian | Paso 6 y criterio de tours. Los tours usan selectores, no textos, pero sus descripciones se revisan. |
| El paso 7 crece sin control                                  | Solo corrige textos que rompan una regla de la guía. Lo demás va a otro spec.                        |
| "Cuadrar saldo" choca con el ajuste que crea                 | El toast y la ayuda dicen que se crea un ajuste por la diferencia.                                   |

## Lo que **no** entra en este spec

- El vocabulario Entrada / Salida y las ayudas por campo (SPEC 47).
- Los textos del MCP, `/mcp` y `/legal/*`.
- Los videos de la landing.
- Rutas, nombres de código y datos.
