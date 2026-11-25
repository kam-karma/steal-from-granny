import * as THREE from 'three'
import { WALL_PIECES } from '../sim/geom'
import { DOOR_W, DOORS, FURNITURE, HOUSE, ROOMS, WINDOW } from '../sim/layout'
import type { Vec } from '../sim/types'
import { at, cyl, mat, rbox, shadowed } from './kit'
import { model, type ModelKey } from './models'
import { bathTiles, carpet, grass, kitchenTiles, nightSky, parquet, wallpaper, woodFloor } from './textures'

const H = HOUSE.wallH
const T = 0.24
const LOW = 0.32

export const HOUSE_MODELS: readonly ModelKey[] = [...new Set(FURNITURE.filter((f) => f.hidden !== true).map((f) => f.model as ModelKey))]

const FLOORS = [kitchenTiles, woodFloor, () => carpet('#c98fb0'), bathTiles, parquet, () => carpet('#7fa7d9'), woodFloor]
const PAPERS: Array<[string, string, 'stripes' | 'dots' | 'diamonds' | 'stars']> = [
  ['#f3e3b5', '#e8cf8f', 'diamonds'],
  ['#9fc7d8', '#b6d6e3', 'stripes'],
  ['#f4c6c6', '#f9dede', 'dots'],
  ['#cfe8f3', '#ffffff', 'diamonds'],
  ['#cfe3c0', '#bcd6a8', 'stripes'],
  ['#fff1a8', '#ffd54f', 'stars'],
  ['#3f6b5a', '#4f7d6a', 'stripes'],
]

function floors(scene: THREE.Scene): void {
  ROOMS.forEach((r, i) => {
    const tex = FLOORS[i]()
    tex.repeat.set((r.x1 - r.x0) / 3, (r.z1 - r.z0) / 3)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }))
    m.rotation.x = -Math.PI / 2
    m.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2)
    m.receiveShadow = true
    scene.add(m)
  })
  const g = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: grass(), roughness: 1 }))
  g.rotation.x = -Math.PI / 2
  g.position.y = -0.35
  g.receiveShadow = true
  scene.add(g)
  scene.add(at(rbox(HOUSE.maxX - HOUSE.minX + 1, 0.36, HOUSE.maxZ - HOUSE.minZ + 1, mat(0xd9c7a8, 0.9), 0.05), 0, -0.2, 0))
  // Stepping stones to the kitchen window, where the jelly comes in.
  for (let k = 0; k < 5; k++) {
    const s = cyl(0.42, 0.45, 0.1, mat(0x9e9e9e, 0.9), 16)
    s.position.set(WINDOW.x - 1.4 - k * 1.3, -0.3, WINDOW.z + Math.sin(k) * 0.5)
    s.receiveShadow = true
    scene.add(s)
  }
}

/** Which room a wall face looks into, so it gets that room's wallpaper. */
function paperFor(x: number, z: number): THREE.Material {
  const i = ROOMS.findIndex((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)
  const [base, accent, kind] = PAPERS[Math.max(0, i)]
  return paperMat(base, accent, kind)
}
const paperCache = new Map<string, THREE.Material>()
function paperMat(base: string, accent: string, kind: 'stripes' | 'dots' | 'diamonds' | 'stars'): THREE.Material {
  const key = base + kind
  const hit = paperCache.get(key)
  if (hit !== undefined) return hit
  const tex = wallpaper(base, accent, kind)
  tex.repeat.set(1, 1)
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })
  paperCache.set(key, m)
  return m
}

export interface WallView {
  readonly mesh: THREE.Object3D
  readonly along: 'x' | 'z'
  readonly at: number
  readonly from: number
  readonly to: number
  readonly front: boolean
}

