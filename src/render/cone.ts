import * as THREE from 'three'
import { rayLength } from '../sim/geom'
import { ownerRange } from '../sim/owner'
import type { Owner, Rules } from '../sim/types'

const RAYS = 36

export interface ConeView {
  readonly mesh: THREE.Mesh
  readonly update: (o: Owner | null, rules: Rules, time: number) => void
}

/** Granny's gaze drawn on the floor, stopped by walls. Yellow when calm, red when she is suspicious. */
export function createCone(): ConeView {
  const pos = new Float32Array((RAYS + 2) * 3)
  const idx: number[] = []
  for (let k = 1; k <= RAYS; k++) idx.push(0, k, k + 1)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setIndex(idx)
  const m = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(geo, m)
  mesh.renderOrder = 5
  mesh.frustumCulled = false
  const calm = new THREE.Color(0xffe066)
  const hot = new THREE.Color(0xff3b30)
  const torchCol = new THREE.Color(0xfff6d8)

  function update(o: Owner | null, rules: Rules, time: number): void {
    mesh.visible = o !== null
    if (o === null) return
    const range = ownerRange(o, rules)
    const y = 0.035
    pos[0] = o.pos.x
    pos[1] = y
    pos[2] = o.pos.z
    for (let k = 0; k <= RAYS; k++) {
      const fov = rules.halfFov * o.fovMul
      const a = o.face - fov + (k / RAYS) * fov * 2
      const l = rayLength(o.pos, a, range)
      pos[(k + 1) * 3] = o.pos.x + Math.cos(a) * l
      pos[(k + 1) * 3 + 1] = y
      pos[(k + 1) * 3 + 2] = o.pos.z + Math.sin(a) * l
    }
    geo.attributes.position.needsUpdate = true
    geo.computeBoundingSphere()
    const k = Math.min(1, o.suspicion / 100)
    m.color.copy(o.torch ? torchCol : calm).lerp(hot, o.mode === 'alarm' ? 1 : k)
    m.opacity = o.mode === 'alarm' ? 0.3 + Math.sin(time * 14) * 0.08 : 0.18 + k * 0.14
    mesh.visible = o.mode !== 'tickle'
  }

  return { mesh, update }
}
