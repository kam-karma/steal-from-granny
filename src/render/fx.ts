import * as THREE from 'three'

interface Bit {
  readonly mesh: THREE.Mesh
  vx: number
  vy: number
  vz: number
  life: number
  max: number
  spin: number
}

export interface Fx {
  readonly splash: (x: number, y: number, z: number, color: number, n?: number) => void
  readonly stars: (x: number, y: number, z: number) => void
  readonly coins: (x: number, y: number, z: number) => void
  /** A shiny jelly footprint that fades out. */
  readonly trail: (x: number, z: number, color: number) => void
  readonly update: (dt: number) => void
}

/** Tiny pooled particle bursts: jelly drops, dizzy stars, gold sparks. */
export function createFx(scene: THREE.Scene): Fx {
  const bits: Bit[] = []
  const drop = new THREE.SphereGeometry(0.07, 8, 6)
  const star = new THREE.OctahedronGeometry(0.09)
  const blot = new THREE.CircleGeometry(0.22, 18)
  const prints: Array<{ mesh: THREE.Mesh; life: number }> = []

  function spawn(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, n: number, speed: number, up: number, life: number): void {
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.2, transparent: true }))
      m.position.set(x, y, z)
      scene.add(m)
      const a = Math.random() * Math.PI * 2
      const s = speed * (0.5 + Math.random() * 0.8)
      bits.push({ mesh: m, vx: Math.cos(a) * s, vy: up * (0.6 + Math.random() * 0.8), vz: Math.sin(a) * s, life: life, max: life, spin: (Math.random() - 0.5) * 12 })
    }
  }

  return {
    splash: (x, y, z, color, n = 12) => spawn(drop, color, x, y, z, n, 2.4, 3.2, 0.7),
    stars: (x, y, z) => spawn(star, 0xffeb3b, x, y, z, 10, 1.6, 2.5, 1.0),
    coins: (x, y, z) => spawn(star, 0xffc93a, x, y, z, 16, 2.2, 4.5, 1.1),
    trail: (x, z, color) => {
      const old = prints.length >= 40 ? prints.shift() : undefined
      const m = old?.mesh ?? new THREE.Mesh(blot, new THREE.MeshStandardMaterial({ color, roughness: 0.05, transparent: true, depthWrite: false }))
      if (old === undefined) {
        m.rotation.x = -Math.PI / 2
        m.renderOrder = 2
        scene.add(m)
      }
      ;(m.material as THREE.MeshStandardMaterial).color.setHex(color)
      m.position.set(x + (Math.random() - 0.5) * 0.1, 0.02, z + (Math.random() - 0.5) * 0.1)
      m.scale.setScalar(0.7 + Math.random() * 0.5)
      prints.push({ mesh: m, life: 3 })
    },
    update: (dt) => {
      for (const p of prints) {
        p.life -= dt
        ;(p.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, p.life / 3) * 0.45
      }
      for (let k = bits.length - 1; k >= 0; k--) {
        const b = bits[k]
        b.life -= dt
        b.vy -= 9 * dt
        b.mesh.position.x += b.vx * dt
        b.mesh.position.y = Math.max(0.05, b.mesh.position.y + b.vy * dt)
        b.mesh.position.z += b.vz * dt
        b.mesh.rotation.y += b.spin * dt
        const k01 = Math.max(0, b.life / b.max)
        b.mesh.scale.setScalar(0.4 + k01 * 0.6)
        ;(b.mesh.material as THREE.MeshStandardMaterial).opacity = k01
        if (b.life <= 0) {
          scene.remove(b.mesh)
          ;(b.mesh.material as THREE.Material).dispose()
          bits.splice(k, 1)
        }
      }
    },
  }
}
