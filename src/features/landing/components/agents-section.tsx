import type { Route } from "next"
import Link from "next/link"
import { buttonVariants, cn } from "@heroui/react"
import { ArrowRightIcon } from "lucide-react"
import { SITE } from "@/config/site"
import { McpUrlField } from "@/features/mcp/components/mcp-url-field"
import { MCP_RESOURCE_URL } from "@/features/mcp/discovery"
import { Reveal, RevealItem, RevealList } from "./reveal"
import { SectionHeading } from "./section-heading"

const COPY = SITE.landing.agents

// Agentes de IA (SPEC 34): tres pedidos de ejemplo, los clientes en texto,
// la URL copiable y el enlace a la guía /mcp
export function AgentsSection() {
  return (
    <section
      id="agentes"
      aria-labelledby="agentes-title"
      className="scroll-mt-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading
          id="agentes-title"
          title={COPY.title}
          description={COPY.description}
        />

        <RevealList className="grid gap-4 md:grid-cols-3">
          {COPY.examples.map((example) => (
            <RevealItem
              key={example.label}
              className="flex flex-col gap-3 rounded-3xl bg-surface p-6 shadow-(--surface-shadow)"
            >
              <p className="text-sm font-medium text-muted">{example.label}</p>
              <p className="text-lg text-pretty">“{example.prompt}”</p>
            </RevealItem>
          ))}
        </RevealList>

        <Reveal className="flex flex-col gap-6 rounded-3xl bg-surface p-6 shadow-(--surface-shadow) sm:p-8">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Funciona con</p>
            <ul className="flex flex-wrap gap-2 text-sm">
              {COPY.clients.map((client) => (
                <li
                  key={client}
                  className="rounded-full bg-default px-3 py-1.5"
                >
                  {client}
                </li>
              ))}
              <li className="rounded-full px-3 py-1.5 text-muted">
                y otros agentes MCP
              </li>
            </ul>
          </div>
          <McpUrlField
            url={MCP_RESOURCE_URL}
            label="URL del servidor MCP"
          />
          <Link
            href={SITE.mcp.docsPath as Route}
            className={cn(buttonVariants(), "self-start")}
          >
            {COPY.cta}
            <ArrowRightIcon
              aria-hidden="true"
              className="size-4"
            />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
