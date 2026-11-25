import * as THREE from 'three'
import { PROP_DEFS, type PropKind } from '../sim/catalog'
import { PLAYER } from '../sim/config'
import { copyTarget, swallowTarget } from '../sim/player'
import type { GameState } from '../sim/types'
import { at, ball, cyl, GOLD, group, mat, rbox, shadowed } from './kit'
import { model, type ModelKey } from './models'

function lathe(points: Array<[number, number]>, m: THREE.Material, seg = 32): THREE.Mesh {
  return new THREE.Mesh(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg), m)
}

/** Golden vase with a painted band and a blue gem. */
function vazo(): THREE.Group {
  const body = lathe(
    [[0, 0], [0.2, 0], [0.24, 0.04], [0.3, 0.16], [0.4, 0.42], [0.41, 0.55], [0.36, 0.78], [0.22, 0.96], [0.18, 1.06], [0.24, 1.15], [0.27, 1.2], [0.22, 1.2], [0.17, 1.1], [0, 1.1]],
    GOLD(),
  )
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.405, 0.035, 10, 40), mat(0xc62828, 0.35, 0.2))
  band.rotation.x = Math.PI / 2
  band.position.y = 0.5
  const band2 = band.clone()
  band2.scale.setScalar(0.92)
  band2.position.y = 0.7
  const g = group(body, band, band2)
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2
    g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.05), mat(k % 2 ? 0x40c4ff : 0xff4081, 0.1, 0.3, k % 2 ? 0x40c4ff : 0xff4081, 0.6)), Math.sin(a) * 0.41, 0.6, Math.cos(a) * 0.41))
  }
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 8, 16, Math.PI), GOLD())
    h.rotation.z = (s * Math.PI) / 2
    h.position.set(s * 0.3, 0.98, 0)
    g.add(h)
  }
  return g
}

function kavanoz(): THREE.Group {
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xe0f4ff, roughness: 0.05, transparent: true, opacity: 0.35, clearcoat: 1 })
  const jar = lathe([[0, 0], [0.24, 0], [0.27, 0.05], [0.27, 0.42], [0.2, 0.48], [0, 0.48]], glass)
  const lid = at(cyl(0.21, 0.21, 0.08, mat(0xe53935, 0.4)), 0, 0.52, 0)
  const knob = at(ball(0.06, mat(0xffffff, 0.3)), 0, 0.58, 0)
  const g = group(jar, lid, knob)
  const cookie = mat(0xc68642, 0.9)
  const chip = mat(0x3e2723, 0.8)
  for (let k = 0; k < 6; k++) {
    const c = cyl(0.11, 0.11, 0.035, cookie, 14)
    c.rotation.set(0.4 * k, 0, 0.6 * k)
    const p = at(group(c, at(ball(0.02, chip), 0.04, 0.02, 0.03), at(ball(0.02, chip), -0.03, 0.02, -0.02)), Math.sin(k * 2.1) * 0.1, 0.07 + k * 0.065, Math.cos(k * 2.1) * 0.08)
    g.add(p)
  }
  return g
}

function yuzuk(): THREE.Group {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 12, 32), GOLD())
  ring.position.y = 0.11
  const gem = at(new THREE.Mesh(new THREE.OctahedronGeometry(0.055), mat(0xff4081, 0.05, 0.2, 0xff4081, 1.3)), 0, 0.235, 0)
  const setting = at(cyl(0.03, 0.045, 0.04, GOLD(), 12), 0, 0.2, 0)
  return group(ring, setting, gem)
}

function salatalik(): THREE.Group {
  const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.42, 8, 16), mat(0x2e7d32, 0.55))
  c.rotation.z = Math.PI / 2
  c.position.y = 0.11
  const g = group(c, at(cyl(0.03, 0.02, 0.06, mat(0x795548), 8), 0.32, 0.11, 0))
  for (let k = 0; k < 9; k++) g.add(at(ball(0.016, mat(0x9ccc65)), -0.22 + k * 0.055, 0.2 + (k % 2) * 0.01, (k % 3) * 0.04 - 0.04))
  return g
}

function top(): THREE.Group {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const g2 = c.getContext('2d') as CanvasRenderingContext2D
  const cols = ['#e53935', '#fdd835', '#1e88e5', '#ffffff', '#43a047', '#fb8c00']
  for (let k = 0; k < 6; k++) {
    g2.fillStyle = cols[k]
    g2.fillRect(k * 22, 0, 22, 64)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const b = ball(0.3, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 }), 32)
  b.position.y = 0.3
  b.rotation.z = 0.4
  return group(b)
}

