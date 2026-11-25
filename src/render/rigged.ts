import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'

/**
 * Rigged, animated characters made in Tripo (GLB with a skeleton and idle / walk / run clips).
 * A template is loaded once; every character in the scene is a skinned clone with its own mixer.
 */
export type Motion = 'idle' | 'walk' | 'run'

export interface RiggedTemplate {
  readonly scene: THREE.Object3D
  readonly clips: Partial<Record<Motion, THREE.AnimationClip>>
  readonly scale: number
}

export interface RiggedInstance {
  readonly group: THREE.Group
  /** Cross-fade to a motion; `speed` scales its playback. */
  readonly play: (m: Motion, speed?: number) => void
  readonly update: (dt: number) => void
  /** A bone by any of the given name fragments (e.g. "RightHand"), for holding props. */
  readonly bone: (...names: string[]) => THREE.Object3D | null
  /**
   * Pose a bone by hand: its rest pose turned by `turn`, a rotation given in the model's own space
   * (as exported, before any turn). For bones no clip animates; call parents before children.
   */
  readonly pose: (bone: THREE.Object3D, turn: THREE.Quaternion) => void
}

const loader = new GLTFLoader()

function pickClips(clips: readonly THREE.AnimationClip[]): Partial<Record<Motion, THREE.AnimationClip>> {
  const find = (re: RegExp): THREE.AnimationClip | undefined => clips.find((c) => re.test(c.name.toLowerCase()))
  const out: Partial<Record<Motion, THREE.AnimationClip>> = {
    idle: find(/idle|stand|breath/),
    walk: find(/walk/),
    run: find(/run|jog|sprint/),
  }
  // Unnamed clips: take them in order idle, walk, run.
  const rest = clips.filter((c) => !Object.values(out).includes(c))
  for (const m of ['idle', 'walk', 'run'] as Motion[]) if (out[m] === undefined && rest.length > 0) out[m] = rest.shift()
  return out
}

/** Load a GLB, scale it to a height in metres, stand it on the floor facing +z. */
export async function loadRigged(url: string, height: number, turn = 0): Promise<RiggedTemplate> {
  const gltf = await loader.loadAsync(url)
  const scene = gltf.scene
  scene.rotation.y = turn
  scene.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(scene)
  const size = box.getSize(new THREE.Vector3())
  const scale = height / Math.max(1e-3, size.y)
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) {
      m.castShadow = true
      m.receiveShadow = true
      m.frustumCulled = false
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) {
        const sm = mat as THREE.MeshStandardMaterial
        if (sm.isMeshStandardMaterial) {
          // Generated PBR maps can look metallic; keep the toy look.
          sm.metalness = Math.min(sm.metalness, 0.1)
          sm.roughness = Math.max(sm.roughness, 0.55)
          if (sm.map) sm.map.anisotropy = 4
        }
      }
    }
  })
  const c = box.getCenter(new THREE.Vector3())
  scene.position.set(-c.x * scale, -box.min.y * scale, -c.z * scale)
  scene.scale.setScalar(scale)
  return { scene, clips: pickClips(gltf.animations), scale }
}

export function instantiate(t: RiggedTemplate): RiggedInstance {
  const group = new THREE.Group()
  const body = cloneSkinned(t.scene)
  group.add(body)
  const mixer = new THREE.AnimationMixer(body)
  const actions: Partial<Record<Motion, THREE.AnimationAction>> = {}
  for (const m of ['idle', 'walk', 'run'] as Motion[]) {
    const clip = t.clips[m]
    if (clip !== undefined) actions[m] = mixer.clipAction(clip)
  }
  let current: Motion | null = null

  function play(m: Motion, speed = 1): void {
    const next = actions[m] ?? actions.walk ?? actions.idle
    if (next === undefined) return
    next.timeScale = speed
    if (current === m) return
    const prev = current === null ? undefined : actions[current]
    next.reset().setEffectiveWeight(1).fadeIn(0.25).play()
    prev?.fadeOut(0.25)
    current = m
  }

  const bones = new Map<string, THREE.Object3D>()
  body.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.set(o.name.toLowerCase(), o)
  })
  function bone(...names: string[]): THREE.Object3D | null {
    for (const n of names) {
      const key = [...bones.keys()].find((k) => k.endsWith(n.toLowerCase()) || k.includes(n.toLowerCase()))
      if (key !== undefined) return bones.get(key) ?? null
    }
    return null
  }

  const rest = new Map<THREE.Object3D, THREE.Quaternion>()
  for (const b of bones.values()) rest.set(b, b.quaternion.clone())
  const qModel = new THREE.Quaternion()
  const qParent = new THREE.Quaternion()
  function pose(b: THREE.Object3D, qTurn: THREE.Quaternion): void {
    const r = rest.get(b)
    if (r === undefined || b.parent === null) return
    // The parent's rotation relative to the model root, so the axis can be given in model space.
    body.getWorldQuaternion(qModel).invert()
    b.parent.getWorldQuaternion(qParent).premultiply(qModel)
    b.quaternion.copy(qParent).invert().multiply(qTurn).multiply(qParent).multiply(r)
    b.updateMatrixWorld(true)
  }

  play('idle')
  return { group, play, update: (dt) => mixer.update(dt), bone, pose }
}
