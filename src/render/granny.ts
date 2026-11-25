import * as THREE from 'three'
import type { Owner, OwnerKind } from '../sim/types'
import { at, ball, cyl, mat, rbox, shadowed } from './kit'

export interface PersonView {
  readonly group: THREE.Group
  /** The torch beam (only shown on the power-cut night). */
  readonly torch: THREE.SpotLight
  readonly update: (dt: number, time: number, o: Owner, poking: boolean) => void
}

function lathe(points: Array<[number, number]>, m: THREE.Material, seg = 36): THREE.Mesh {
  return new THREE.Mesh(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg), m)
}

/** Purple fabric with little white flowers. */
function flowerFabric(base: string, dot: string): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d') as CanvasRenderingContext2D
  g.fillStyle = base
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 6; j++) {
      const x = i * 22 + 11 + (j % 2) * 11
      const y = j * 22 + 11
      g.fillStyle = dot
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2
        g.beginPath()
        g.arc(x + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5, 2.4, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = '#ffd54f'
      g.beginPath()
      g.arc(x, y, 1.8, 0, Math.PI * 2)
      g.fill()
    }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 2)
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 })
}

interface Face {
  readonly head: THREE.Group
  readonly browL: THREE.Mesh
  readonly browR: THREE.Mesh
  readonly mouth: THREE.Mesh
  readonly mouthO: THREE.Mesh
  readonly lids: THREE.Mesh[]
}

function makeFace(skin: THREE.Material, kind: OwnerKind): Face {
  const head = new THREE.Group()
  const skull = ball(0.27, skin, 32)
  skull.scale.set(1, 1.05, 0.98)
  head.add(skull)
  // Ears and cheeks.
  for (const s of [-1, 1]) {
    const ear = ball(0.06, skin, 16)
    ear.scale.set(0.6, 1, 0.8)
    ear.position.set(s * 0.26, 0, -0.02)
    head.add(ear)
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), new THREE.MeshBasicMaterial({ color: 0xff8a80, transparent: true, opacity: 0.55 }))
    blush.position.set(s * 0.14, -0.06, 0.245)
    blush.rotation.y = s * 0.5
    head.add(blush)
  }
  const nose = ball(0.045, mat(0xffb59a, 0.6), 16)
  nose.scale.set(1, 0.9, 1.1)
  nose.position.set(0, -0.02, 0.27)
  head.add(nose)
  // Eyes behind glasses.
  const lids: THREE.Mesh[] = []
  for (const s of [-1, 1]) {
    const white = ball(0.04, mat(0xffffff, 0.3), 16)
    white.position.set(s * 0.095, 0.05, 0.235)
    white.scale.set(1, 1.1, 0.6)
    head.add(white)
    head.add(at(ball(0.022, mat(0x3e2723, 0.2), 12), s * 0.095, 0.05, 0.255))
    head.add(at(ball(0.008, new THREE.MeshBasicMaterial({ color: 0xffffff }), 6), s * 0.09, 0.06, 0.275))
    const lid = ball(0.043, skin, 16)
    lid.scale.set(1, 0.5, 0.65)
    lid.position.set(s * 0.095, 0.085, 0.24)
    head.add(lid)
    lids.push(lid)
  }
  const browMat = mat(kind === 'dede' ? 0xffffff : 0x9e9e9e, 0.9)
  const browL = rbox(0.1, kind === 'dede' ? 0.035 : 0.022, 0.03, browMat, 0.01)
  const browR = browL.clone()
  browL.position.set(-0.1, 0.135, 0.245)
  browR.position.set(0.1, 0.135, 0.245)
  head.add(browL, browR)
  // Round glasses.
  const glassMat = mat(kind === 'dede' ? 0x212121 : 0x8d6e63, 0.35, 0.4)
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.011, 8, 28), glassMat)
    ring.position.set(s * 0.095, 0.05, 0.285)
    head.add(ring)
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.066, 24), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.02, clearcoat: 1 }))
    lens.position.set(s * 0.095, 0.05, 0.287)
    head.add(lens)
    const temple = rbox(0.012, 0.012, 0.24, glassMat, 0.004)
    temple.position.set(s * 0.16, 0.05, 0.17)
    temple.rotation.y = s * 0.15
    head.add(temple)
  }
  head.add(at(rbox(0.05, 0.012, 0.012, glassMat, 0.004), 0, 0.055, 0.29))
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 8, 18, Math.PI), mat(0x8d3a3a, 0.5))
  mouth.position.set(0, -0.12, 0.25)
  mouth.rotation.z = Math.PI
  head.add(mouth)
  const mouthO = ball(0.04, mat(0x5d1a1a, 0.5), 14)
  mouthO.scale.set(1, 1.2, 0.4)
  mouthO.position.set(0, -0.13, 0.255)
  mouthO.visible = false
  head.add(mouthO)
  return { head, browL, browR, mouth, mouthO, lids }
}

