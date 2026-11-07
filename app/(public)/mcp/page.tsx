import Link from "next/link"
import { buttonVariants, cn } from "@heroui/react"
import {
  ArrowRightIcon,
  ChartColumnIcon,
  EyeIcon,
  KeyRoundIcon,
  ListChecksIcon,
  MessageSquareWarningIcon,
  PencilLineIcon,
  ShieldOffIcon,
  SlidersHorizontalIcon,
  Undo2Icon,
  WalletIcon
} from "lucide-react"
import { AI_CLIENTS } from "@/components/brand/ai-logos"
import { JsonLd } from "@/components/seo/JsonLd"
import { SITE } from "@/config/site"
import { RevealObserver } from "@/features/landing/components/reveal-observer"
import { MCP_GROUP_LABELS, getMcpCatalog } from "@/features/mcp/catalog"
import { AgentClients } from "@/features/mcp/components/agent-clients"
import { AgentDemoVideo } from "@/features/mcp/components/agent-demo-video"
import { ClientGuides } from "@/features/mcp/components/client-guides"
import { CopyButton } from "@/features/mcp/components/copy-button"
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

const SECTIONS = [
  { id: "conectar", title: "Cómo conectarlo" },
  { id: "que-puede-hacer", title: "Qué puede hacer" },
  { id: "ideas", title: "Ideas para empezar" },
  { id: "seguridad", title: "Seguridad y control" },
  { id: "herramientas", title: "Herramientas" }
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

const CAPABILITIES = [
  {
    icon: PencilLineIcon,
    title: "Registrar",
    text: "Ingresos, gastos y traspasos, de uno en uno o hasta 200 a la vez."
  },
  {
    icon: ChartColumnIcon,
    title: "Responder con tus cifras",
    text: "Resumen del mes, reportes por periodo, flujo de caja, score y recomendaciones."
  },
  {
    icon: ListChecksIcon,
    title: "Corregir en lote",
    text: "Cambiar categoría, fecha o cuenta de muchos movimientos, con vista previa antes de guardar."
  },
  {
    icon: WalletIcon,
    title: "Leer todo tu plan",
    text: "Cuentas, presupuestos, metas, deudas, fijos y lo que te deben, en Personal y en Empresa."
  }
]

const IDEAS = [
  "Registra el almuerzo de hoy, 32.000 en Nequi.",
  "¿Cuánto gasté en comida este mes comparado con octubre?",
  "Pasa a Transporte todos los movimientos de Uber de noviembre.",
  "¿Cómo va mi score y qué me recomienda Tesoro?",
  "¿Qué gastos fijos me faltan por pagar este mes?"
]

const SECURITY = [
  {
    icon: KeyRoundIcon,
    text: `Inicias sesión con tu cuenta de ${SITE.info.name}: el agente solo ve tus datos.`
  },
  {
    icon: SlidersHorizontalIcon,
    text: "Eliges el acceso al autorizar, Leer y escribir o Solo lectura, y lo cambias cuando quieras."
  },
  {
    icon: Undo2Icon,
    text: `Toda escritura queda en el historial y se revierte durante ${SITE.mcp.undoWindowDays} días.`
  },
  {
    icon: ShieldOffIcon,
    text: "Revocas un agente en Cuenta → Agentes IA y pierde el acceso en su siguiente llamada."
  },
  {
    icon: EyeIcon,
    text: "El agente ve tus montos reales, aunque tengas activo Ocultar montos en la app."
  },
  {
    icon: MessageSquareWarningIcon,
    text: "Lo que escribes en descripciones y notas llega al agente: no pegues ahí instrucciones de otras personas."
  }
]

function Section({
  id,
  description,
  children
}: {
  id: SectionId
  description?: string
  children: React.ReactNode
}) {
  const title = SECTIONS.find((section) => section.id === id)?.title
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-24 flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <h2
          id={`${id}-title`}
          className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
        >
          {title}
        </h2>
        {description && (
          <p className="max-w-2xl text-pretty text-muted">{description}</p>
        )}
      </div>
      {children}
    </section>
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
          <h3 className="flex items-baseline gap-2 text-lg font-semibold">
            {label}
            <span className="text-sm font-normal text-muted tabular-nums">
              {tools.length}
            </span>
          </h3>
          <dl className="flex flex-col divide-y divide-separator overflow-hidden rounded-3xl bg-surface shadow-(--surface-shadow)">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className="flex flex-col gap-1.5 px-5 py-4 md:grid md:grid-cols-[13rem_1fr] md:gap-6"
              >
                <dt className="flex flex-col gap-1">
                  <span className="font-medium">{tool.title}</span>
                  <code className="self-start rounded-md bg-default px-1.5 py-0.5 font-mono text-xs break-all text-muted">
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

// Página pública del servidor MCP (SPEC 34): qué hace, la URL, cómo
// conectarlo en cada cliente, ideas, seguridad y el catálogo de tools
export default function McpPage() {
  return (
    <main>
      <RevealObserver />
      <JsonLd
        schema={buildBreadcrumbSchema([
          { label: "Inicio", href: SITE.routes.home },
          { label: "Agentes de IA", href: SITE.mcp.docsPath }
        ])}
      />

      <header className="mx-auto grid max-w-6xl gap-12 px-4 pt-16 pb-12 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16 lg:pb-20">
        <div className="flex min-w-0 flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Conecta tu agente de IA a {SITE.info.name}
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted">
              Con una URL, tu agente registra movimientos y responde con tus
              cifras reales. Inicias sesión con tu cuenta y decides qué puede
              hacer.
            </p>
          </div>
          <AgentClients clients={AI_CLIENTS} />
          <McpUrlField
            url={MCP_RESOURCE_URL}
            label="URL del servidor MCP"
          />
        </div>
        <AgentDemoVideo />
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-20 sm:px-6 sm:pb-24 lg:grid-cols-[13rem_1fr] lg:gap-16">
        <nav
          aria-label="En esta página"
          className="hidden lg:sticky lg:top-24 lg:block lg:self-start"
        >
          <p className="mb-3 text-sm font-medium">En esta página</p>
          <ol className="flex flex-col gap-1 border-l border-separator text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="-ml-px flex min-h-9 items-center border-l-2 border-transparent pl-4 text-muted transition-colors hover:border-(--income) hover:text-foreground focus-visible:text-foreground"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex min-w-0 flex-col gap-20">
          <Section
            id="conectar"
            description="Elige tu cliente. Lo único fijo es la URL: si los menús de tu app cambian, busca la opción para agregar un servidor MCP remoto o un conector personalizado."
          >
            <ClientGuides
              url={MCP_RESOURCE_URL}
              appName={SITE.info.name}
            />
          </Section>

          <Section id="que-puede-hacer">
            <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {CAPABILITIES.map(({ icon: Icon, title, text }) => (
                <li
                  key={title}
                  className="flex flex-col gap-2"
                >
                  <Icon
                    aria-hidden="true"
                    className="size-5 text-(--income)"
                  />
                  <p className="font-semibold">{title}</p>
                  <p className="text-pretty text-muted">{text}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            id="ideas"
            description="Cópialas tal cual o cámbialas a tu manera: el agente entiende lenguaje natural."
          >
            <ul className="flex flex-col divide-y divide-separator overflow-hidden rounded-3xl bg-surface shadow-(--surface-shadow)">
              {IDEAS.map((idea) => (
                <li
                  key={idea}
                  className="flex items-center justify-between gap-3 py-2 pr-2 pl-5"
                >
                  <span className="text-pretty">{idea}</span>
                  <CopyButton
                    value={idea}
                    label="Copiar pedido"
                    iconOnly
                    variant="ghost"
                  />
                </li>
              ))}
            </ul>
          </Section>

          <Section id="seguridad">
            <ul className="flex flex-col gap-5">
              {SECURITY.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex gap-4"
                >
                  <Icon
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-muted"
                  />
                  <p className="text-pretty">{text}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            id="herramientas"
            description={`Lo que el agente puede usar. Las de escritura aceptan hasta ${SITE.mcp.bulkLimit} filas por llamada, todo o nada, con vista previa sin guardar. Con Solo lectura, el agente solo ve las de lectura.`}
          >
            <ToolCatalog />
          </Section>

          <section
            aria-labelledby="mcp-cta-title"
            className="flex flex-col gap-6 rounded-3xl bg-surface p-6 shadow-(--surface-shadow) sm:p-8"
          >
            <div className="flex flex-col gap-2">
              <h2
                id="mcp-cta-title"
                className="text-2xl font-semibold tracking-tight text-balance"
              >
                Empieza con tu cuenta de {SITE.info.name}
              </h2>
              <p className="max-w-xl text-pretty text-muted">
                Crea tu cuenta y conecta tu agente. Si ya la tienes, revisa tus
                agentes y su historial en Cuenta → Agentes IA.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={SITE.routes.signUp}
                className={cn(buttonVariants({ size: "lg" }), "group")}
              >
                Crear cuenta
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </Link>
              <Link
                href={MCP_AGENTS_PATH}
                className={buttonVariants({ size: "lg", variant: "tertiary" })}
              >
                Ir a Agentes IA
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
