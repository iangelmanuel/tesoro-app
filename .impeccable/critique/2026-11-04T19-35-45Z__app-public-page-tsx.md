---
target: landing app/(public)/page.tsx
total_score: 22
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\IAnge\\Desktop\\dev\\tesoro-app\\app\\(public)\\page.tsx"
target_fingerprint: "sha256:9ac75102e8dde75a4fce448c7c56f8a1435374b3770789353e5340619f72476b"
target_path: "C:\\Users\\IAnge\\Desktop\\dev\\tesoro-app\\app\\(public)\\page.tsx"
timestamp: 2026-11-04T19-35-45Z
slug: app-public-page-tsx
---
# Critique: landing de Tesoro (/)
Method: dual-agent (A: revisión de diseño · B: detector + navegador)

## Salud de diseño (Persuade): 22/32
1 Visibilidad 3 (barras/medidor ligados al scroll muestran estados intermedios engañosos) · 2 Mundo real 3 (jerga: Colchón, Utilización, se reescalan) · 3 Control 3 · 4 Consistencia 2 (paleta cruda Tailwind, bordes en tarjetas, 3 primarios) · 5 Errores 3 · 6 Reconocimiento 3 · 7 n/a · 8 Estética 2 (repetición, clips ilegibles, 9.340 px en móvil) · 9 Recuperación 3 · 10 n/a

## Especificidad
Mayormente intercambiable; solo el video demo y el score transparente son de Tesoro. Detector (URL): icon-tile-stack ×6 (features.tsx:58), radial-halo/spotlight (hero.tsx:17, demo-player.tsx:72), straggler ×5, nested-cards ×4 (mockup móvil). Falsos positivos: overused-font, scrim del play, nested-cards del mockup.

## Problemas prioritarios
1. [P1] Patrones prohibidos por el spec vivos: eyebrows ×5, íconos en cuadro, rejilla de 6 tarjetas iguales, degradado del hero, titulares en fórmula. → distill, bolder
2. [P1] score-visual.tsx y sección Score: barras/medidor scroll-linked engañosos, barras vs MAX_WEIGHT, paleta cruda, medidor azul, rojo alarmista. Rediseño: medidor con bandas segmentadas, barra segmentada a 100, whileInView, tone.ts. → shape, colorize
3. [P1] Clips ilegibles (~300 px). Mostrarlos grandes (≥560 px) con selector. → layout
4. [P2] Hero y cierre sin identidad: H1 de 4 líneas, escena 3D genérica (rojo puro, bandeja gris), cierre genérico. → bolder, delight
5. [P2] Demasiados primarios y página larga: Código abierto primario, header con 9 items, "Cómo funciona" redundante, huecos de revelado en móvil. → distill, adapt

## Personas
Jordan: jerga, bandas sin acción, "gratis" poco visible. Riley: "no conecta bancos" enterrado, barras que no cuadran, 72 vs 93. Casey: huecos, video diminuto, ~11 pantallas, 3 botones grandes de código abierto.

## Menores
Bordes en tarjetas; hex del reproductor sin token; mancha del degradado en claro; Empresa repite items; mockups sin "Datos de ejemplo"; comentario viejo en hero-visual; THREE.Clock obsoleto; straggler → text-wrap: pretty.

## Preguntas
¿Escena 3D = cofre del logo? ¿7 pesos o un ejemplo interactivo? ¿Una landing que alguien en Bogotá reconozca como suya?
