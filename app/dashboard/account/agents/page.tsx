import { Suspense } from "react"
import type { Route } from "next"
import Link from "next/link"
import { buttonVariants } from "@heroui/react"
import { Bot, History } from "lucide-react"
import { CardSkeleton } from "@/components/dashboard/card-skeleton"
import { CardEmpty } from "@/components/dashboard/empty-state"
import { SITE } from "@/config/site"
import { AccountSection } from "@/features/account/components/account-section"
import { ConnectionsList } from "@/features/mcp/components/connections-list"
import { McpUrlField } from "@/features/mcp/components/mcp-url-field"
import { OperationsList } from "@/features/mcp/components/operations-list"
import { MCP_AGENTS_PATH } from "@/features/mcp/constants"
import { MCP_RESOURCE_URL } from "@/features/mcp/discovery"
import { getAgentConnections, getAgentOperations } from "@/features/mcp/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Cuenta · Agentes IA",
  path: MCP_AGENTS_PATH,
  noindex: true
})

// Cuenta → Agentes IA (SPEC 34): la URL del MCP, los agentes conectados con
// su acceso y el historial de lo que hicieron, con Revertir
export default function AccountAgentsPage() {
  return (
    <>
      <AccountSection
        title="Tu URL de MCP"
        description="Pégala en Claude, ChatGPT u otro agente para conectarlo a Tesoro. Te pedirá iniciar sesión y elegir su acceso."
      >
        <McpUrlField
          url={MCP_RESOURCE_URL}
          showGuideLink
        />
      </AccountSection>

      {/* La sesión es dinámica: va dentro de Suspense */}
      <Suspense
        fallback={
          <>
            <CardSkeleton className="h-48" />
            <CardSkeleton className="h-64" />
          </>
        }
      >
        <AgentsContent />
      </Suspense>
    </>
  )
}

async function AgentsContent() {
  const [connections, operations] = await Promise.all([
    getAgentConnections(),
    getAgentOperations()
  ])

  return (
    <>
      <AccountSection
        title="Agentes conectados"
        description="Cambia lo que puede hacer cada agente o revócale el acceso. El cambio aplica en su siguiente llamada."
      >
        {connections.length === 0 ? (
          <CardEmpty
            icon={Bot}
            message="Aún no has conectado ningún agente."
            action={
              <Link
                href={SITE.mcp.docsPath as Route}
                className={buttonVariants({ variant: "secondary" })}
              >
                Cómo conectarlo
              </Link>
            }
          />
        ) : (
          <ConnectionsList connections={connections} />
        )}
      </AccountSection>

      <AccountSection
        title="Historial"
        description={`Lo último que escribieron tus agentes. Puedes revertir una operación durante ${SITE.mcp.undoWindowDays} días.`}
      >
        {operations.length === 0 ? (
          <CardEmpty
            icon={History}
            message="Tus agentes aún no han hecho cambios."
          />
        ) : (
          <OperationsList operations={operations} />
        )}
      </AccountSection>
    </>
  )
}
