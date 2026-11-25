import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Our own skeleton for the Tripo cat. Its auto rig had only three leg chains, so the mesh is re-skinned here:
 * the four feet are found as the four clusters of lowest vertices, the tail as the high part behind them,
 * the head as the high part in front. Every vertex is weighted to one part, blended into the body near the joints.
 */
export interface CatRig {
  /** Faces +z, stands on y = 0, `height` tall. */
  readonly group: THREE.Group
  readonly body: THREE.Bone
  /** Front left, front right, back left, back right. */
  readonly legs: readonly THREE.Bone[]
  readonly tail: readonly THREE.Bone[]
  readonly head: THREE.Bone
  /** Height of the hips, for scaling motions. */
  readonly hip: number
}

const loader = new GLTFLoader()

interface P {
  x: number
  y: number
  z: number
}

/** Four cluster centres of 2D points (k-means, seeded by spreading out). */
function fourFeet(pts: readonly P[]): P[] {
  const centres: P[] = [pts[0]]
  while (centres.length < 4) {
    let best = pts[0]
    let bestD = -1
    for (const p of pts) {
      const d = Math.min(...centres.map((c) => (c.x - p.x) ** 2 + (c.z - p.z) ** 2))
      if (d > bestD) {
        bestD = d
        best = p
      }
    }
    centres.push(best)
  }
  let cur = centres.map((c) => ({ ...c }))
  for (let it = 0; it < 12; it++) {
    const sum = cur.map(() => ({ x: 0, z: 0, n: 0 }))
    for (const p of pts) {
      let k = 0
      let d = Infinity
      cur.forEach((c, i) => {
        const e = (c.x - p.x) ** 2 + (c.z - p.z) ** 2
        if (e < d) {
          d = e
          k = i
        }
      })
      sum[k].x += p.x
      sum[k].z += p.z
      sum[k].n += 1
    }
    cur = sum.map((s, i) => (s.n > 0 ? { x: s.x / s.n, y: 0, z: s.z / s.n } : cur[i]))
  }
  return cur
}