function kova(): THREE.Group {
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.46, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x29b6f6, roughness: 0.4, side: THREE.DoubleSide }))
  body.position.y = 0.23
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 8, 28), mat(0x0288d1, 0.4))
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.46
  const bottom = at(cyl(0.22, 0.22, 0.02, mat(0x0288d1)), 0, 0.01, 0)
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.014, 6, 24, Math.PI), mat(0xcfd8dc, 0.3, 0.7))
  handle.position.y = 0.46
  const water = at(cyl(0.25, 0.25, 0.01, new THREE.MeshStandardMaterial({ color: 0x81d4fa, roughness: 0.05, transparent: true, opacity: 0.7 })), 0, 0.34, 0)
  return group(body, rim, bottom, handle, water)
}

/** Pink piggy bank with a coin slot. */
function kumbara(): THREE.Group {
  const pink = mat(0xf48fb1, 0.35)
  const dark = mat(0xec407a, 0.4)
  const body = ball(0.24, pink, 28)
  body.scale.set(1, 0.85, 1.2)
  body.position.y = 0.26
  const g = group(body)
  g.add(at(cyl(0.09, 0.1, 0.08, pink, 18), 0, 0.27, 0.3).rotateX(Math.PI / 2))
  g.add(at(ball(0.022, dark), -0.035, 0.27, 0.345), at(ball(0.022, dark), 0.035, 0.27, 0.345))
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.11, 10), pink)
    ear.position.set(sx * 0.12, 0.47, 0.14)
    ear.rotation.z = -sx * 0.4
    g.add(ear)
    g.add(at(ball(0.03, mat(0x222222, 0.2)), sx * 0.09, 0.36, 0.25))
    for (const sz of [-1, 1]) g.add(at(cyl(0.05, 0.05, 0.1, pink, 12), sx * 0.12, 0.05, sz * 0.14))
  }
  g.add(at(rbox(0.12, 0.02, 0.02, mat(0x5d1a33)), 0, 0.48, -0.02))
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12, Math.PI * 1.5), pink)
  tail.position.set(0, 0.3, -0.29)
  g.add(tail)
  g.add(at(cyl(0.05, 0.05, 0.012, GOLD(), 16).rotateX(Math.PI / 2), 0.1, 0.48, 0.0))
  return g
}

/** Gold trophy cup on a wooden base. */
function kupa(): THREE.Group {
  const base = at(rbox(0.32, 0.1, 0.32, mat(0x5d4037, 0.5), 0.02), 0, 0.05, 0)
  const plate = at(rbox(0.18, 0.06, 0.01, mat(0xfff59d, 0.3, 0.6)), 0, 0.06, 0.165)
  const cup = lathe([[0, 0.1], [0.08, 0.1], [0.04, 0.16], [0.03, 0.3], [0.06, 0.34], [0.17, 0.46], [0.2, 0.66], [0.18, 0.66], [0.15, 0.48], [0, 0.44]], GOLD())
  const g = group(base, plate, cup)
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 16, Math.PI * 1.2), GOLD())
    h.position.set(s * 0.2, 0.54, 0)
    h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2
    g.add(h)
  }
  g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.05), mat(0xffffff, 0.1, 0.2, 0xfff3a0, 1)), 0, 0.72, 0))
  return g
}

/** Velvet jewelry box, lid open, pearls and a crown inside. */
function mucevher(): THREE.Group {
  const velvet = mat(0x6a1b9a, 0.7)
  const gold = GOLD()
  const box = at(rbox(0.42, 0.18, 0.3, velvet, 0.03), 0, 0.09, 0)
  const trim = at(rbox(0.44, 0.03, 0.32, gold, 0.01), 0, 0.18, 0)
  const lid = new THREE.Group()
  lid.position.set(0, 0.19, -0.15)
  lid.add(at(rbox(0.42, 0.04, 0.3, velvet, 0.02), 0, 0, 0.15))
  lid.rotation.x = -1.1
  const g = group(box, trim, lid)
  for (let k = 0; k < 7; k++) g.add(at(ball(0.028, mat(0xfafafa, 0.15, 0.1)), -0.15 + k * 0.05, 0.2, 0.05 + Math.sin(k) * 0.03))
  const crown = lathe([[0.07, 0], [0.08, 0.05], [0.08, 0.09], [0, 0.09]], gold, 6)
  crown.position.set(0.08, 0.19, -0.04)
  g.add(crown)
  g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.035), mat(0x00e676, 0.05, 0.2, 0x00e676, 1)), -0.08, 0.23, -0.03))
  return g
}

