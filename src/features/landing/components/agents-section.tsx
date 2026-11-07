import type { Route } from "next"
import Link from "next/link"
import { buttonVariants, cn } from "@heroui/react"
import { ArrowRightIcon } from "lucide-react"
import { AI_CLIENTS } from "@/components/brand/ai-logos"
import { SITE } from "@/config/site"
import { AgentClients } from "@/features/mcp/components/agent-clients"
import { AgentDemoVideo } from "@/features/mcp/components/agent-demo-video"
import { McpUrlField } from "@/features/mcp/components/mcp-url-field"
import { MCP_RESOURCE_URL } from "@/features/mcp/discovery"
import { Reveal } from "./reveal"
import { SectionHeading } from "./section-heading"

const COPY = SITE.landing.agents

// Agentes de IA (SPEC 34): a la izquierda qué es, con qué funciona y la URL;
// a la derecha el video de una conversación real de agente con Tesoro
// (piensa, usa las tools del MCP, responde y registra un movimiento)
export function AgentsSection() {
  return (
    <section
      id="agentes"
      aria-labelledby="agentes-title"
      className="scroll-mt-16"
    >
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16">
        <div className="flex min-w-0 flex-col gap-10">
          <SectionHeading
            id="agentes-title"
            title={COPY.title}
            description={COPY.description}
          />

          <Reveal className="flex flex-col gap-4">
            <p className="text-sm font-medium text-muted">Funciona con</p>
            <AgentClients clients={AI_CLIENTS} />
          </Reveal>

          <Reveal className="flex flex-col gap-6">
            <McpUrlField
              url={MCP_RESOURCE_URL}
              label="URL del servidor MCP"
            />
            <Link
              href={SITE.mcp.docsPath as Route}
              className={cn(buttonVariants({ size: "lg" }), "group self-start")}
            >
              {COPY.cta}
              <ArrowRightIcon
                aria-hidden="true"
                className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </Link>
          </Reveal>
        </div>

        {/* En el teléfono, el visual va primero (DESIGN.md) */}
        <AgentDemoVideo className="order-first lg:order-none" />
      </div>
    </section>
  )
}
