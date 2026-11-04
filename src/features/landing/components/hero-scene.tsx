"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

// Escena 3D del hero (SPEC 24): "cada registro suma". Cientos de bloques
// sueltos (tus registros) flotan desordenados y, al cargar, se ordenan solos
// hasta formar el cofre del isotipo de Tesoro (assets/brand/mark.svg). Luego
// el cofre respira y los bloques cercanos al puntero se apartan un poco.
// Colores desde los tokens; sin sombras ni postproceso. La carga la decide
// hero-scene-loader.tsx y `active` detiene el render fuera de pantalla.

// --- El cofre, en bloques ---------------------------------------------------
// Se muestrea el isotipo (lienzo de 64) cada 2 unidades: tapa redondeada,
// cuerpo y cerradura, con 3 capas de profundidad.
const STEP = 2
const SIZE = 0.17 // tamaño del bloque en el mundo
const UNIT = SIZE / STEP // unidades del isotipo → mundo
const LAYERS = 3

type Kind = "lid" | "body" | "lock" | "keyhole"
type Voxel = {
  target: THREE.Vector3
  start: THREE.Vector3
  kind: Kind
  delay: number
}

function insideLid(x: number, y: number) {
  if (x < 14 || x > 50 || y < 14 || y > 30) return false
  // Esquinas superiores redondeadas (radio 12)
  if (y < 26 && x < 26) return Math.hypot(x - 26, y - 26) <= 12
  if (y < 26 && x > 38) return Math.hypot(x - 38, y - 26) <= 12
  return true
}
const insideBody = (x: number, y: number) =>
  x >= 14 && x <= 50 && y >= 33 && y <= 50
const insideLock = (x: number, y: number) =>
  x >= 27 && x <= 37 && y >= 25 && y <= 37

// Pseudoaleatorio con semilla: la nube inicial es siempre la misma
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function buildVoxels(): Voxel[] {
  const rand = seeded(20261104)
  const voxels: Voxel[] = []
  for (let y = 14 + STEP / 2; y < 51; y += STEP) {
    for (let x = 14 + STEP / 2; x < 51; x += STEP) {
      const lock = insideLock(x, y)
      if (!insideLid(x, y) && !insideBody(x, y) && !lock) continue
      for (let layer = 0; layer < LAYERS; layer++) {
        // La cerradura ocupa la capa frontal y sobresale un poco
        const front = lock && layer === LAYERS - 1
        // El ojo de la cerradura: el centro de la placa en el tono del cuerpo
        const keyhole = front && Math.hypot(x - 32, y - 31) < 2.2
        const kind: Kind = keyhole
          ? "keyhole"
          : front
            ? "lock"
            : insideLid(x, y)
              ? "lid"
              : "body"
        const target = new THREE.Vector3(
          (x - 32) * UNIT,
          (32 - y) * UNIT,
          (layer - (LAYERS - 1) / 2) * SIZE + (front ? SIZE * 0.6 : 0)
        )
        // Nube inicial: una corona alrededor del cofre que cabe entera en
        // el lienzo, sin tocar los bordes difuminados
        const angle = rand() * Math.PI * 2
        const radius = 1.9 + rand() * 1.5
        const start = new THREE.Vector3(
          Math.cos(angle) * radius * 1.25,
          Math.sin(angle) * radius * 0.85,
          (rand() - 0.5) * 3
        )
        // Se ordenan de abajo hacia arriba, con un poco de azar
        const delay = ((50 - y) / 36) * 0.9 + rand() * 0.45
        voxels.push({ target, start, kind, delay })
      }
    }
  }
  return voxels
}

// --- Colores desde los tokens -------------------------------------------------
type Palette = { brand: THREE.Color; income: THREE.Color }

// Los tokens son oklch; un canvas 2D los pasa a sRGB para THREE.Color
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
    if (!ctx || !value) return new THREE.Color(fallback)
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = value
    ctx.fillRect(0, 0, 1, 1)
    const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data
    return new THREE.Color(`rgb(${r}, ${g}, ${b})`)
  }
  const palette = {
    brand: read("--brand", "#10b981"),
    income: read("--income", "#0f8a5f")
  }
  probe.remove()
  return palette
}