/** A soft brown teddy bear with a red bow, sitting up. */
function ayicik(): THREE.Group {
  const fur = mat(0xa0703c, 0.95)
  const light = mat(0xe6c39a, 0.95)
  const dark = mat(0x2b1a12, 0.3)
  const body = ball(0.24, fur, 24)
  body.scale.set(1, 1.1, 0.9)
  body.position.y = 0.3
  const belly = ball(0.15, light, 20)
  belly.scale.set(1, 1.15, 0.5)
  belly.position.set(0, 0.28, 0.16)
  const head = at(ball(0.2, fur, 24), 0, 0.66, 0.02)
  const muzzle = ball(0.09, light, 16)
  muzzle.scale.set(1.2, 0.85, 0.8)
  muzzle.position.set(0, 0.62, 0.18)
  const g = group(body, belly, head, muzzle)
  g.add(at(ball(0.035, dark, 10), 0, 0.65, 0.255))
  for (const s of [-1, 1]) {
    g.add(at(ball(0.075, fur, 14), s * 0.15, 0.82, 0), at(ball(0.045, light, 10), s * 0.15, 0.82, 0.04))
    g.add(at(ball(0.026, dark, 10), s * 0.075, 0.7, 0.18))
    const arm = ball(0.08, fur, 14)
    arm.scale.set(0.9, 1.5, 0.9)
    arm.position.set(s * 0.24, 0.36, 0.06)
    arm.rotation.z = s * 0.5
    g.add(arm)
    const leg = ball(0.1, fur, 14)
    leg.scale.set(1, 0.8, 1.4)
    leg.position.set(s * 0.13, 0.09, 0.13)
    g.add(leg, at(ball(0.06, light, 10), s * 0.13, 0.09, 0.25))
  }
  for (const s of [-1, 1]) {
    const loop = ball(0.05, mat(0xe53935, 0.5), 10)
    loop.scale.set(1.3, 0.8, 0.6)
    loop.position.set(s * 0.06, 0.48, 0.17)
    g.add(loop)
  }
  g.add(at(ball(0.03, mat(0xc62828, 0.5), 8), 0, 0.48, 0.19))
  return g
}

/** Yellow rubber duck. */
function ordek(): THREE.Group {
  const y = mat(0xffd600, 0.3)
  const body = ball(0.14, y, 24)
  body.scale.set(1, 0.8, 1.25)
  body.position.y = 0.11
  const head = at(ball(0.09, y, 20), 0, 0.25, 0.08)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 12), mat(0xff6d00, 0.4))
  beak.rotation.x = Math.PI / 2
  beak.position.set(0, 0.24, 0.18)
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 10), y)
  tail.rotation.x = -2.2
  tail.position.set(0, 0.17, -0.16)
  const g = group(body, head, beak, tail)
  for (const s of [-1, 1]) g.add(at(ball(0.016, mat(0x111111)), s * 0.045, 0.28, 0.15))
  return g
}

/** Which pack model each thing uses; the rest are hand-made above. */
const MODEL_OF: Partial<Record<PropKind, ModelKey>> = {
  saksi: 'k:pottedPlant',
  kaktus: 'y:cactus_medium_A',
  minikKaktus: 'y:cactus_small_B',
  lambader: 'y:lamp_standing',
  masaLambasi: 'y:lamp_table',
  sandalye: 'y:chair_A',
  tabure: 'y:chair_stool',
  cop: 'k:trashcan',
  kutu: 'k:cardboardBoxClosed',
  kitap: 'y:book_set',
  kitaplik: 'k:bookcaseOpenLow',
  puf: 'k:loungeSofaOttoman',
  yastik: 'y:pillow_A',
  hoparlor: 'k:speaker',
  komodin: 'y:cabinet_small',
  camasir: 'k:washer',
  askilik: 'k:coatRackStanding',
  tost: 'k:toaster',
  blender: 'k:kitchenBlender',
  cerceve: 'y:pictureframe_standing_A',
  radyo: 'k:radio',
  laptop: 'k:laptop',
  tv: 'k:televisionVintage',
}