function teyzeHair(head: THREE.Group): void {
  const hair = mat(0xdedede, 0.85)
  // Curly grey hair: a ring of curls and a bun with a hairpin flower.
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2
    const curl = ball(0.075, hair, 14)
    curl.position.set(Math.sin(a) * 0.24, 0.13 + Math.cos(a * 2) * 0.02, Math.cos(a) * 0.2 - 0.04)
    if (curl.position.z > 0.15) curl.position.y += 0.06
    head.add(curl)
  }
  const cap = ball(0.25, hair, 24)
  cap.scale.set(1.02, 0.72, 1)
  cap.position.set(0, 0.14, -0.04)
  head.add(cap)
  head.add(at(ball(0.13, hair, 20), 0, 0.33, -0.12))
  head.add(at(cyl(0.008, 0.008, 0.22, mat(0x5d4037)), 0.05, 0.38, -0.1).rotateZ(1.1))
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2
    head.add(at(ball(0.025, mat(0xe53935, 0.6)), 0.14 + Math.cos(a) * 0.03, 0.37 + Math.sin(a) * 0.03, -0.02))
  }
  head.add(at(ball(0.018, mat(0xffeb3b)), 0.14, 0.37, -0.0))
  for (const s of [-1, 1]) head.add(at(ball(0.022, mat(0xfafafa, 0.15, 0.2)), s * 0.27, -0.07, 0))
}

function dedeHair(head: THREE.Group): void {
  const hair = mat(0xf5f5f5, 0.9)
  for (const s of [-1, 1])
    for (let k = 0; k < 4; k++) head.add(at(ball(0.06, hair, 12), s * 0.23, 0.02 + k * 0.03, -0.1 - k * 0.04))
  // Flat cap.
  const capMat = mat(0x6d4c41, 0.9)
  const cap = ball(0.275, capMat, 28)
  cap.scale.set(1.05, 0.45, 1.08)
  cap.position.set(0, 0.17, -0.01)
  head.add(cap)
  const brim = rbox(0.34, 0.03, 0.14, capMat, 0.015)
  brim.position.set(0, 0.14, 0.27)
  brim.rotation.x = 0.15
  head.add(brim)
  // Big white moustache.
  for (const s of [-1, 1]) {
    const m = ball(0.07, hair, 16)
    m.scale.set(1.3, 0.55, 0.7)
    m.position.set(s * 0.06, -0.08, 0.26)
    m.rotation.z = s * 0.3
    head.add(m)
  }
}

