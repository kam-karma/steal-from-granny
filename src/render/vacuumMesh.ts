import * as THREE from 'three'
import type { Vacuum } from '../sim/types'
import { at, cyl, mat, rbox, shadowed } from './kit'

export interface VacuumView {
  readonly group: THREE.Group
  readonly update: (v: Vacuum | null, time: number) => void
}

/** A round robot vacuum with spinning side brushes and a blinking light. */
export function createVacuum(): VacuumView {
  const root = new THREE.Group()
  const body = cyl(0.38, 0.4, 0.12, mat(0x37474f, 0.35, 0.3), 36)
  body.position.y = 0.09
  const top = cyl(0.33, 0.36, 0.03, mat(0xeceff1, 0.25, 0.1), 36)
  top.position.y = 0.165
  const bumper = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.03, 8, 36, Math.PI), mat(0x263238, 0.6))
  bumper.rotation.x = Math.PI / 2
  bumper.position.y = 0.08
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshStandardMaterial({ color: 0x40c4ff, emissive: 0x40c4ff, emissiveIntensity: 2 }))
  led.position.set(0, 0.19, 0.18)
  const button = at(cyl(0.06, 0.06, 0.02, mat(0x90a4ae, 0.3, 0.5), 20), 0, 0.185, 0)
  root.add(body, top, bumper, led, button)
  const brushes: THREE.Group[] = []
  for (const s of [-1, 1]) {
    const b = new THREE.Group()
    b.position.set(s * 0.27, 0.02, 0.25)
    for (let k = 0; k < 3; k++) {
      const bristle = rbox(0.18, 0.01, 0.02, mat(0x212121, 0.9), 0.004)
      bristle.rotation.y = (k / 3) * Math.PI
      b.add(bristle)
    }
    root.add(b)
    brushes.push(b)
  }
  shadowed(root)
  const ledMat = led.material as THREE.MeshStandardMaterial

  return {
    group: root,
    update: (v, time) => {
      root.visible = v !== null
      if (v === null) return
      root.position.set(v.pos.x, 0, v.pos.z)
      root.rotation.y = Math.PI / 2 - v.face
      brushes.forEach((b, i) => (b.rotation.y = time * (i === 0 ? 14 : -14)))
      ledMat.emissiveIntensity = v.pause > 0 ? 0.6 : 1.5 + Math.sin(time * 8) * 1
    },
  }
}
