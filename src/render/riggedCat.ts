import * as THREE from 'three'
import { CAT } from '../sim/config'
import type { Cat } from '../sim/types'
import type { CatView } from './catMesh'
import type { CatRig } from './catRig'
import { mat } from './kit'

/** Stride: the trot cycle advances this many radians per metre walked. */
const STRIDE = 9
const SIDE = new THREE.Vector3(1, 0, 0)
const UP = new THREE.Vector3(0, 1, 0)
const q = new THREE.Quaternion()
const q2 = new THREE.Quaternion()

/** Turn a bone from its rest pose: `nod` about the side axis, then `yaw` about up (both in the cat's own space). */
function turn(b: THREE.Bone, nod: number, yaw = 0): void {
  q.setFromAxisAngle(SIDE, nod)
  q2.setFromAxisAngle(UP, yaw)
  b.quaternion.copy(q2).multiply(q)
}

/**
 * Pamuk on our own skeleton: a trot (diagonal legs together) that follows her real speed,
 * a swishing tail, a bobbing head, and body moves for naps, stalking, the pounce and the cucumber jump.
 */
export function createRiggedCat(rig: CatRig): CatView {
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)
  body.add(rig.group)
  const zzz = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 12), mat(0xffffff, 0.5, 0, 0xffffff, 0.6))
  root.add(zzz)
  const bodyRest = rig.body.position.clone()

  let last = { x: 0, z: 0 }
  let speedSmooth = 0
  let phase = 0
  let gait = 0

  function update(dt: number, time: number, c: Cat | null): void {
    root.visible = c !== null
    if (c === null) return
    const moved = Math.hypot(c.pos.x - last.x, c.pos.z - last.z)
    last = c.pos
    const step = Math.min(moved, 0.5)
    speedSmooth += (Math.min(step / Math.max(dt, 1e-4), 8) - speedSmooth) * Math.min(1, dt * 10)
    phase += step * STRIDE
    root.position.set(c.pos.x, 0, c.pos.z)
    root.rotation.y = Math.PI / 2 - c.face

    const nap = c.mode === 'nap'
    const hunting = c.mode === 'stalk' || c.mode === 'wiggle'
    const running = speedSmooth > 2.2
    // Ease the legs in and out of the walk instead of snapping.
    gait += ((speedSmooth > 0.15 && !nap ? 1 : 0) - gait) * Math.min(1, dt * 8)

    // Legs: front-left with back-right, front-right with back-left.
    const swing = (running ? 0.75 : 0.55) * gait
    const pairs = [0, Math.PI, Math.PI, 0]
    rig.legs.forEach((leg, k) => {
      const crouch = hunting ? 0.25 : nap ? 1.1 : 0
      turn(leg, Math.sin(phase + pairs[k]) * swing + (k < 2 ? -crouch : crouch))
    })
    // Body: two bobs per stride, lower while stalking or napping.
    const bob = Math.abs(Math.sin(phase)) * 0.025 * gait
    const low = nap ? -0.12 : hunting ? -0.06 : 0
    rig.body.position.set(bodyRest.x, bodyRest.y + (bob + low) * rig.hip * 4, bodyRest.z)
    turn(rig.body, Math.sin(phase * 2) * 0.03 * gait)

    // Tail: a lazy swish, quick flicks while hunting, straight up and shaking when scared, curled for a nap.
    const scared = c.mode === 'scared'
    const f = hunting ? 9 : gait > 0.5 ? 5 : 2.2
    const amp = nap ? 0.05 : hunting ? 0.3 : 0.18
    rig.tail.forEach((b, k) => {
      const yaw = Math.sin(time * f - k * 0.8) * amp * (1 + k * 0.4)
      const nod = nap ? 0.5 : scared ? -0.25 + Math.sin(time * 40 + k) * 0.05 : -0.05 * k
      turn(b, nod, yaw)
    })
    // Head: looks around, tips up to meow, rests for a nap, nods with the walk.
    const nod = c.mode === 'meow' ? -0.4 + Math.sin(time * 12) * 0.08 : nap ? 0.45 : hunting ? 0.15 : Math.sin(phase * 2) * 0.06 * gait
    turn(rig.head, nod, nap ? 0 : Math.sin(time * 0.7) * 0.35 * (1 - gait * 0.6))

    // Whole-body moves on top: wiggle before a pounce, the pounce arc, the cucumber jump.
    let y = 0
    let rx = 0
    let rz = 0
    let sx = 1
    let sy = 1
    if (c.mode === 'wiggle') rz = Math.sin(time * 30) * 0.08
    if (c.mode === 'meow') rx = -0.06
    if (c.mode === 'pounce') {
      const k = 1 - Math.max(0, c.timer) / CAT.pounceTime
      y = Math.sin(k * Math.PI) * 1.1
      rx = -0.4 + k * 0.8
    }
    if (scared && c.hop > 0) {
      y = Math.sin((1 - c.hop / 0.7) * Math.PI) * 1.6
      sx = 1.15
      sy = 1.25
    }
    body.scale.set(sx, sy, sx)
    body.rotation.set(rx, 0, rz)
    root.position.y = y
    zzz.visible = nap
    zzz.position.set(0.25, 0.55 + ((time * 0.5) % 1) * 0.5, 0.25)
  }

  return { group: root, update }
}
