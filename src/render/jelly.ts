import * as THREE from 'three'
import { PROP_DEFS } from '../sim/catalog'
import { SKINS, type SkinId } from '../sim/meta'
import type { GameState, PropKind, Vec } from '../sim/types'
import { ball, mat } from './kit'
import { makePropMesh } from './props'

export interface JellyView {
  readonly group: THREE.Group
  readonly update: (dt: number, time: number, s: GameState, watcher: Vec | null) => void
  readonly giggle: () => void
  readonly squish: () => void
  readonly setSkin: (id: SkinId) => void
}

const JELLY = 0x2fe08f

function makeEye(): { eye: THREE.Group; white: THREE.Mesh; pupil: THREE.Group } {
  const white = ball(0.13, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 }), 20)
  const pupil = new THREE.Group()
  pupil.add(ball(0.072, mat(0x111111, 0.2), 16))
  const shine = ball(0.024, new THREE.MeshBasicMaterial({ color: 0xffffff }), 8)
  shine.position.set(0.026, 0.032, 0.058)
  pupil.add(shine)
  pupil.position.z = 0.085
  const eye = new THREE.Group()
  eye.add(white, pupil)
  return { eye, white, pupil }
}

/**
 * The hero: a wobbly jelly that keeps its two googly eyes on whatever it becomes.
 * Swallowed things float inside it when it is in jelly form.
 */
