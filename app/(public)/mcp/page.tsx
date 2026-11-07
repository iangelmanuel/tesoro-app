import Link from "next/link"
import { buttonVariants } from "@heroui/react"
import { JsonLd } from "@/components/seo/JsonLd"
import { SITE } from "@/config/site"
import { MCP_GROUP_LABELS, getMcpCatalog } from "@/features/mcp/catalog"
import { McpUrlField } from "@/features/mcp/components/mcp-url-field"
import { MCP_AGENTS_PATH } from "@/features/mcp/constants"
import { MCP_RESOURCE_URL } from "@/features/mcp/discovery"
import type { McpToolDefinition } from "@/features/mcp/types"
import { buildBreadcrumbSchema, buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Conecta tu agente de IA",
  description: `Conecta Claude, ChatGPT, Claude Code o Cursor a ${SITE.info.name} con una URL MCP: registra, consulta y corrige tus movimientos hablando con tu agente.`,
  path: SITE.mcp.docsPath
})

const CAPABILITIES = [
  "Registrar ingresos, gastos y traspasos: “Anota el almuerzo de hoy, 32.000 en Nequi”.",
  "Responder con tus cifras reales: resúmenes del mes, reportes, flujo de caja, score y recomendaciones.",
  "Corregir en lote: cambiar la categoría, la fecha o la cuenta de muchos movimientos a la vez.",
  "Leer tus cuentas, presupuestos, metas, deudas, fijos y lo que te deben, en Personal y en Empresa."
]

const EXAMPLES = [
  "Registra el almuerzo de hoy, 32.000 en Nequi.",
  "¿Cuánto gasté en comida este mes comparado con octubre?",
  "Pasa a “Transporte” todos los movimientos de Uber de noviembre.",
  "¿Cómo va mi score y qué me recomienda Tesoro?",
  "¿Qué gastos fijos me faltan por pagar este mes?"
]

const SECURITY = [
  `Te conectas con tu cuenta de ${SITE.info.name}: el agente inicia sesión por ti y solo ve tus datos.`,
  "Al autorizar eliges el acceso: Leer y escribir, o Solo lectura. Lo cambias cuando quieras.",
  `Toda escritura queda en el historial y se puede revertir durante ${SITE.mcp.undoWindowDays} días.`,
  "Revocas un agente desde Cuenta → Agentes IA y pierde el acceso en su siguiente llamada.",
  "El agente ve tus montos reales, aunque tengas activo Ocultar montos en la app.",
  "Lo que escribes en descripciones y notas llega al agente: no pegues ahí instrucciones de otras personas."
]

const CODE_CLASSES =
  "overflow-x-auto rounded-2xl bg-default p-4 font-mono text-sm leading-relaxed"

