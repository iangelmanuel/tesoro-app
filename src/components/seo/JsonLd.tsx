type Schema = Record<string, unknown>

interface JsonLdProps {
  schema: Schema | Schema[]
}

export function JsonLd({ schema }: JsonLdProps) {
  const schemas = Array.isArray(schema) ? schema : [schema]

  return schemas.map((item, index) => (
    <script
      key={`schema-${index}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(item).replace(/</g, "\\u003c")
      }}
    />
  ))
}
