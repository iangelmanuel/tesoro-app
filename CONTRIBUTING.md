# Contribuir a Tesoro

¡Gracias por tu interés en contribuir a este proyecto! 🎉

## 🚀 Formas de contribuir

### 🐛 Reportar bugs

- Usa la [pestaña de Issues](https://github.com/iangelmanuel/tesoro-app/issues)
  con la plantilla **Reporte de bug**
- Describe el problema claramente e incluye pasos para reproducirlo
- Menciona tu sistema operativo y navegador
- **Nunca** incluyas datos financieros reales ni claves en un issue

### 💡 Sugerir mejoras

- Abre un Issue con la plantilla **Solicitud de funcionalidad**
- Explica qué problema resuelve y por qué sería útil
- Indica si aplica a _Personal_, _Empresa_ o ambos

### 🔐 Vulnerabilidades

No las reportes en un issue público: sigue [SECURITY.md](SECURITY.md).

### 🛠️ Contribuir con código

1. **Fork** el repositorio
2. **Clona** tu fork localmente
3. **Crea** una rama (`git checkout -b feat/mi-funcionalidad`)
4. **Realiza** tus cambios
5. **Verifica** con `pnpm check`, `pnpm eslint` y `pnpm prettier:check`
6. **Commit** siguiendo [Conventional Commits](#-estructura-de-commits)
7. **Push** a tu rama (`git push origin feat/mi-funcionalidad`)
8. **Abre** un Pull Request hacia `main`

## 📋 Entorno de desarrollo

### Prerrequisitos

- **Node.js** ≥ 24.19.0
- **pnpm** ≥ 12.16.1
- **Git**
- Un proyecto de [Supabase](https://supabase.com/dashboard) para desarrollo

### Configuración

```bash
# 1. Fork y clona el repositorio
git clone https://github.com/tu-usuario/tesoro-app.git
cd tesoro-app

# 2. Configura las variables de entorno
cp .env.example .env.local
# Edita .env.local con la URL y la clave publicable de tu proyecto de Supabase

# 3. Instala las dependencias
pnpm install

# 4. Inicia el servidor de desarrollo
pnpm dev
```

> Usa siempre un proyecto de Supabase **de desarrollo**, nunca el de
> producción, y datos de prueba en lugar de tus finanzas reales.

## 🎨 Estándares de código

### Herramientas

- **TypeScript** en modo `strict`: tipado estático requerido
- **ESLint** (`eslint-config-next` + `eslint-config-prettier`)
- **Prettier** con orden de imports y clases de Tailwind automáticos

```bash
pnpm check            # tipos
pnpm eslint           # lint
pnpm prettier:check   # formato
pnpm prettier         # formatea
```

### Convenciones de naming

- **Archivos**: kebab-case (`transaction-list.tsx`)
- **Componentes**: PascalCase (`TransactionList`)
- **Variables y funciones**: camelCase (`monthlyBalance`)
- **Constantes**: UPPER_SNAKE_CASE (`MAX_CATEGORIES`)
- **Rutas**: kebab-case (`/sign-in`)
- **Tablas y columnas SQL**: snake_case (`workspace_id`)

### Configuración centralizada

Los datos de marca, rutas y SEO viven en `src/config/site.ts` (`SITE`). No
dupliques textos de marca, URLs o metadatos en componentes: léelos de `SITE`.
Para la metadata de cada página usa `buildMetadata()` de `src/libs/seo.ts`.

### Next.js

Este proyecto usa una versión reciente de Next.js con cambios respecto a
versiones anteriores. Antes de escribir código, consulta la guía relevante en
`node_modules/next/dist/docs/` (ver [AGENTS.md](AGENTS.md)).

### Base de datos

- Toda tabla con datos de usuario debe tener **RLS activada** con políticas
  explícitas.
- Los cambios de esquema van en migraciones versionadas, nunca editados a mano
  en el panel de producción.
- La clave `service_role` jamás se usa en código que llega al cliente.

## 📝 Estructura de commits

### Formato

```
type(scope): description

[optional body]

[optional footer]
```

### Tipos

- `feat`: nueva funcionalidad
- `fix`: corrección de bug
- `docs`: documentación
- `style`: formato (sin cambios de lógica)
- `refactor`: refactorización
- `perf`: mejora de rendimiento
- `test`: tests
- `chore`: mantenimiento, dependencias, configuración

### Ejemplos

```bash
feat(dashboard): add workspace switcher to aside
fix(auth): redirect to sign-in when session expires
docs(readme): update environment variables table
chore(deps): bump next to 16.4.3
```

## 🧪 Calidad

### Antes de hacer commit

- [ ] `pnpm check` sin errores
- [ ] `pnpm eslint` sin errores
- [ ] `pnpm prettier:check` sin cambios pendientes
- [ ] `pnpm build` termina correctamente
- [ ] Los cambios son responsive
- [ ] Funciona en modo claro y oscuro
- [ ] Funciona en los espacios _Personal_ y _Empresa_ (si aplica)

### Checklist para Pull Requests

- [ ] Título descriptivo siguiendo Conventional Commits
- [ ] Descripción de los cambios y su motivación
- [ ] Capturas si hay cambios visuales
- [ ] Issues relacionados mencionados
- [ ] Migraciones y políticas RLS incluidas si se tocó la base de datos
- [ ] `CHANGELOG.md` y documentación actualizados si aplica

## 🌟 Áreas prioritarias

### Alta prioridad

- 🐛 **Corrección de bugs**
- 🔐 **Seguridad y privacidad de datos**
- ♿ **Accesibilidad**
- 📱 **Experiencia responsive**

### Media prioridad

- ✨ **Nuevas funcionalidades** de la [hoja de ruta](README.md#hoja-de-ruta)
- 📊 **Gráficas y visualización de datos**
- 🧮 **Mejoras al score y a las recomendaciones**

### Baja prioridad

- 📝 **Documentación**
- 🧹 **Refactoring**
- 🎯 **Mejoras de DX**

## 💬 Comunicación

- **GitHub Issues**: bugs y funcionalidades
- **GitHub Discussions**: preguntas generales e ideas
- **Pull Requests**: revisión de código
- **Email**: [iangelmanuel02@gmail.com](mailto:iangelmanuel02@gmail.com) para
  temas urgentes

### Código de conducta

- Sé respetuoso y constructivo
- Acepta las críticas constructivas
- Ayuda a otros contribuidores
- Mantén un ambiente inclusivo y acogedor

## 📄 Licencia

Al contribuir aceptas que tu código se publique bajo la [licencia MIT](LICENSE)
del proyecto.

## 🎁 Reconocimiento

Los contribuidores serán reconocidos en:

- La lista de colaboradores de GitHub
- El CHANGELOG
- La sección de agradecimientos del README

## 📚 Recursos

- [Next.js](https://nextjs.org/docs)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [Supabase](https://supabase.com/docs)

---

¡Gracias por contribuir y hacer este proyecto mejor para todos! 🙌

**¿Tienes preguntas?** Abre un Issue o escríbeme directamente.
