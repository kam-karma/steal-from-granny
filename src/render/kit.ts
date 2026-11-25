import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

const cache = new Map<string, THREE.MeshStandardMaterial>()

/** Shared toy-like materials, cached by colour and options. */
export function mat(color: number, rough = 0.6, metal = 0, emissive = 0, emissiveIntensity = 0): THREE.MeshStandardMaterial {
  const key = `${color}-${rough}-${metal}-${emissive}-${emissiveIntensity}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity })
  cache.set(key, m)
  return m
}

export const GOLD = (): THREE.MeshStandardMaterial => mat(0xffc93a, 0.25, 0.85, 0xff9a00, 0.35)

export function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true
      c.receiveShadow = true
    }
  })
  return o
}

export function rbox(w: number, h: number, d: number, m: THREE.Material, r = 0.06): THREE.Mesh {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), m)
  return mesh
}

export function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z)
  return o
}

export function cyl(rt: number, rb: number, h: number, m: THREE.Material, seg = 20): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m)
}

export function ball(r: number, m: THREE.Material, seg = 20): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.75))), m)
}

export function group(...kids: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group()
  for (const k of kids) g.add(k)
  return g
}
