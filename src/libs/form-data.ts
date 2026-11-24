/**
 * Lee los campos de texto de un `FormData`. Un campo ausente o que no es
 * texto (un archivo) queda como "". Las actions lo devuelven en `values`
 * para no vaciar el formulario si hay error.
 */
export function readFormValues<const T extends readonly string[]>(
  formData: FormData,
  fields: T
) {
  return Object.fromEntries(
    fields.map((key) => {
      const value = formData.get(key)
      return [key, typeof value === "string" ? value : ""]
    })
  ) as Record<T[number], string>
}
