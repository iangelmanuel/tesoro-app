// Une clases condicionales sin traer tailwind-merge: para componentes cliente
// de la landing, donde cada KB de JS cuenta (SPEC 24). Úsalo solo cuando las
// clases no se pisan entre sí; si se pisan, usa `cn` de HeroUI.
export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