// Relee la paleta cuando cambia el tema (clase en <html>)
function usePalette() {
  const [palette, setPalette] = useState<Palette | null>(null)

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
const ASSEMBLE = 1.5 // segundos de vuelo de cada bloque
const FAR = 9 // puntero "fuera de la escena" hasta que se mueva

function Chest({ palette }: { palette: Palette }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const group = useRef<THREE.Group>(null)
  const voxels = useMemo(() => buildVoxels(), [])
  const start = useRef<number | null>(null)
  const pointer = useRef(new THREE.Vector2(FAR, FAR))
  const hit = useMemo(() => new THREE.Vector3(FAR, FAR, 0), [])
  const push = useMemo(() => new THREE.Vector3(), [])
  const offsets = useMemo(() => voxels.map(() => new THREE.Vector3()), [voxels])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const plane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    []
  )
  const { camera, gl } = useThree()

  // Colores por bloque: tapa más clara, cerradura casi blanca, y un leve
  // ruido de tono para que se lean como piezas sueltas
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const white = new THREE.Color(1, 1, 1)
    const colors: Record<Kind, THREE.Color> = {
      body: palette.income.clone().lerp(palette.brand, 0.35),
      lid: palette.brand.clone().lerp(white, 0.12),
      lock: palette.brand.clone().lerp(white, 0.82),
      keyhole: palette.income.clone().multiplyScalar(0.7)
    }
    const rand = seeded(7)
    voxels.forEach((voxel, i) => {
      m.setColorAt(
        i,
        colors[voxel.kind].clone().multiplyScalar(0.94 + rand() * 0.1)
      )
    })
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [palette, voxels])

  // Puntero relativo al canvas (−1 a 1); fuera del canvas se aleja
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect()
      pointer.current.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [gl])

  useFrame(({ clock }) => {
    const m = mesh.current
    const g = group.current
    if (!m || !g) return
    const t = clock.getElapsedTime()
    if (start.current === null) start.current = t
    const since = t - start.current
    const inside =
      Math.abs(pointer.current.x) <= 1 && Math.abs(pointer.current.y) <= 1

    // Punto del puntero sobre el plano del cofre, en coordenadas del grupo
    if (inside) {
      ray.setFromCamera(pointer.current, camera)
      if (ray.ray.intersectPlane(plane, hit)) g.worldToLocal(hit)
    } else {
      hit.set(FAR, FAR, 0)
    }

    voxels.forEach((voxel, i) => {
      const k = easeOut((since - 0.25 - voxel.delay) / ASSEMBLE)
      const offset = offsets[i]
      if (!offset) return
      // Repulsión suave alrededor del puntero, solo con el cofre armado
      const dx = voxel.target.x - hit.x
      const dy = voxel.target.y - hit.y
      const d = Math.hypot(dx, dy) || 1
      const force = k >= 1 && d < 0.6 ? (1 - d / 0.6) * 0.16 : 0
      push.set((dx / d) * force, (dy / d) * force, force * 0.9)
      offset.lerp(push, 0.12)
      dummy.position.lerpVectors(voxel.start, voxel.target, k).add(offset)
      const spin = (1 - k) * 2.4
      dummy.rotation.set(spin + i, spin * 0.7, spin * 0.4)
      dummy.scale.setScalar(0.55 + 0.45 * k)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true

    // Respiración y giro lento del conjunto, con parallax hacia el puntero
    const px = inside ? pointer.current.x : 0
    const py = inside ? pointer.current.y : 0
    g.position.y = Math.sin(t * 0.9) * 0.06
    g.rotation.y +=
      (-0.32 + Math.sin(t * 0.3) * 0.12 + px * 0.25 - g.rotation.y) * 0.04
    g.rotation.x += (0.12 - py * 0.08 - g.rotation.x) * 0.04
  })

  return (
    <group ref={group}>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, voxels.length]}
      >
        <boxGeometry args={[SIZE * 0.92, SIZE * 0.92, SIZE * 0.92]} />
        <meshStandardMaterial
          roughness={0.42}
          metalness={0.08}
        />
      </instancedMesh>
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
      camera={{ position: [0, 0.3, 7.4], fov: 34 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={() => requestAnimationFrame(onReady)}
      aria-hidden="true"
    >
      <ambientLight intensity={0.9} />
      <directionalLight
        position={[3, 5, 6]}
        intensity={1.7}
      />
      <directionalLight
        position={[-5, -1, 3]}
        intensity={0.45}
      />
      {palette && <Chest palette={palette} />}
    </Canvas>
  )
}
