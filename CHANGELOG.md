# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-29

### Added

- Project bootstrapped with Next.js 16 (App Router, Cache Components, `typedRoutes`), React 19, TypeScript 6 and Tailwind CSS 4 via `@tailwindcss/turbopack`.
- `SITE` config object (`src/config/site.ts`) as the single source of brand, author, repository, routes, workspaces (Personal / Empresa), features and SEO defaults.
- SEO layer in `src/libs/seo.ts`: `buildMetadata()` (canonical, robots, Open Graph, Twitter Card) and JSON-LD builders for `WebApplication`, `WebSite`, `Person` (author) and `BreadcrumbList`, rendered through `<JsonLd />`.
- Metadata routes: `robots.txt` (blocks `/dashboard/`, `/api/`, `/auth/`), `sitemap.xml` and `manifest.webmanifest`, all sourced from `SITE`.
- Tooling: ESLint (`eslint-config-next` + `eslint-config-prettier`), Prettier with import sorting and Tailwind class sorting, and a CI workflow running `check`, `eslint`, `prettier:check` and `build` on every push/PR to `main`.
- GitHub templates: bug report and feature request issue forms, pull request template and Dependabot config.
- Documentation: `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/producto.md` and MIT `LICENSE` crediting Angel De La Torre (Angel DM).
- `.env.example` documenting `NEXT_PUBLIC_SITE_URL` and the Supabase variables.

### Removed

- `create-next-app` starter assets (`public/*.svg`) and the default README.

---

## Version Support

- **Current version**: 0.1.0
- **Node.js**: >= 24.19.0
- **pnpm**: >= 12.16.1
- **Next.js**: 16.4.3
- **Tailwind CSS**: v4
