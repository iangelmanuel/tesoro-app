# Política de Seguridad

Tesoro maneja información financiera personal y empresarial. Nos tomamos la
seguridad en serio y agradecemos cualquier reporte responsable.

## Versiones soportadas

| Versión | Soportada          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

**Versión actual**: 0.1.0 — base del proyecto (configuración, SEO y
documentación).

## Reportar una vulnerabilidad

### 🔐 Divulgación privada

**Por favor, NO abras un issue público para reportar vulnerabilidades.**

Usa uno de estos canales privados:

1. **GitHub**: [Reportar una vulnerabilidad](https://github.com/iangelmanuel/tesoro-app/security/advisories/new)
   (Security Advisories privados).
2. **Email**: [iangelmanuel02@gmail.com](mailto:iangelmanuel02@gmail.com) con
   el asunto `SECURITY: [Descripción breve]`.

### 📋 Qué incluir

- **Tipo de vulnerabilidad** (XSS, CSRF, inyección, bypass de RLS, fuga de
  datos entre usuarios, etc.)
- **Ubicación** (ruta del archivo, URL, tabla o política afectada)
- **Pasos para reproducirla**
- **Prueba de concepto** (si aplica)
- **Impacto estimado**
- **Mitigación sugerida** (si la tienes)

### ⏱️ Tiempos de respuesta

- **Respuesta inicial**: dentro de 48 horas
- **Actualización de estado**: dentro de 5 días hábiles
- **Corrección**: según severidad
  - **Crítica**: 24–72 horas
  - **Alta**: 1–2 semanas
  - **Media**: 2–4 semanas
  - **Baja**: siguiente versión

### 🏆 Reconocimiento

Agradecemos a quienes investigan y reportan de forma responsable:

- Reconocimiento de tu contribución (con tu permiso)
- Crédito en el advisory de seguridad
- Mención en el Hall of Fame (opcional)

## Modelo de seguridad

### 🗄️ Datos y Supabase

- **Row Level Security (RLS)** activada en todas las tablas con datos de
  usuario: cada usuario solo puede leer y escribir sus propios registros.
- **Espacios aislados**: los datos de _Personal_ y _Empresa_ se separan por
  espacio de trabajo y se validan contra el usuario autenticado.
- **Clave pública vs. clave de servicio**: el cliente solo usa la clave
  publicable de Supabase. La clave `service_role` (o secreta) nunca se expone
  al navegador ni se guarda en el repositorio.
- **Autenticación**: gestionada por Supabase Auth; las sesiones se validan en
  el servidor antes de acceder a datos.

### 🛡️ Desarrollo

- **Validación de entradas** en servidor para todo dato que llega del usuario.
- **Revisión de código** antes de cada merge a `main`.
- **Análisis estático** con ESLint y verificación de tipos con TypeScript en
  CI.
- **HTTPS** en todas las comunicaciones.

### 📦 Dependencias

- **Dependabot** para actualizaciones y alertas de seguridad.
- **`pnpm audit`** de forma periódica.
- **Dependencias mínimas**: solo los paquetes necesarios.

### 🔑 Variables de entorno

- Ningún secreto en el código: todo dato sensible vive en variables de
  entorno (`.env.local`, ignorado por git).
- `.env.example` documenta las variables sin valores reales.
- Claves separadas para desarrollo y producción; rótalas si sospechas una
  filtración.

## Política de divulgación

1. **Día 0**: reporte privado de la vulnerabilidad
2. **Día 1–2**: respuesta inicial y clasificación
3. **Día 3–7**: investigación y desarrollo de la corrección
4. **Día 8–14**: pruebas y validación
5. **Día 15+**: divulgación pública (tras desplegar la corrección)

### 🏅 Hall of Fame

_Aún no hay reportes — ¡sé el primero en ayudarnos a mejorar!_

## Contacto

- **Responsable**: Angel De La Torre (Angel DM)
- **Email**: [iangelmanuel02@gmail.com](mailto:iangelmanuel02@gmail.com)
- **GitHub**: [@iangelmanuel](https://github.com/iangelmanuel)

Para vulnerabilidades críticas con riesgo inmediato usa el asunto
`URGENT SECURITY - [Descripción breve]`.

## Recursos

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Next.js: Data Security](https://nextjs.org/docs/app/guides/data-security)
- [GitHub Security Advisories](https://github.com/advisories)

---

¡Gracias por ayudar a mantener Tesoro y a sus usuarios seguros! 🙏

_Última actualización: 29 de octubre de 2026_
