import * as THREE from 'three'
import { CAT } from '../sim/config'
import type { Cat } from '../sim/types'
import { at, ball, cyl, mat, shadowed } from './kit'

export interface CatView {
  readonly group: THREE.Group
  readonly update: (dt: number, time: number, c: Cat | null) => void
}

/** Pamuk: a fluffy white cat with green eyes, whiskers, a red collar and a bell. */
export function createCat(): CatView {
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)
  const fur = mat(0xfafafa, 0.95)
  const cream = mat(0xfff3e0, 0.95)
  const pink = mat(0xf8a5c2, 0.7)

  const torso = ball(0.28, fur, 28)
  torso.scale.set(0.9, 0.78, 1.35)
  torso.position.y = 0.33
  body.add(torso)
  // Fluffy chest and back tufts.
  for (let k = 0; k < 5; k++) body.add(at(ball(0.1, cream, 12), Math.sin(k * 1.3) * 0.1, 0.32 + (k % 2) * 0.05, 0.3 + (k % 3) * 0.02))
  for (let k = 0; k < 4; k++) body.add(at(ball(0.11, fur, 12), Math.sin(k * 2) * 0.12, 0.5, -0.2 + k * 0.12))

  const head = new THREE.Group()
  head.position.set(0, 0.6, 0.36)
  body.add(head)
  const skull = ball(0.2, fur, 28)
  skull.scale.set(1.12, 1, 1)
  head.add(skull)
  for (const s of [-1, 1]) {
    head.add(at(ball(0.08, fur, 12), s * 0.17, -0.07, 0.04))
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 12), fur)
    ear.position.set(s * 0.12, 0.18, -0.02)
    ear.rotation.z = -s * 0.25
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.11, 12), pink)
    inner.position.set(s * 0.12, 0.17, 0.01)
    inner.rotation.z = -s * 0.25
    head.add(ear, inner)
    const eye = ball(0.052, mat(0x8bc34a, 0.15, 0, 0x558b2f, 0.4), 20)
    eye.scale.set(1, 1.1, 0.6)
    eye.position.set(s * 0.085, 0.03, 0.165)
    head.add(eye)
    const slit = ball(0.026, mat(0x111111, 0.2), 10)
    slit.scale.set(0.35, 1.3, 0.5)
    slit.position.set(s * 0.085, 0.03, 0.19)
    head.add(slit)
    head.add(at(ball(0.012, new THREE.MeshBasicMaterial({ color: 0xffffff }), 6), s * 0.075, 0.05, 0.2))
    for (let w = 0; w < 3; w++) {
      const whisker = cyl(0.003, 0.003, 0.22, mat(0xffffff, 0.3), 4)
      whisker.rotation.z = Math.PI / 2 + s * (w - 1) * 0.18
      whisker.position.set(s * 0.17, -0.04 + (w - 1) * 0.02, 0.15)
      head.add(whisker)
    }
  }
  const muzzle = ball(0.075, cream, 16)
  muzzle.scale.set(1.3, 0.8, 0.9)
  muzzle.position.set(0, -0.06, 0.15)
  head.add(muzzle)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.03, 3), pink)
  nose.rotation.set(Math.PI / 2, 0, Math.PI)
  nose.position.set(0, -0.025, 0.215)
  head.add(nose)
  const lids = [-1, 1].map((s) => {
    const lid = ball(0.056, fur, 14)
    lid.scale.set(1, 0.2, 0.65)
    lid.position.set(s * 0.085, 0.07, 0.165)
    head.add(lid)
    return lid
  })

  // Collar and bell.
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 8, 24), mat(0xe53935, 0.5))
  collar.rotation.x = Math.PI / 2 - 0.4
  collar.position.set(0, 0.47, 0.3)
  body.add(collar)
  body.add(at(ball(0.035, mat(0xffd54f, 0.2, 0.9), 12), 0, 0.4, 0.42))

  const legs: THREE.Group[] = []
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) {
    const leg = new THREE.Group()
    leg.position.set(sx * 0.13, 0.25, sz * 0.2)
    leg.add(at(cyl(0.05, 0.045, 0.22, fur, 10), 0, -0.11, 0))
    leg.add(at(ball(0.055, cream, 10), 0, -0.22, 0.02))
    body.add(leg)
    legs.push(leg)
  }

  const tail = new THREE.Group()
  tail.position.set(0, 0.4, -0.36)
  body.add(tail)
  const segs: THREE.Group[] = []
  let parent: THREE.Object3D = tail
  for (let k = 0; k < 8; k++) {
    const seg = new THREE.Group()
    seg.position.set(0, k === 0 ? 0 : 0.07, 0)
    seg.add(ball(0.055 - k * 0.003 + (k === 7 ? 0.015 : 0), k === 7 ? cream : fur, 10))
    parent.add(seg)
    parent = seg
    segs.push(seg)
  }
  const zzz = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 12), mat(0xffffff, 0.5, 0, 0xffffff, 0.6))
  root.add(zzz)
  shadowed(root)

  let walkPhase = 0
  let last = { x: 0, z: 0 }

  function update(_dt: number, time: number, c: Cat | null): void {
    root.visible = c !== null
    if (c === null) return
    const moved = Math.hypot(c.pos.x - last.x, c.pos.z - last.z)
    last = c.pos
    walkPhase += moved * 10
    root.position.set(c.pos.x, 0, c.pos.z)
    root.rotation.y = Math.PI / 2 - c.face
    const nap = c.mode === 'nap'
    const walking = moved > 0.002
    body.scale.set(nap ? 1.15 : 1, nap ? 0.6 : 1, nap ? 0.9 : 1)
    head.position.set(0, nap ? 0.38 : 0.6, nap ? 0.4 : 0.36)
    head.rotation.set(c.mode === 'meow' ? -0.45 + Math.sin(time * 12) * 0.08 : 0, nap ? 0.5 : Math.sin(time * 0.7) * 0.2, 0)
    for (const lid of lids) lid.scale.y = nap ? 1.05 : 0.2
    zzz.visible = nap
    zzz.position.set(0.25, 0.55 + ((time * 0.5) % 1) * 0.5, 0.25)
    legs.forEach((l, i) => {
      l.rotation.x = walking ? Math.sin(walkPhase + (i % 3 === 0 ? 0 : Math.PI)) * 0.6 : 0
      l.visible = !nap
    })
    const hunting = c.mode === 'stalk' || c.mode === 'wiggle'
    segs.forEach((s, k) => {
      s.rotation.x = (k === 0 ? -0.9 : 0.12) + Math.sin(time * (hunting ? 9 : 2.5) - k * 0.6) * 0.08
      s.rotation.z = Math.sin(time * (hunting ? 6 : 1.8) - k * 0.5) * 0.12
    })
    let y = walking ? Math.abs(Math.sin(walkPhase)) * 0.03 : 0
    body.rotation.set(0, 0, 0)
    body.position.y = c.mode === 'stalk' ? -0.08 : 0
    if (c.mode === 'wiggle') {
      body.rotation.z = Math.sin(time * 30) * 0.1
      body.rotation.x = 0.25
    }
    if (c.mode === 'pounce') {
      const k = 1 - Math.max(0, c.timer) / CAT.pounceTime
      y = Math.sin(k * Math.PI) * 1.1
      body.rotation.x = -0.4 + k * 0.8
    }
    if (c.mode === 'scared' && c.hop > 0) {
      y = Math.sin((1 - c.hop / 0.7) * Math.PI) * 1.6
      body.scale.set(1.3, 1.3, 1.3)
    }
    root.position.y = y
  }

  return { group: root, update }
}
