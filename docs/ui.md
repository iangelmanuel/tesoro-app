# UI de Tesoro

Guía de diseño del dashboard. Se completa en el paso 17 de
[SPEC 14](../specs/14-ui-polish-with-impeccable.md).

## Impeccable

[Impeccable](https://github.com/pbakaus/impeccable) es el skill de diseño del
proyecto. Vive versionado en `.claude/skills/impeccable/`, con sus subagentes en
`.claude/agents/impeccable-*.md`. No se instala como plugin.

| Pieza | Versión |
| ----- | ------- |
| Skill | 4.8.0   |
| Motor | 0.1.18  |

- El motor es un binario por plataforma. No se versiona
  (`.claude/skills/impeccable/scripts/bin/` está en `.gitignore`): el launcher
  lo descarga la primera vez y lo verifica contra
  `scripts/engine-checksums.txt`.
- La copia versionada difiere del upstream 4.8.0 solo en formato: pasó una vez
  por Prettier antes de excluirla en `.prettierignore`. La lógica es la misma.
  La próxima reinstalación la deja idéntica.
- Para actualizar, reinstala con `npx skills add pbakaus/impeccable`,
  revisa el diff y actualiza esta tabla.

## Contraste

Pares verificados con los tokens de `src/styles/globals.css` (WCAG 2.x,
OKLCH → sRGB). Mínimos: 4.5:1 texto, 3:1 gráficos y foco.

| Par                                      | Claro | Oscuro |
| ---------------------------------------- | ----- | ------ |
| `foreground` / `background`              | 16.49 | 18.96  |
| `muted` / `surface`                      | 6.00  | 6.74   |
| `muted` / `default`                      | 4.96  | 5.66   |
| `income` / `surface`                     | 9.13  | 11.68  |
| `expense` / `surface`                    | 5.18  | 4.72   |
| `balance` / `surface`                    | 5.85  | 8.12   |
| `danger` / `background`                  | 5.07  | 6.84   |
| `accent-foreground` / `accent` Personal  | 4.84  | 7.19   |
| `accent-foreground` / `accent` Empresa   | 4.94  | 6.13   |
| `accent` / `background` Personal (foco)  | 3.41  | 8.03   |
| `accent` / `background` Empresa (foco)   | 3.34  | 6.84   |
| `text-brand` / `background`              | 5.10  | 11.08  |
| `--chart-*` / `surface` (mínimo)         | 4.77  | 3.72   |
| `income` vs `expense` (series contiguas) | 1.76  | 2.47   |

Ingresos y gastos no llegan a 3:1 entre sí: la diferencia de luminosidad
ayuda, pero las gráficas también los distinguen por leyenda y orden fijo.