const HANDMADE: Partial<Record<PropKind, () => THREE.Group>> = { ayicik, vazo, kavanoz, yuzuk, salatalik, top, kova, kumbara, kupa, mucevher, ordek }

export const PROP_MODELS: readonly ModelKey[] = Object.values(MODEL_OF) as ModelKey[]

/** A model of a thing, standing on the floor, facing +z. */
export function makePropMesh(kind: PropKind): THREE.Group {
  const key = MODEL_OF[kind]
  if (key !== undefined) return model(key)
  const make = HANDMADE[kind]
  return shadowed(make !== undefined ? make() : group(at(ball(0.3, mat(0xff00ff)), 0, 0.3, 0)))
}

export interface PropsView {
  readonly sync: (s: GameState, time: number) => void
  readonly reset: (s: GameState) => void
}

/** Shows the things in the house; a swallowed thing shrinks into the jelly; loot sparkles. */
export function createPropsView(scene: THREE.Scene): PropsView {
  const root = new THREE.Group()
  scene.add(root)
  const meshes = new Map<number, THREE.Group>()
  const sparkles = new Map<number, THREE.Mesh>()
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0.95 })
  const targetMat = new THREE.MeshBasicMaterial({ color: 0x7dffa0, transparent: true, opacity: 0.95 })
  // A glowing ring under the thing a tap would copy (green) or a hold would steal (gold).
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x7dffa0, transparent: true, opacity: 0.75, depthWrite: false })
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.renderOrder = 6
  scene.add(ring)

  function reset(s: GameState): void {
    root.clear()
    meshes.clear()
    sparkles.clear()
    for (const p of s.props) {
      const m = makePropMesh(p.kind)
      m.rotation.y = p.rot
      root.add(m)
      meshes.set(p.id, m)
      if (PROP_DEFS[p.kind].value > 0) {
        const target = s.targets.includes(p.id)
        const sp = new THREE.Mesh(new THREE.OctahedronGeometry(PROP_DEFS[p.kind].size === 'XS' ? 0.07 : 0.12), target ? targetMat : sparkMat)
        root.add(sp)
        sparkles.set(p.id, sp)
      }
    }
  }

  function sync(s: GameState, time: number): void {
    const loot = s.phase === 'play' && s.tickle === null ? swallowTarget(s.props, s.player) : null
    const copy = s.phase === 'play' && s.tickle === null ? copyTarget(s.props, s.player) : null
    const focus = loot !== null && PROP_DEFS[loot.kind].value > 0 ? loot : copy
    ring.visible = focus !== null && s.player.swallowing === null
    if (focus !== null) {
      const r = PROP_DEFS[focus.kind].radius + 0.2
      const pulse = 1 + Math.sin(time * 6) * 0.06
      ring.position.set(focus.pos.x, 0.04, focus.pos.z)
      ring.scale.setScalar(r * pulse)
      ringMat.color.setHex(focus === loot && PROP_DEFS[focus.kind].value > 0 ? 0xffd23a : 0x7dffa0)
      ringMat.opacity = s.player.holding ? 0.95 : 0.6
    }
    const sw = s.player.swallowing
    for (const p of s.props) {
      const m = meshes.get(p.id)
      if (m === undefined) continue
      const eaten = sw !== null && sw.propId === p.id
      m.visible = p.present
      m.position.set(p.pos.x, 0, p.pos.z)
      if (eaten) {
        const k = Math.min(1, sw.t / PLAYER.swallowTime)
        m.scale.setScalar(Math.max(0.05, 1 - k))
        m.position.x += (s.player.pos.x - p.pos.x) * k * 0.5
        m.position.z += (s.player.pos.z - p.pos.z) * k * 0.5
        m.rotation.y = p.rot + k * 6
      } else {
        m.scale.setScalar(1)
        m.rotation.y = p.rot
      }
      const sp = sparkles.get(p.id)
      if (sp !== undefined) {
        const def = PROP_DEFS[p.kind]
        sp.visible = p.present && !eaten
        const phase = time * 2 + p.id
        sp.position.set(p.pos.x + Math.sin(phase) * 0.25, def.height + 0.3 + Math.sin(time * 3 + p.id) * 0.08, p.pos.z + Math.cos(phase) * 0.25)
        sp.rotation.y = time * 3
        sp.scale.setScalar(def.size === 'XS' ? 0.6 + Math.max(0, Math.sin(time * 5 + p.id)) : 1)
      }
    }
  }

  return { sync, reset }
}
