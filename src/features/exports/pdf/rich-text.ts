import htmlToPdfmake from "html-to-pdfmake"
import { JSDOM } from "jsdom"
import type { Content } from "pdfmake/interfaces"
import { SITE } from "@/config/site"
import type { PdfTheme } from "./theme"

// HTML a PDF (SPEC 33), solo para textos de Tesoro: introducción de la
// portada, recomendaciones del score y notas explicativas de secciones. Las
// notas y descripciones del usuario NUNCA pasan por aquí: van como texto
// plano de pdfmake.
//
// Antes de convertir, el HTML pasa por una lista de etiquetas permitidas:
// cualquier otra se elimina con su contenido, todos los atributos se quitan
// salvo `href` en `a`, y un `a` con un destino que no sea https: o del
// propio sitio queda como texto.

const ALLOWED_TAGS = new Set(["P", "STRONG", "EM", "UL", "OL", "LI", "BR", "A"])

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}

/** Escapa un valor (monto, nombre de categoría o de meta) antes de entrar al HTML */
export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char])
}

/**
 * Plantilla que escapa cada valor interpolado:
 * html`<p>Gastaste <strong>${monto}</strong> en ${categoria}</p>`
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]) {
  return strings.reduce(
    (result, chunk, index) =>
      result +
      chunk +
      (index < values.length ? escapeHtml(String(values[index])) : ""),
    ""
  )
}

function isAllowedHref(href: string) {
  try {
    const url = new URL(href, SITE.site.url)
    return (
      url.protocol === "https:" || url.origin === new URL(SITE.site.url).origin
    )
  } catch {
    return false
  }
}

// Una sola ventana de jsdom por proceso: crearla cuesta más que convertir.
// Con las opciones por defecto, jsdom no ejecuta scripts ni carga recursos:
// `innerHTML` solo arma el árbol que `sanitize` filtra
let dom: JSDOM | null = null

function getWindow() {
  dom ??= new JSDOM("")
  return dom.window
}

function sanitize(element: Element) {
  for (const child of [...element.children]) {
    if (!ALLOWED_TAGS.has(child.tagName)) {
      child.remove()
      continue
    }

    const href = child.tagName === "A" ? child.getAttribute("href") : null
    for (const attribute of [...child.attributes]) {
      child.removeAttribute(attribute.name)
    }

    if (child.tagName === "A") {
      if (href && isAllowedHref(href)) {
        child.setAttribute("href", new URL(href, SITE.site.url).toString())
      } else {
        child.replaceWith(...child.childNodes)
        continue
      }
    }

    sanitize(child)
  }
}

/** Convierte HTML de Tesoro en contenido de pdfmake con los estilos del tema */
export function richText(source: string, theme: PdfTheme): Content {
  const window = getWindow()
  const container = window.document.createElement("div")
  container.innerHTML = source
  sanitize(container)

  const content = htmlToPdfmake(container.innerHTML, {
    window,
    removeExtraBlanks: true,
    defaultStyles: {
      p: { margin: [0, 0, 0, 6], lineHeight: 1.3 },
      ul: { margin: [0, 0, 0, 6] },
      ol: { margin: [0, 0, 0, 6] },
      li: { margin: [0, 0, 0, 2] },
      a: { color: theme.accentDark, decoration: "underline" }
    }
  })

  // @types/html-to-pdfmake declara su salida con @types/pdfmake 0.2; la
  // forma es la misma que la de 0.3
  return content as unknown as Content
}
