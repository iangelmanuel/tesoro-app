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