const smooth = (a: number, b: number, v: number): number => {
  const t = THREE.MathUtils.clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

export async function loadCatRig(url: string, height: number): Promise<CatRig> {
  const gltf = await loader.loadAsync(url)
  gltf.scene.updateMatrixWorld(true)
  let src: THREE.Mesh | null = null
  gltf.scene.traverse((o) => {
    if (src === null && (o as THREE.Mesh).isMesh) src = o as THREE.Mesh
  })
  if (src === null) throw new Error('No mesh in cat model')
  const mesh0 = src as THREE.Mesh
  const geo = mesh0.geometry.clone()
  geo.deleteAttribute('skinIndex')
  geo.deleteAttribute('skinWeight')
  geo.applyMatrix4(mesh0.matrixWorld)
  geo.computeBoundingBox()
  const box = geo.boundingBox as THREE.Box3
  const s = height / (box.max.y - box.min.y)
  const c = box.getCenter(new THREE.Vector3())
  geo.translate(-c.x, -box.min.y, -c.z)
  geo.scale(s, s, s)

  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const n = pos.count
  const P: P[] = Array.from({ length: n }, (_, i) => ({ x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) }))
  const H = height

  // Facing: the head is the bulk of the upper middle band; the two feet nearer to it are the front feet.
  const feet = fourFeet(P.filter((p) => p.y < 0.06 * H))
  const band = P.filter((p) => p.y > 0.55 * H && p.y < 0.8 * H)
  const headC = band.reduce((a, p) => ({ x: a.x + p.x / band.length, y: 0, z: a.z + p.z / band.length }), { x: 0, y: 0, z: 0 })
  const byHead = [...feet].sort((a, b) => (a.x - headC.x) ** 2 + (a.z - headC.z) ** 2 - ((b.x - headC.x) ** 2 + (b.z - headC.z) ** 2))
  const front = byHead.slice(0, 2)
  const back = byHead.slice(2)
  const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: 0, z: (a.z + b.z) / 2 })
  const fm = mid(front[0], front[1])
  const bm = mid(back[0], back[1])
  // Turn the whole cat so it walks along +z.
  const yaw = Math.atan2(-(fm.x - bm.x), fm.z - bm.z)
  geo.rotateY(yaw)
  const rot = (p: P): P => ({ x: p.x * Math.cos(yaw) + p.z * Math.sin(yaw), y: p.y, z: -p.x * Math.sin(yaw) + p.z * Math.cos(yaw) })
  for (let i = 0; i < n; i++) P[i] = { x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) }
  const F = front.map(rot)
  const B = back.map(rot)
  const leftFirst = (a: P[]): P[] => [...a].sort((u, v) => v.x - u.x) // +x is the cat's left when it faces +z
  const feetR = [...leftFirst(F), ...leftFirst(B)]
  const frontZ = (F[0].z + F[1].z) / 2
  const backZ = (B[0].z + B[1].z) / 2
  const hip = 0.27 * H
  const legR = Math.min(...feetR.flatMap((a, i) => feetR.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.z - b.z)))) * 0.62

  // Bones (no rotation in rest pose, so their axes are the model's axes).
  const root = new THREE.Bone()
  const body = new THREE.Bone()
  body.position.set(0, 0.4 * H, (frontZ + backZ) / 2)
  root.add(body)
  const bodyPos = body.position.clone()
  const legs = feetR.map((f) => {
    const b = new THREE.Bone()
    b.position.set(f.x - bodyPos.x, hip - bodyPos.y, f.z - bodyPos.z)
    body.add(b)
    return b
  })
  // Tail: the high part behind the back legs, split in three by height.
  const tailPts = P.filter((p) => p.z < backZ - 0.02 * H && p.y > 0.35 * H)
  const tailLevels = [0.4, 0.62, 0.82].map((t) => t * H)
  const tailCentre = (y: number): P => {
    const near = tailPts.filter((p) => Math.abs(p.y - y) < 0.08 * H)
    const use = near.length > 0 ? near : tailPts
    return use.reduce((a, p) => ({ x: a.x + p.x / use.length, y, z: a.z + p.z / use.length }), { x: 0, y, z: 0 })
  }
  const tailAt = tailLevels.map(tailCentre)
  const tail: THREE.Bone[] = []
  let parent: THREE.Bone = body
  let parentAt = bodyPos
  for (const t of tailAt) {
    const b = new THREE.Bone()
    b.position.set(t.x - parentAt.x, t.y - parentAt.y, t.z - parentAt.z)
    parent.add(b)
    tail.push(b)
    parent = b
    parentAt = new THREE.Vector3(t.x, t.y, t.z)
  }
  // Head: pivot at the neck, above the front legs.
  const head = new THREE.Bone()
  const neck = new THREE.Vector3(0, 0.5 * H, frontZ)
  head.position.copy(neck).sub(bodyPos)
  body.add(head)
  const bones = [root, body, ...legs, ...tail, head]
  const index = (b: THREE.Bone): number => bones.indexOf(b)

  // Weights: each vertex goes to one part, blended into the body near the joint.
  const skinIndex = new Uint16Array(n * 4)
  const skinWeight = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    const p = P[i]
    let part = index(body)
    let w = 0
    // Legs.
    let bestLeg = -1
    let bestD = Infinity
    feetR.forEach((f, k) => {
      const d = Math.hypot(p.x - f.x, p.z - f.z)
      if (d < bestD) {
        bestD = d
        bestLeg = k
      }
    })
    // Soft edges both ways (height and distance from the leg), so the skin bends instead of tearing.
    const legW = (1 - smooth(hip - 0.1 * H, hip + 0.06 * H, p.y)) * (1 - smooth(legR * 0.75, legR * 1.2, bestD))
    // Tail.
    const behind = smooth(backZ - 0.02 * H, backZ - 0.14 * H, p.z) * smooth(0.33 * H, 0.42 * H, p.y)
    // Head.
    const ahead = smooth(frontZ - 0.04 * H, frontZ + 0.08 * H, p.z) * smooth(0.42 * H, 0.52 * H, p.y)
    if (legW > 0.01 && legW >= behind && legW >= ahead) {
      part = index(legs[bestLeg])
      w = legW
    } else if (behind > 0.01 && behind >= ahead) {
      // Blend between tail bones by height.
      const lv = p.y < tailLevels[1] ? 0 : p.y < tailLevels[2] ? 1 : 2
      part = index(tail[lv])
      w = behind
    } else if (ahead > 0.01) {
      part = index(head)
      w = ahead
    }
    skinIndex[i * 4] = part
    skinWeight[i * 4] = w
    skinIndex[i * 4 + 1] = index(body)
    skinWeight[i * 4 + 1] = 1 - w
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4))
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4))

  const material = Array.isArray(mesh0.material) ? mesh0.material[0] : mesh0.material
  const sm = material as THREE.MeshStandardMaterial
  if (sm.isMeshStandardMaterial) {
    sm.metalness = Math.min(sm.metalness, 0.1)
    sm.roughness = Math.max(sm.roughness, 0.6)
  }
  const skinned = new THREE.SkinnedMesh(geo, material)
  skinned.castShadow = true
  skinned.receiveShadow = true
  skinned.frustumCulled = false
  skinned.add(root)
  skinned.bind(new THREE.Skeleton(bones))
  const group = new THREE.Group()
  group.add(skinned)
  return { group, body, legs, tail, head, hip }
}
