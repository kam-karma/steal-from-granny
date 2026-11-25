import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Model keys: "k:name" = Kenney Furniture Kit (.glb), "y:name" = KayKit Furniture Bits (.gltf).
 * Every model is normalised once: scaled to house size, centred on x/z, standing on y = 0, front towards +z.
 */
export type ModelKey = `k:${string}` | `y:${string}`

const SCALE = { k: 2.1, y: 0.8 } as const
const templates = new Map<ModelKey, THREE.Group>()
const sizes = new Map<ModelKey, THREE.Vector3>()
const loader = new GLTFLoader()

function url(key: ModelKey): string {
  const [pack, name] = key.split(':') as ['k' | 'y', string]
  return pack === 'k' ? `models/kenney/${name}.glb` : `models/kaykit/${name}.gltf`
}

function normalise(key: ModelKey, scene: THREE.Object3D, turn: number): THREE.Group {
  const pack = key[0] as 'k' | 'y'
  const inner = new THREE.Group()
  inner.add(scene)
  inner.scale.setScalar(SCALE[pack])
  inner.rotation.y = turn
  inner.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(inner)
  const c = box.getCenter(new THREE.Vector3())
  inner.position.set(-c.x, -box.min.y, -c.z)
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) {
      m.castShadow = true
      m.receiveShadow = true
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) {
        const sm = mat as THREE.MeshStandardMaterial
        if (sm.isMeshStandardMaterial) {
          sm.roughness = Math.min(sm.roughness, 0.75)
          if (sm.map) sm.map.anisotropy = 4
        }
      }
    }
  })
  const root = new THREE.Group()
  root.add(inner)
  sizes.set(key, box.getSize(new THREE.Vector3()))
  return root
}

/** Some packs model the front of a thing towards -z or a side; turn them so every front faces +z. */
const TURN: Partial<Record<ModelKey, number>> = {}

export function setTurn(key: ModelKey, turn: number): void {
  TURN[key] = turn
}

export async function loadModels(keys: readonly ModelKey[], onProgress?: (k: number) => void): Promise<void> {
  const todo = [...new Set(keys)].filter((k) => !templates.has(k))
  let done = 0
  await Promise.all(
    todo.map(async (key) => {
      try {
        const gltf = await loader.loadAsync(url(key))
        templates.set(key, normalise(key, gltf.scene, TURN[key] ?? 0))
      } catch (error) {
        console.error(`Model could not load: ${key}`, error)
        templates.set(key, fallback())
        sizes.set(key, new THREE.Vector3(0.6, 0.6, 0.6))
      }
      done++
      onProgress?.(done / todo.length)
    }),
  )
}

function fallback(): THREE.Group {
  const g = new THREE.Group()
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0xff00ff }))
  m.position.y = 0.3
  g.add(m)
  return g
}

/** A fresh copy of a loaded model (geometry and materials are shared). */
export function model(key: ModelKey): THREE.Group {
  const t = templates.get(key)
  if (t === undefined) throw new Error(`Model not loaded: ${key}`)
  return t.clone(true)
}

export function modelSize(key: ModelKey): THREE.Vector3 {
  return sizes.get(key) ?? new THREE.Vector3(0.6, 0.6, 0.6)
}