export function createJelly(): JellyView {
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)

  const jellyMat = new THREE.MeshPhysicalMaterial({
    color: JELLY,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.9,
    emissive: 0x0a7a4c,
    emissiveIntensity: 0.45,
    depthWrite: false,
  })
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.52, 32, 24), jellyMat)
  blob.position.y = 0.46
  blob.scale.set(1, 0.88, 1)
  blob.castShadow = true
  blob.renderOrder = 3
  body.add(blob)

  const bellyGroup = new THREE.Group()
  bellyGroup.position.y = 0.4
  body.add(bellyGroup)
  let bellyKey = ''

  let disguise: THREE.Group | null = null
  let currentForm: PropKind | null = null
  let morphT = 1

  const eyes = new THREE.Group()
  const left = makeEye()
  const right = makeEye()
  left.eye.position.x = -0.15
  right.eye.position.x = 0.15
  eyes.rotation.x = -0.55
  eyes.add(left.eye, right.eye)
  group.add(eyes)

  let phase = 0
  let skin: SkinId = 'nane'
  let blinkAt = 2
  let blink = 0
  let giggleT = 0
  let squishT = 0
  let tumble = 0
  let lastKnock = 0
  let lookX = 0
  let lookY = 0

  function rebuildBelly(s: GameState): void {
    const key = s.player.belly.join(',')
    if (key === bellyKey) return
    bellyKey = key
    bellyGroup.clear()
    s.player.belly.forEach((id, i) => {
      const prop = s.props.find((p) => p.id === id)
      if (prop === undefined) return
      const m = makePropMesh(prop.kind)
      const h = PROP_DEFS[prop.kind].height
      m.scale.setScalar(0.42 / Math.max(0.5, h))
      const a = (i / Math.max(1, s.player.belly.length)) * Math.PI * 2
      m.position.set(Math.cos(a) * 0.14, -0.16, Math.sin(a) * 0.14)
      m.traverse((c) => {
        c.renderOrder = 1
        c.castShadow = false
      })
      bellyGroup.add(m)
    })
  }

  function setForm(form: PropKind | null): void {
    if (form === currentForm) return
    currentForm = form
    morphT = 0
    if (disguise !== null) body.remove(disguise)
    disguise = null
    if (form !== null) {
      disguise = makePropMesh(form)
      body.add(disguise)
    }
  }

  function update(dt: number, time: number, s: GameState, watcher: Vec | null): void {
    const p = s.player
    setForm(p.form)
    rebuildBelly(s)
    group.position.set(p.pos.x, 0, p.pos.z)

    morphT = Math.min(1, morphT + dt / 0.38)
    const elastic = morphT >= 1 ? 1 : 1 - Math.cos(morphT * Math.PI * 2.5) * Math.exp(-morphT * 5)
    const inJelly = p.form === null
    const fat = 1 + 0.1 * p.belly.length

    // Blob shows in jelly form, and briefly as a splash while morphing into something.
    blob.visible = inJelly || morphT < 1
    bellyGroup.visible = inJelly
    jellyMat.opacity = inJelly ? 0.9 : 0.9 * (1 - morphT)
    const h = inJelly ? 0.8 : PROP_DEFS[p.form as PropKind].height
    const r = inJelly ? 0.52 : PROP_DEFS[p.form as PropKind].radius

    if (p.moving) phase += dt * (inJelly ? 13 : 10)
    const hop = p.moving ? Math.abs(Math.sin(phase)) : 0
    squishT = Math.max(0, squishT - dt)
    giggleT = Math.max(0, giggleT - dt)

    let sy = 1
    let sxz = 1
    if (inJelly) {
      const breathe = Math.sin(time * 3.2) * 0.03
      sy = (p.moving ? 0.86 + hop * 0.26 : 1 + breathe) * fat
      sxz = (p.moving ? 1.1 - hop * 0.12 : 1 - breathe * 0.5) * fat
      if (p.swallowing !== null) {
        sy *= 1.25
        sxz *= 0.85
      }
      body.position.y = hop * 0.22
      body.rotation.z = 0
    } else {
      body.position.y = hop * 0.09
      body.rotation.z = p.moving ? Math.sin(phase) * 0.13 : 0
    }
    if (squishT > 0) {
      sy *= 1 - squishT * 0.6
      sxz *= 1 + squishT * 0.4
    }
    body.scale.set(sxz, sy, sxz)
    if (disguise !== null) {
      disguise.scale.setScalar(Math.max(0.01, elastic))
      disguise.rotation.y = p.formRot
    }
    if (skin === 'gokkusagi') jellyMat.color.setHSL((time * 0.15) % 1, 0.85, 0.6)
    if (!inJelly && morphT < 1) blob.scale.set(r * 2.4 * (1 + (1 - morphT)), h * 1.2, r * 2.4 * (1 + (1 - morphT)))
    else blob.scale.set(1, 0.88, 1)

    // Knocked over by the cat: a tumble.
    if (p.knocked > lastKnock + 0.01) tumble = 1
    lastKnock = p.knocked
    tumble = Math.max(0, tumble - dt * 1.3)
    group.rotation.x = Math.sin(tumble * Math.PI * 2) * tumble * 0.9
    group.rotation.z = giggleT > 0 ? Math.sin(time * 70) * 0.12 * giggleT * 2 : 0
    body.rotation.y = inJelly ? -p.face + Math.PI / 2 : 0

    // Eyes sit on the camera side of whatever we are.
    const ey = inJelly ? 0.46 + 0.3 * sy + body.position.y : h * 0.74 + body.position.y
    const ez = inJelly ? 0.44 * sxz : r * 0.95 + 0.04
    eyes.position.set(0, Math.max(0.18, ey), ez)
    const eyeScale = inJelly ? 1 : Math.min(1.1, Math.max(0.65, r * 2))
    eyes.scale.setScalar(eyeScale)

    // Blinking and closing.
    if (time > blinkAt) {
      blink = 0.14
      blinkAt = time + 2 + Math.random() * 3
    }
    blink = Math.max(0, blink - dt)
    const shut = p.eyesClosed || blink > 0 || s.tickle !== null
    const lid = shut ? 0.12 : 1
    left.white.scale.y += (lid - left.white.scale.y) * Math.min(1, dt * 25)
    right.white.scale.y = left.white.scale.y
    left.pupil.visible = left.white.scale.y > 0.5
    right.pupil.visible = left.pupil.visible

    // Pupils: nervous glances at granny when she is near, else where we are going.
    let tx = Math.cos(p.face) * 0.5
    let ty = 0
    if (watcher !== null) {
      const dx = watcher.x - p.pos.x
      const dz = watcher.z - p.pos.z
      const d = Math.hypot(dx, dz)
      if (d < 7) {
        tx = dx / Math.max(1, d)
        ty = 0.4
      }
    }
    if (tumble > 0) {
      tx = Math.cos(time * 20)
      ty = Math.sin(time * 20)
    }
    lookX += (tx - lookX) * Math.min(1, dt * 8)
    lookY += (ty - lookY) * Math.min(1, dt * 8)
    for (const e of [left, right]) {
      e.pupil.position.x = lookX * 0.035
      e.pupil.position.y = lookY * 0.03
    }

    bellyGroup.rotation.y = time * 0.8
  }

  return {
    group,
    update,
    giggle: () => {
      giggleT = 0.5
    },
    squish: () => {
      squishT = 0.35
    },
    setSkin: (id) => {
      skin = id
      jellyMat.color.setHex(SKINS[id].color)
      jellyMat.emissive.setHex(SKINS[id].emissive)
    },
  }
}
