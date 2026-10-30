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
`src/libs/seo.ts`.

## Estructura

```text
app/                    Rutas (App Router) y archivos de metadata
├── layout.tsx          Metadata global, viewport y JSON-LD
├── manifest.ts         manifest.webmanifest
├── robots.ts           robots.txt
└── sitemap.ts          sitemap.xml
src/
├── components/seo/     <JsonLd />
├── config/site.ts      SITE: marca, autor, rutas, espacios y SEO
├── libs/seo.ts         buildMetadata() y builders de schema.org
└── styles/globals.css  Tailwind y estilos base
docs/                   Documentación de producto
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

| Variable                               | Para qué sirve                                |
| -------------------------------------- | --------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | URL pública: canonical, Open Graph y sitemap  |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto de Supabase                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública de Supabase (protegida por RLS) |

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

## Hoja de ruta

- [x] Base del proyecto: configuración, SEO y documentación
- [ ] Landing page
- [ ] Autenticación con Supabase (`/sign-in`, `/sign-up`)
- [ ] Dashboard con aside y selector de espacio _Personal_ / _Empresa_
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
