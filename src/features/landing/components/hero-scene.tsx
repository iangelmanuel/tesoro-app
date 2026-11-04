"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

// Escena 3D del hero (SPEC 24): las mismas barras de ingresos y gastos del
// mockup, sobre una bandeja, con la línea de balance encima. Colores desde los
// tokens del tema; sin sombras ni postproceso. La carga la decide
// hero-scene-loader.tsx (solo escritorio, sin reduced motion ni ahorro de
// datos) y `active` detiene el render cuando el hero sale de pantalla.

const MONTHS = [
  { income: 3.6, expense: 3.3 },
  { income: 3.8, expense: 3.5 },
  { income: 3.7, expense: 3.0 },
  { income: 4.0, expense: 3.4 },
  { income: 4.1, expense: 3.2 },
  { income: 4.2, expense: 3.15 }
]
const MAX = Math.max(...MONTHS.map((item) => item.income))
const HEIGHT = 2.1
const STEP = 1
const BAR = 0.32

type Palette = Record<"income" | "expense" | "balance" | "surface", string>

const EMPTY: Palette = {
  income: "#0f8a5f",
  expense: "#d62f45",
  balance: "#3b7be0",
  surface: "#1d1e22"
}

// Los tokens son oklch; un canvas 2D los pasa a sRGB, que es lo que entiende
// THREE.Color
function readPalette(): Palette {
  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  const probe = document.createElement("span")
  document.body.appendChild(probe)
  const read = (token: string, fallback: string) => {
    probe.style.color = `var(${token})`
    const value = getComputedStyle(probe).color
    if (!ctx || !value) return fallback
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = value
    ctx.fillRect(0, 0, 1, 1)
    const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data
    return `rgb(${r}, ${g}, ${b})`
  }
  const palette = {
    income: read("--income", EMPTY.income),
    expense: read("--expense", EMPTY.expense),
    balance: read("--balance", EMPTY.balance),
    surface: read("--surface", EMPTY.surface)
  }
  probe.remove()
  return palette
}

// Relee la paleta cuando cambia el tema (clase en <html>)
function usePalette() {
  const [palette, setPalette] = useState<Palette>(EMPTY)

  useEffect(() => {
    const update = () => setPalette(readPalette())
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"]
    })
    return () => observer.disconnect()
  }, [])

  return palette
}

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

function Bars({ palette }: { palette: Palette }) {
  const group = useRef<THREE.Group>(null)
  const bars = useRef<THREE.Mesh[]>([])
  const pointer = useRef({ x: 0, y: 0 })
  const start = useRef<number | null>(null)

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: (event.clientY / window.innerHeight) * 2 - 1
      }
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [])

  // Una geometría por barra, con el origen en la base para crecer hacia arriba
  const geometries = useMemo(
    () =>
      MONTHS.flatMap((item) =>
        [item.income, item.expense].map((value) => {
          const h = (value / MAX) * HEIGHT
          return new THREE.BoxGeometry(BAR, h, BAR).translate(0, h / 2, 0)
        })
      ),
    []
  )

  const balanceLine = useMemo(() => {
    const points = MONTHS.map(
      (item, i) =>
        new THREE.Vector3(
          (i - (MONTHS.length - 1) / 2) * STEP,
          ((item.income - item.expense) / MAX) * HEIGHT * 2.2 + 0.6,
          0.42
        )
    )
    const curve = new THREE.CatmullRomCurve3(points)
    return new THREE.TubeGeometry(curve, 96, 0.035, 8, false)
  }, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (start.current === null) start.current = t
    const since = t - start.current

    // Entrada: cada barra crece escalonada
    bars.current.forEach((mesh, i) => {
      if (!mesh) return
      const k = easeOut((since - i * 0.06) / 1.1)
      mesh.scale.y = Math.max(0.001, k)
    })

    // Balanceo lento + parallax suave hacia el puntero
    const g = group.current
    if (g) {
      const targetY =
        -0.24 + Math.sin(t * 0.35) * 0.05 + pointer.current.x * 0.16
      const targetX = 0.18 + pointer.current.y * 0.06
      g.rotation.y += (targetY - g.rotation.y) * 0.05
      g.rotation.x += (targetX - g.rotation.x) * 0.05
    }
  })

  let index = 0
  return (
    <group
      ref={group}
      position={[0, -0.9, 0]}
    >
      {/* Bandeja */}
      <mesh position={[0, -0.07, 0]}>
        <boxGeometry args={[MONTHS.length * STEP + 0.6, 0.14, 1.5]} />
        <meshStandardMaterial
          color={palette.surface}
          roughness={0.55}
          metalness={0.05}
        />
      </mesh>

      {MONTHS.map((item, i) => {
        const x = (i - (MONTHS.length - 1) / 2) * STEP
        return [
          { value: item.income, color: palette.income, dx: -0.19 },
          { value: item.expense, color: palette.expense, dx: 0.19 }
        ].map((bar) => {
          const n = index++
          return (
            <mesh
              key={`${i}-${bar.dx}`}
              ref={(mesh) => {
                if (mesh) bars.current[n] = mesh
              }}
              position={[x + bar.dx, 0, 0]}
              geometry={geometries[n]}
            >
              <meshStandardMaterial
                color={bar.color}
                roughness={0.35}
                metalness={0.1}
              />
            </mesh>
          )
        })
      })}

      {/* Línea de balance */}
      <mesh geometry={balanceLine}>
        <meshStandardMaterial
          color={palette.balance}
          emissive={palette.balance}
          emissiveIntensity={0.25}
          roughness={0.4}
        />
      </mesh>
    </group>
  )
}

export default function HeroScene({
  active,
  onReady
}: {
  active: boolean
  onReady: () => void
}) {
  const palette = usePalette()

  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 2]}
      camera={{ position: [0, 2.3, 9.4], fov: 34 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ camera }) => {
        camera.lookAt(0, 0.2, 0)
        requestAnimationFrame(onReady)
      }}
      aria-hidden="true"
    >
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[4, 6, 5]}
        intensity={1.6}
      />
      <directionalLight
        position={[-5, 2, -3]}
        intensity={0.5}
      />
      <Bars palette={palette} />
    </Canvas>
  )
}
