<div align="center">

# Tesoro

### Finanzas personales y empresariales claras, a partir de tus propios registros

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Licencia MIT](https://img.shields.io/badge/c%C3%B3digo-MIT-000000)](LICENSE)

**[Changelog](CHANGELOG.md)**&nbsp;•&nbsp;**[Guía de contribución](CONTRIBUTING.md)**&nbsp;•&nbsp;**[Seguridad](SECURITY.md)**

</div>

---

> [!NOTE]
> Proyecto en fase inicial (`0.1.0`). Este repositorio contiene por ahora la
> base del proyecto: configuración, SEO y documentación. La aplicación se
> construye en las siguientes versiones — ver [Hoja de ruta](#hoja-de-ruta).

## Qué es

Tesoro es un gestor y recomendador de finanzas personales y empresariales, de
código abierto. No te pide armar tus finanzas desde cero ni conectar tu banco:
parte de los registros que tú le das (ingresos, gastos, deudas, metas) y los
convierte en un panorama limpio, fácil de entender y visualmente cuidado.

- **Gráficas claras**: ingresos, gastos, categorías y tendencias de un vistazo.
- **Recomendaciones**: sugerencias concretas a partir de tus propios
  movimientos, no consejos genéricos.
- **Score financiero**: un puntaje que resume la salud de tus finanzas y cómo
  evoluciona mes a mes.
- **Dos espacios, una cuenta**: _Personal_ (por defecto) y _Empresa_, con un
  selector en la parte superior del aside del dashboard. Si aún no tienes un
  espacio de empresa, Tesoro te invita a crearlo.

Toda la información de marca, rutas y SEO vive en un único objeto de
configuración: `src/config/site.ts` (`SITE`).

## Stack

Construido con [Next.js](https://nextjs.org/) (App Router, Cache Components y
`typedRoutes`), [React](https://react.dev/) y
[TypeScript](https://www.typescriptlang.org/) en todo el proyecto. Los estilos
son [Tailwind CSS](https://tailwindcss.com/) 4 vía `@tailwindcss/turbopack`.
Autenticación y base de datos corren sobre [Supabase](https://supabase.com/)
(Postgres + Auth), con Row Level Security para que cada usuario solo vea sus
propios datos. El SEO (metadata, Open Graph, JSON-LD, `robots.txt`,
`sitemap.xml` y `manifest.webmanifest`) se genera desde `SITE` con
`src/libs/seo.ts`. La interfaz usa [shadcn/ui](https://ui.shadcn.com/) (Radix),
tema claro/oscuro con [next-themes](https://github.com/pacocoursey/next-themes)
y validación con [Zod](https://zod.dev/).

## Estructura

```text
app/                      Rutas (App Router) y archivos de metadata
├── (auth)/               /sign-in y /sign-up
├── auth/callback/        Callback de OAuth
├── dashboard/            Layout con aside, /personal/... y /business
├── layout.tsx            Metadata global, viewport, JSON-LD y tema
├── manifest.ts           manifest.webmanifest
├── robots.ts             robots.txt
└── sitemap.ts            sitemap.xml
proxy.ts                  Refresca la sesión y protege /dashboard/*
src/
├── components/
│   ├── dashboard/        Aside, tabs de espacio, menú de usuario, placeholders
│   ├── seo/              <JsonLd />
│   ├── theme/            ThemeProvider (next-themes)
│   └── ui/               Componentes de shadcn/ui
├── config/site.ts        SITE: marca, autor, rutas, navegación, espacios y SEO
├── features/auth/        Esquemas Zod, Server Actions y formularios de auth
├── libs/
│   ├── seo.ts            buildMetadata() y builders de schema.org
│   ├── supabase/         Clientes de Supabase (navegador, servidor y proxy)
│   └── utils.ts          cn()
├── types/database.ts     Tipos generados de la base de datos
└── styles/globals.css    Tailwind, tokens de shadcn y tema claro/oscuro
supabase/                 config.toml y migraciones versionadas
docs/                     Documentación de producto
specs/                    Specs de implementación
```

## Empezar

Requisitos:

- **Node.js** ≥ 24.19.0
- **pnpm** ≥ 12.16.1 (el repo fija `pnpm@12.16.1` vía `packageManager`)
- Un proyecto de [Supabase](https://supabase.com/dashboard) (gratis)

```bash
git clone https://github.com/iangelmanuel/tesoro-app.git
cd tesoro-app
cp .env.example .env.local   # añade tus claves de Supabase
pnpm install
pnpm dev
```

La app queda disponible en `http://localhost:3000`.

| Variable                               | Para qué sirve                                      |
| -------------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | URL pública: canonical, Open Graph, sitemap y OAuth |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto de Supabase                        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable de Supabase (protegida por RLS)    |
| `SUPABASE_AUTH_EXTERNAL_*`             | Credenciales OAuth para el stack local (solo CLI)   |

Nunca pongas la clave `service_role` ni la secreta en `.env.local` ni en
variables `NEXT_PUBLIC_*`: la app solo usa la clave publicable.

| Comando               | Qué hace                                |
| --------------------- | --------------------------------------- |
| `pnpm dev`            | Servidor de desarrollo                  |
| `pnpm build`          | Build de producción                     |
| `pnpm start`          | Sirve el build de producción localmente |
| `pnpm check`          | Verificación de tipos (`tsc --noEmit`)  |
| `pnpm eslint`         | Lint sobre todo el proyecto             |
| `pnpm eslint:fix`     | Lint con corrección automática          |
| `pnpm prettier`       | Formatea el código                      |
| `pnpm prettier:check` | Verifica el formateo sin escribir       |

CI (`.github/workflows/ci.yml`) corre `check`, `eslint` y `prettier:check` en
paralelo, y un build, en cada push/PR a `main`.

### Supabase

Necesitas el [Supabase CLI](https://supabase.com/docs/guides/cli). Las
migraciones viven en `supabase/migrations/` y se aplican igual en local o en
remoto.

**Proyecto remoto** (recomendado, no necesita Docker):

```bash
supabase login
supabase link --project-ref <ref>   # el ref está en la URL del proyecto
supabase db push                    # aplica las migraciones
```

En el dashboard de Supabase, en **Authentication**:

- **Sign In / Providers → Email**: desactiva _Confirm email_ y pon
  _Minimum password length_ en `8`.
- **URL Configuration**: _Site URL_ `http://localhost:3000` y, en _Redirect
  URLs_, `http://localhost:3000/auth/callback` y
  `http://localhost:3000/auth/confirm` (y las de producción).
- **Emails → Templates**: copia el asunto y el HTML de `supabase/templates/`
  en _Confirm signup_ (`confirmation.html`), _Reset password_
  (`recovery.html`) y _Change email address_ (`email_change.html`).
  `config.toml` solo los aplica en local.

Después de `db push`, comprueba en el SQL Editor que el borrado programado de
cuentas quedó activo: `select * from cron.job` debe mostrar
`purge-deleted-accounts`.

**Confirmación de email.** El código la soporta, pero va apagada. Antes de
encenderla (_Confirm email_ en el dashboard, `enable_confirmations` en local),
configura un SMTP propio en **Authentication → Emails → SMTP Settings**: sin
él, Supabase envía muy pocos correos por hora, y esos mismos correos cubren la
recuperación de contraseña y el cambio de email.

**Stack local** (requiere [Docker](https://docs.docker.com/desktop/) y bastante
RAM):

```bash
supabase start      # levanta Postgres, Auth y Studio; muestra URL y claves
supabase db reset   # reaplica las migraciones desde cero
supabase stop
```

En local, `supabase/config.toml` ya trae la confirmación de email desactivada,
los redirects a `/auth/callback` y `/auth/confirm`, la longitud mínima de 8 y
las plantillas en español. Los correos se ven en Mailpit
(`http://127.0.0.1:54324`). Usa la `API_URL` y la clave publicable que
imprime `supabase start` en tu `.env.local`.

### Proveedores OAuth (opcional)

Sin ellos, el registro con email y contraseña funciona igual.

1. **Google**: en [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   crea un _OAuth client ID_ de tipo _Web application_.
2. **GitHub**: en _Settings → Developer settings → OAuth Apps_ crea una app.
3. En ambos, la URL de redirección autorizada es el callback de Supabase, no
   el de la app:
   - Remoto: `https://<ref>.supabase.co/auth/v1/callback`
   - Local: `http://127.0.0.1:54321/auth/v1/callback`
4. Remoto: pega el _client ID_ y el _secret_ en **Authentication → Sign In /
   Providers** de cada proveedor. Local: ponlos en `supabase/.env` como
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `..._GOOGLE_SECRET`,
   `..._GITHUB_CLIENT_ID` y `..._GITHUB_SECRET`, y reinicia `supabase start`.

## Hoja de ruta

- [x] Base del proyecto: configuración, SEO y documentación
- [ ] Landing page
- [x] Autenticación con Supabase (`/sign-in`, `/sign-up`, Google y GitHub)
- [x] Dashboard con aside y selector de espacio _Personal_ / _Empresa_
- [ ] Registro de movimientos (ingresos, gastos, categorías)
- [ ] Gráficas y reportes
- [ ] Score financiero
- [ ] Motor de recomendaciones

El detalle de cada módulo está en [docs/producto.md](docs/producto.md).

## Licencia

Código bajo licencia [MIT](LICENSE). Puedes usarlo, copiarlo, modificarlo y
distribuirlo para lo que quieras — proyectos personales, educativos o
comerciales — con una sola condición: conservar el aviso de copyright que
reconoce a **Angel De La Torre (Angel DM)** como autor original.

## Autor

**Angel De La Torre** — Angel DM

- GitHub: [@iangelmanuel](https://github.com/iangelmanuel)
- LinkedIn: [@iangelmanuel](https://www.linkedin.com/in/iangelmanuel)
- X: [@iangelmanuel](https://x.com/iangelmanuel)
- Website: [angeldm.dev](https://angeldm.dev)

---

<div align="center">

Si te sirvió algo de este repo, deja una estrella ⭐

Hecho por [Angel DM](https://angeldm.dev)

</div>
