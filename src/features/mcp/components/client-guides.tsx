"use client"

import { Tabs } from "@heroui/react"
import {
  AI_CLIENTS,
  AI_CLIENT_NAMES,
  type AiClient,
  AiLogo
} from "@/components/brand/ai-logos"
import { CopyButton } from "./copy-button"

interface Guide {
  steps: React.ReactNode[]
  code?: { label: string; value: string }
}

function guides(url: string, appName: string): Record<AiClient, Guide> {
  return {
    "claude": {
      steps: [
        "En Claude, abre Ajustes → Conectores.",
        "Elige agregar un conector personalizado y pega la URL.",
        `Pulsa Conectar, inicia sesión en ${appName} y elige el acceso.`
      ]
    },
    "chatgpt": {
      steps: [
        "En ChatGPT, abre Ajustes → Conectores (o Apps) y crea uno nuevo.",
        "Pega la URL como dirección del servidor MCP.",
        `Inicia sesión en ${appName} cuando te lo pida y autoriza.`
      ]
    },
    "claude-code": {
      steps: [
        "Agrega el servidor desde tu terminal:",
        <>
          Abre Claude Code, escribe <code className="font-mono">/mcp</code> y
          elige {appName} para iniciar sesión.
        </>
      ],
      code: {
        label: "Comando",
        value: `claude mcp add --transport http tesoro ${url}`
      }
    },
    "cursor": {
      steps: [
        <>
          Agrega el servidor en <code className="font-mono">mcp.json</code>{" "}
          (Ajustes de Cursor → MCP):
        </>,
        `Cursor te pedirá iniciar sesión en ${appName} la primera vez.`
      ],
      code: {
        label: "mcp.json",
        value: JSON.stringify({ mcpServers: { tesoro: { url } } }, null, 2)
      }
    }
  }
}

function CodeBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-surface-secondary">
      <div className="flex items-center justify-between gap-3 py-1.5 pr-1.5 pl-4">
        <span className="text-sm text-muted">{label}</span>
        <CopyButton
          value={value}
          label={`Copiar ${label.toLowerCase()}`}
          iconOnly
          variant="ghost"
        />
      </div>
      <pre className="overflow-x-auto px-4 pb-4 font-mono text-sm leading-relaxed">
        <code>{value}</code>
      </pre>
    </div>
  )
}

interface ClientGuidesProps {
  url: string
  appName: string
}

// Pasos para conectar cada cliente MCP, en pestañas con su logo. El paso con
// código va justo después de la frase que lo presenta
export function ClientGuides({ url, appName }: ClientGuidesProps) {
  const content = guides(url, appName)

  return (
    <Tabs defaultSelectedKey="claude">
      {/* En el teléfono, 2 × 2: cuatro nombres no caben en una fila */}
      <Tabs.ListContainer>
        <Tabs.List
          aria-label="Cliente"
          className="grid w-full grid-cols-2 rounded-3xl sm:flex sm:rounded-full"
        >
          {AI_CLIENTS.map((client) => (
            <Tabs.Tab
              key={client}
              id={client}
              className="min-h-11 flex-1 gap-2 px-4 whitespace-nowrap"
            >
              <AiLogo
                client={client}
                className="size-4"
              />
              {AI_CLIENT_NAMES[client]}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>

      {AI_CLIENTS.map((client) => {
        const guide = content[client]
        const [first, ...rest] = guide.steps
        return (
          <Tabs.Panel
            key={client}
            id={client}
            className="pt-5"
          >
            <ol className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-(--surface-shadow) sm:p-6">
              <Step number={1}>
                <p>{first}</p>
                {guide.code && <CodeBlock {...guide.code} />}
              </Step>
              {rest.map((step, index) => (
                <Step
                  key={index}
                  number={index + 2}
                >
                  <p>{step}</p>
                </Step>
              ))}
            </ol>
          </Tabs.Panel>
        )
      })}
    </Tabs>
  )
}

function Step({
  number,
  children
}: {
  number: number
  children: React.ReactNode
}) {
  return (
    <li className="grid grid-cols-[1.75rem_1fr] gap-3">
      <span
        aria-hidden="true"
        className="flex size-7 items-center justify-center rounded-full bg-default text-sm font-semibold tabular-nums"
      >
        {number}
      </span>
      <div className="flex min-w-0 flex-col gap-3 pt-0.5 text-pretty">
        {children}
      </div>
    </li>
  )
}
