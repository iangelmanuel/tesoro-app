/**
 * Redondea un monto a centavos. Los montos se suman y restan en JS: así no
 * se arrastra el error de punto flotante (0.1 + 0.2 → 0.3).
 */
export function roundCents(value: number) {
  return Math.round(value * 100) / 100
}