/** Kedili Teyze or Dede: hand-built, with moods, a walk cycle and props in hand. */
export function createPerson(kind: OwnerKind): PersonView {
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)
  const skin = mat(0xffd5b8, 0.65)
  const dede = kind === 'dede'

  // Legs and slippers / shoes.
  const legs: THREE.Group[] = []
  for (const s of [-1, 1]) {
    const leg = new THREE.Group()
    leg.position.set(s * 0.13, 0.5, 0)
    leg.add(at(cyl(0.065, 0.055, 0.45, dede ? mat(0x5d4037, 0.85) : mat(0xf0d0b8, 0.7), 12), 0, -0.24, 0))
    if (dede) leg.add(at(rbox(0.15, 0.09, 0.28, mat(0x3e2723, 0.4), 0.04), 0, -0.47, 0.05))
    else {
      leg.add(at(rbox(0.16, 0.09, 0.3, mat(0xf48fb1, 0.95), 0.045), 0, -0.47, 0.05))
      leg.add(at(ball(0.06, mat(0xffffff, 1), 10), 0, -0.41, 0.17))
    }
    body.add(leg)
    legs.push(leg)
  }

  const torso = new THREE.Group()
  torso.position.y = 0.45
  body.add(torso)
  if (dede) {
    torso.add(lathe([[0.25, 0], [0.3, 0.1], [0.32, 0.4], [0.28, 0.68], [0.16, 0.8], [0, 0.82]], mat(0xfafafa, 0.8)))
    const vest = lathe([[0.26, 0.05], [0.31, 0.12], [0.33, 0.4], [0.29, 0.66], [0.2, 0.74], [0, 0.75]], mat(0x8d6e63, 0.85))
    vest.scale.set(1.02, 1, 0.92)
    torso.add(vest)
    for (let k = 0; k < 3; k++) torso.add(at(ball(0.018, mat(0xffd54f, 0.3, 0.6)), 0, 0.22 + k * 0.14, 0.3))
    torso.add(at(rbox(0.05, 0.12, 0.02, mat(0xc62828)), 0, 0.68, 0.24))
  } else {
    const dress = lathe([[0.44, 0], [0.42, 0.06], [0.38, 0.3], [0.33, 0.55], [0.3, 0.72], [0.2, 0.82], [0, 0.84]], flowerFabric('#7e57c2', '#ffffff'))
    torso.add(dress)
    const ruffle = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.035, 8, 40), mat(0xffffff, 0.9))
    ruffle.rotation.x = Math.PI / 2
    ruffle.position.y = 0.03
    torso.add(ruffle)
    const apron = rbox(0.42, 0.5, 0.04, mat(0xfffde7, 0.9), 0.04)
    apron.position.set(0, 0.3, 0.37)
    apron.rotation.x = -0.18
    torso.add(apron)
    for (let k = 0; k < 7; k++) torso.add(at(ball(0.03, mat(0xffffff, 0.9), 8), -0.18 + k * 0.06, 0.06, 0.41))
    torso.add(at(rbox(0.16, 0.12, 0.02, mat(0xf48fb1, 0.9), 0.02), 0.06, 0.26, 0.41))
    const shawl = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.08, 12, 32), mat(0xe57373, 0.95))
    shawl.rotation.x = Math.PI / 2
    shawl.position.y = 0.74
    torso.add(shawl)
    torso.add(at(ball(0.035, mat(0xffd54f, 0.3, 0.6)), 0, 0.7, 0.28))
  }

  const face = makeFace(skin, kind)
  face.head.position.y = 1.53
  if (dede) dedeHair(face.head)
  else teyzeHair(face.head)
  body.add(face.head)
  body.add(at(cyl(0.07, 0.08, 0.1, skin, 12), 0, 1.3, 0))

  const arms: THREE.Group[] = []
  const sleeve = dede ? mat(0xfafafa, 0.8) : mat(0x7e57c2, 0.85)
  for (const s of [-1, 1]) {
    const arm = new THREE.Group()
    arm.position.set(s * 0.32, 1.18, 0)
    arm.add(at(cyl(0.07, 0.065, 0.3, sleeve, 12), 0, -0.15, 0))
    arm.add(at(cyl(0.05, 0.045, 0.26, skin, 12), 0, -0.42, 0))
    const hand = ball(0.065, skin, 14)
    hand.scale.set(0.9, 1, 0.8)
    hand.position.y = -0.58
    arm.add(hand)
    body.add(arm)
    arms.push(arm)
  }
  // In the right hand: Teyze's rolling pin (out when she is angry), Dede's cane.
  const tool = new THREE.Group()
  if (dede) {
    tool.add(at(cyl(0.022, 0.022, 0.95, mat(0x4e342e, 0.5), 10), 0, -0.45, 0.06))
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.022, 8, 16, Math.PI), mat(0x4e342e, 0.5))
    handle.position.set(0, 0.02, 0.0)
    tool.add(handle)
  } else {
    const pin = cyl(0.045, 0.045, 0.5, mat(0xd7a86e, 0.6), 16)
    pin.rotation.z = Math.PI / 2
    tool.add(pin)
    for (const s of [-1, 1]) tool.add(at(cyl(0.02, 0.02, 0.12, mat(0xa1887f, 0.6), 10).rotateZ(Math.PI / 2), s * 0.31, 0, 0))
  }
  tool.position.set(0, -0.6, 0.04)
  arms[1].add(tool)
  // Torch: a little metal tube in the left hand and a spotlight in front of her.
  const torchBody = at(cyl(0.05, 0.06, 0.22, mat(0xffca28, 0.3, 0.5), 12), 0, -0.62, 0.08)
  torchBody.rotation.x = Math.PI / 2
  const lens = at(cyl(0.065, 0.065, 0.02, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff8d0, emissiveIntensity: 3 }), 16), 0, -0.62, 0.2)
  lens.rotation.x = Math.PI / 2
  arms[0].add(torchBody, lens)
  const torch = new THREE.SpotLight(0xfff2c8, 70, 15, 0.42, 0.45, 1.2)
  torch.position.set(0, 1.25, 0.3)
  torch.target.position.set(0, 0, 6)
  root.add(torch, torch.target)
  torch.visible = false
  // A soft glow around her so the player can still see where she is in the dark.
  const glow = new THREE.PointLight(0xffe0a0, 4, 3.5, 1.5)
  glow.position.set(0, 1.4, 0.4)
  root.add(glow)
  glow.visible = false
  torchBody.visible = false
  lens.visible = false
  shadowed(root)

  let walkPhase = 0
  let last = { x: 0, z: 0 }
  let pokeT = 0
  let blinkAt = 1
  let blink = 0

  function update(dt: number, time: number, o: Owner, poking: boolean): void {
    torch.visible = o.torch
    glow.visible = o.torch
    torchBody.visible = o.torch
    lens.visible = o.torch
    const moved = Math.hypot(o.pos.x - last.x, o.pos.z - last.z)
    last = o.pos
    const speed = moved / Math.max(dt, 1e-4)
    walkPhase += speed * dt * (dede ? 4.5 : 6)
    root.position.set(o.pos.x, 0, o.pos.z)
    root.rotation.y = Math.PI / 2 - o.face
    const walking = speed > 0.2
    const alarm = o.mode === 'alarm'
    const curious = o.mode === 'investigate' || (o.suspicion > 30 && !alarm)
    const sw = Math.sin(walkPhase)

    body.position.y = walking ? Math.abs(sw) * 0.06 : Math.sin(time * 2) * 0.008
    body.rotation.z = walking ? sw * 0.05 : 0
    body.rotation.x = curious ? 0.18 : alarm ? 0.12 : dede ? 0.08 : 0
    legs[0].rotation.x = walking ? sw * 0.6 : 0
    legs[1].rotation.x = walking ? -sw * 0.6 : 0

    tool.visible = dede || alarm
    if (alarm) {
      arms[0].rotation.set(-0.6 + Math.sin(time * 16) * 0.4, 0, 0.3)
      arms[1].rotation.set(-2.7 + Math.cos(time * 16) * 0.35, 0, -0.2)
    } else if (poking) {
      pokeT += dt
      arms[0].rotation.set(0, 0, 0.6)
      arms[1].rotation.set(-1.35 + Math.max(0, Math.sin(pokeT * 5.2)) * 0.45, 0, 0)
    } else if (o.torch) {
      arms[0].rotation.set(-1.45, 0, 0.15)
      arms[1].rotation.set(walking ? -sw * 0.45 : 0.05, 0, -0.12)
    } else if (curious) {
      // Hand up to the glasses, peering.
      arms[0].rotation.set(-2.2, 0, 0.6)
      arms[1].rotation.set(walking ? -sw * 0.4 : 0.1, 0, -0.1)
    } else {
      pokeT = 0
      arms[0].rotation.set(walking ? sw * 0.45 : 0.05, 0, 0.12)
      arms[1].rotation.set(dede ? -0.25 + (walking ? -sw * 0.2 : 0) : walking ? -sw * 0.45 : 0.05, 0, -0.12)
    }

    // Face: calm smile, raised brow when curious, angry brows and an "O" when alarmed.
    face.head.rotation.z = curious ? Math.sin(time * 2) * 0.15 : 0
    face.head.rotation.x = o.mode === 'tickle' ? 0.3 : 0
    face.browL.rotation.z = alarm ? -0.4 : curious ? 0.25 : 0
    face.browR.rotation.z = alarm ? 0.4 : curious ? -0.05 : 0
    face.browL.position.y = 0.135 + (curious ? 0.03 : 0)
    face.mouth.visible = !alarm
    face.mouthO.visible = alarm
    face.mouth.rotation.z = curious ? Math.PI * 0.95 : Math.PI
    face.mouth.scale.set(curious ? 0.6 : 1, curious ? 0.3 : 1, 1)
    if (time > blinkAt) {
      blink = 0.12
      blinkAt = time + 2.5 + Math.random() * 3
    }
    blink = Math.max(0, blink - dt)
    const squint = curious ? 0.85 : 0.5
    for (const lid of face.lids) lid.scale.y = blink > 0 ? 1.1 : squint
  }

  return { group: root, torch, update }
}