function ClientSteps() {
  const clients = [
    {
      name: "Claude",
      steps: [
        "Abre Ajustes → Conectores y elige agregar un conector personalizado.",
        "Pega la URL de arriba y guarda.",
        `Pulsa Conectar, inicia sesión en ${SITE.info.name} y elige el acceso.`
      ]
    },
    {
      name: "ChatGPT",
      steps: [
        "Abre Ajustes → Conectores (o Apps) y crea un conector nuevo.",
        "Pega la URL de arriba como dirección del servidor MCP.",
        `Inicia sesión en ${SITE.info.name} cuando te lo pida y autoriza.`
      ]
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {clients.map((client) => (
        <div
          key={client.name}
          className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-(--surface-shadow)"
        >
          <h3 className="text-lg font-semibold">{client.name}</h3>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-pretty text-muted">
            {client.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ))}

      <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-(--surface-shadow)">
        <h3 className="text-lg font-semibold">Claude Code</h3>
        <p className="text-muted">En tu terminal:</p>
        <pre className={CODE_CLASSES}>
          <code>{`claude mcp add --transport http tesoro ${MCP_RESOURCE_URL}`}</code>
        </pre>
        <p className="text-pretty text-muted">
          Luego escribe <code className="font-mono">/mcp</code> en Claude Code
          para iniciar sesión.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-(--surface-shadow)">
        <h3 className="text-lg font-semibold">Cursor</h3>
        <p className="text-muted">
          En <code className="font-mono">mcp.json</code>:
        </p>
        <pre className={CODE_CLASSES}>
          <code>
            {JSON.stringify(
              { mcpServers: { tesoro: { url: MCP_RESOURCE_URL } } },
              null,
              2
            )}
          </code>
        </pre>
      </div>
    </div>
  )
}

function ToolCatalog() {
  const catalog = getMcpCatalog()
  const groups = (
    Object.keys(MCP_GROUP_LABELS) as McpToolDefinition["group"][]
  ).map((group) => ({
    group,
    label: MCP_GROUP_LABELS[group],
    tools: catalog.filter((tool) => tool.group === group)
  }))

  return (
    <div className="flex flex-col gap-8">
      {groups.map(({ group, label, tools }) => (
        <div
          key={group}
          className="flex flex-col gap-3"
        >
          <h3 className="text-lg font-semibold">
            {label}{" "}
            <span className="text-sm font-normal text-muted">
              ({tools.length})
            </span>
          </h3>
          <dl className="flex flex-col divide-y divide-separator overflow-hidden rounded-3xl bg-surface shadow-(--surface-shadow)">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className="flex flex-col gap-1 px-5 py-4 md:grid md:grid-cols-[16rem_1fr] md:gap-6"
              >
                <dt className="flex flex-col gap-0.5">
                  <span className="font-medium">{tool.title}</span>
                  <code className="font-mono text-sm break-all text-muted">
                    {tool.name}
                  </code>
                </dt>
                <dd className="text-sm text-pretty text-muted">
                  {tool.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}

function Section({
  id,
  title,
  children
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-24 flex-col gap-6"
    >
      <h2
        id={`${id}-title`}
        className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

const LIST_CLASSES =
  "flex list-disc flex-col gap-2 pl-5 text-pretty text-muted marker:text-(--income)"

// Página pública del servidor MCP (SPEC 34): qué hace, la URL, cómo
// conectarla en cada cliente, el catálogo de tools y la seguridad
export default function McpPage() {
  return (
    <main>
      <JsonLd
        schema={buildBreadcrumbSchema([
          { label: "Inicio", href: SITE.routes.home },
          { label: "Agentes de IA", href: SITE.mcp.docsPath }
        ])}
      />
      <article className="mx-auto flex max-w-4xl flex-col gap-16 px-4 py-16 sm:px-6 sm:py-20">
        <header className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Conecta tu agente de IA a {SITE.info.name}
            </h1>
            <p className="text-base text-pretty text-muted sm:text-lg">
              Con una URL, Claude, ChatGPT u otro agente que hable MCP puede
              registrar tus movimientos y responder con tus cifras reales.
              Inicias sesión con tu cuenta y decides qué puede hacer.
            </p>
          </div>
          <McpUrlField
            url={MCP_RESOURCE_URL}
            label="URL del servidor MCP"
          />
        </header>

        <Section
          id="que-puede-hacer"
          title="Qué puede hacer tu agente"
        >
          <ul className={LIST_CLASSES}>
            {CAPABILITIES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>

        <Section
          id="como-conectarlo"
          title="Cómo conectarlo"
        >
          <ClientSteps />
          <p className="text-sm text-pretty text-muted">
            Los menús de cada aplicación cambian con el tiempo. Lo único fijo es
            la URL: busca la opción para agregar un servidor MCP remoto o un
            conector personalizado.
          </p>
        </Section>

        <Section
          id="ejemplos"
          title="Pídele cosas como"
        >
          <ul className="flex flex-col gap-2">
            {EXAMPLES.map((example) => (
              <li
                key={example}
                className="rounded-2xl bg-surface px-4 py-3 text-pretty shadow-(--surface-shadow)"
              >
                “{example}”
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="herramientas"
          title="Herramientas"
        >
          <p className="text-pretty text-muted">
            Lo que el agente puede usar. Las de escritura aceptan hasta{" "}
            {SITE.mcp.bulkLimit} filas por llamada, todo o nada, y una vista
            previa sin guardar.
          </p>
          <ToolCatalog />
        </Section>

        <Section
          id="seguridad"
          title="Seguridad y control"
        >
          <ul className={LIST_CLASSES}>
            {SECURITY.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Link
              href={SITE.routes.signUp}
              className={buttonVariants()}
            >
              Crear cuenta
            </Link>
            <Link
              href={MCP_AGENTS_PATH}
              className={buttonVariants({ variant: "secondary" })}
            >
              Ir a Agentes IA
            </Link>
          </div>
        </Section>
      </article>
    </main>
  )
}