/** Walls with wallpaper on each side, white skirting, door frames. */
function walls(scene: THREE.Scene): WallView[] {
  const views: WallView[] = []
  const top = mat(0xf3ead8, 0.9)
  for (const p of WALL_PIECES) {
    const len = p.to - p.from
    const mid = (p.from + p.to) / 2
    const g = new THREE.Group()
    if (p.wall.axis === 'x') {
      g.position.set(mid, 0, p.wall.at)
      const sideA = paperFor(mid, p.wall.at - 0.5)
      const sideB = paperFor(mid, p.wall.at + 0.5)
      const box = new THREE.Mesh(new THREE.BoxGeometry(len, H, T), [top, top, top, top, sideB, sideA])
      box.position.y = H / 2
      g.add(box)
      for (const s of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 0.04), mat(0xffffff, 0.5)), 0, 0.08, s * (T / 2 + 0.02)))
    } else {
      g.position.set(p.wall.at, 0, mid)
      const sideA = paperFor(p.wall.at - 0.5, mid)
      const sideB = paperFor(p.wall.at + 0.5, mid)
      const box = new THREE.Mesh(new THREE.BoxGeometry(T, H, len), [sideB, sideA, top, top, top, top])
      box.position.y = H / 2
      g.add(box)
      for (const s of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, len), mat(0xffffff, 0.5)), s * (T / 2 + 0.02), 0.08, 0))
    }
    g.traverse((o) => {
      o.castShadow = true
      o.receiveShadow = true
    })
    scene.add(g)
    views.push({ mesh: g, along: p.wall.axis, at: p.wall.at, from: p.from, to: p.to, front: p.wall.front === true })
  }
  // Door frames and lintels.
  const frame = mat(0xffffff, 0.45)
  for (const d of DOORS) {
    const alongX = d.normal.z !== 0
    const lintel = new THREE.Mesh(alongX ? new THREE.BoxGeometry(DOOR_W, 0.5, T) : new THREE.BoxGeometry(T, 0.5, DOOR_W), paperFor(d.pos.x - d.normal.x * 0.5, d.pos.z - d.normal.z * 0.5))
    lintel.position.set(d.pos.x, H - 0.25, d.pos.z)
    // Wrapped at floor level so the cut-away scales it down towards the floor.
    const g = new THREE.Group()
    g.add(lintel)
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(alongX ? new THREE.BoxGeometry(0.1, H - 0.5, T + 0.08) : new THREE.BoxGeometry(T + 0.08, H - 0.5, 0.1), frame)
      post.position.set(d.pos.x + (alongX ? (s * DOOR_W) / 2 : 0), (H - 0.5) / 2, d.pos.z + (alongX ? 0 : (s * DOOR_W) / 2))
      g.add(post)
    }
    scene.add(g)
    views.push({ mesh: g, along: alongX ? 'x' : 'z', at: alongX ? d.pos.z : d.pos.x, from: -1e9, to: 1e9, front: false })
  }
  return views
}

/** The kitchen window the jelly climbs through: frame, sill, sky, curtains, moonlight. */
function window(scene: THREE.Scene): void {
  const z0 = WINDOW.z - WINDOW.w / 2
  const z1 = WINDOW.z + WINDOW.w / 2
  const x = WINDOW.x
  const frame = mat(0xffffff, 0.4)
  scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(T, H - 1.7, WINDOW.w), paperFor(x + 0.5, WINDOW.z)), x, 1.7 + (H - 1.7) / 2, WINDOW.z))
  scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, WINDOW.w + 0.3), frame), x, 1.7, WINDOW.z))
  scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, WINDOW.w + 0.3), frame), x, 0.04, WINDOW.z))
  for (const z of [z0, z1]) scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.7, 0.12), frame), x, 0.85, z))
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW.w, 1.7), new THREE.MeshBasicMaterial({ map: nightSky() }))
  sky.rotation.y = Math.PI / 2
  sky.position.set(x - 2.5, 0.85, WINDOW.z)
  scene.add(sky)
  const curtain = mat(0xd9534f, 0.85)
  for (const [z, s] of [[z0 - 0.15, -1], [z1 + 0.15, 1]] as const) {
    const c = rbox(0.12, 2.1, 0.5, curtain, 0.05)
    c.position.set(x + 0.18, 1.5, z)
    c.rotation.x = s * 0.06
    scene.add(c)
  }
  scene.add(at(cyl(0.03, 0.03, WINDOW.w + 1.4, mat(0x8d6e63, 0.4), 8).rotateX(Math.PI / 2), x + 0.2, 2.6, WINDOW.z))
}

/** Little lamps on the walls so each room glows warmly at night. */
function roomLights(scene: THREE.Scene): THREE.PointLight[] {
  return ROOMS.map((r) => {
    const l = new THREE.PointLight(0xffd8a0, 5, 11, 1.6)
    l.position.set((r.x0 + r.x1) / 2, 2.4, (r.z0 + r.z1) / 2)
    scene.add(l)
    return l
  })
}

function furniture(scene: THREE.Scene): void {
  for (const f of FURNITURE) {
    if (f.hidden === true) continue
    const m = model(f.model as ModelKey)
    m.rotation.y = f.rot
    if (f.scale !== undefined) m.scale.setScalar(f.scale)
    m.position.set(f.box.x, f.y ?? 0, f.box.z)
    scene.add(shadowed(m))
  }
}

export interface HouseView {
  /** Lower the walls between the camera and the jelly, dollhouse style. */
  readonly cutaway: (p: Vec, dt: number) => void
  readonly setLights: (on: boolean) => void
}

/** The dollhouse: floors, walls, furniture and the way in. Models must be loaded first. */
export function buildHouse(scene: THREE.Scene): HouseView {
  floors(scene)
  const views = walls(scene)
  window(scene)
  const lights = roomLights(scene)
  furniture(scene)
  const heights = views.map(() => 1)
  return {
    setLights: (on) => lights.forEach((l) => (l.visible = on)),
    cutaway: (p, dt) => {
      views.forEach((w, i) => {
        // Walls running along x in front of the jelly (towards the camera) drop low; so does the front wall.
        const inFront = w.along === 'x' && w.at > p.z + 0.4
        const target = w.front || inFront ? LOW / H : 1
        heights[i] += (target - heights[i]) * Math.min(1, dt * 6)
        w.mesh.scale.y = heights[i]
        w.mesh.visible = heights[i] > 0.02
      })
    },
  }
}
