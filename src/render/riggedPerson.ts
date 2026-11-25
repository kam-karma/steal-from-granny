import * as THREE from 'three'
import type { Owner, OwnerKind } from '../sim/types'
import type { PersonView } from './granny'
import { at, cyl, mat, shadowed } from './kit'
import { instantiate, type RiggedTemplate } from './rigged'

/** Walking pace (m/s) at which the clips play at normal speed. */
const WALK_PACE = 1.5
const RUN_PACE = 3.4

/** Hang a prop on a bone so it keeps its size in metres whatever the bone's scale. */
function holdIn(bone: THREE.Object3D | null, fallback: THREE.Object3D, prop: THREE.Object3D): void {
  const parent = bone ?? fallback
  parent.updateWorldMatrix(true, false)
  const s = new THREE.Vector3()
  parent.getWorldScale(s)
  prop.scale.setScalar(1 / Math.max(1e-4, s.x))
  parent.add(prop)
}

function rollingPin(): THREE.Group {
  const g = new THREE.Group()
  const pin = cyl(0.045, 0.045, 0.5, mat(0xd7a86e, 0.6), 16)
  pin.rotation.z = Math.PI / 2
  g.add(pin)
  for (const s of [-1, 1]) g.add(at(cyl(0.02, 0.02, 0.12, mat(0xa1887f, 0.6), 10).rotateZ(Math.PI / 2), s * 0.31, 0, 0))
  return g
}

/** Dede's walking cane, held by the handle; the stick hangs down to the floor. */
function cane(): THREE.Group {
  const g = new THREE.Group()
  const wood = mat(0x4e342e, 0.5)
  g.add(at(cyl(0.022, 0.022, 0.9, wood, 10), 0, -0.45, 0))
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.022, 8, 16, Math.PI), wood)
  handle.position.set(0.06, 0, 0)
  g.add(handle)
  return g
}

function torchProp(): THREE.Group {
  const g = new THREE.Group()
  const body = cyl(0.045, 0.055, 0.22, mat(0xffca28, 0.3, 0.5), 12)
  body.rotation.x = Math.PI / 2
  const lens = at(cyl(0.06, 0.06, 0.02, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff8d0, emissiveIntensity: 3 }), 16), 0, 0, 0.12)
  lens.rotation.x = Math.PI / 2
  g.add(body, lens)
  return g
}

/** Teyze or Dede as an animated Tripo model, behaving like the hand-built PersonView. */
export function createRiggedPerson(kind: OwnerKind, template: RiggedTemplate): PersonView {
  const root = new THREE.Group()
  const lean = new THREE.Group()
  root.add(lean)
  const inst = instantiate(template)
  lean.add(inst.group)
  root.updateMatrixWorld(true)

  const rightHand = inst.bone('RightHand')
  const leftHand = inst.bone('LeftHand')
  const head = inst.bone('Head')
  const pin = rollingPin()
  holdIn(rightHand, root, pin)
  pin.visible = false
  // The cane stays upright in world space whatever the hand does, so it is updated each frame.
  const stick = kind === 'dede' ? cane() : null
  if (stick !== null) root.add(stick)
  const handPos = new THREE.Vector3()
  const torchInHand = torchProp()
  holdIn(leftHand, root, torchInHand)
  torchInHand.visible = false

  const torch = new THREE.SpotLight(0xfff2c8, 70, 15, 0.42, 0.45, 1.2)
  torch.position.set(0, 1.25, 0.3)
  torch.target.position.set(0, 0, 6)
  root.add(torch, torch.target)
  torch.visible = false
  const glow = new THREE.PointLight(0xffe0a0, 4, 3.5, 1.5)
  glow.position.set(0, 1.4, 0.4)
  root.add(glow)
  glow.visible = false
  shadowed(root)

  let last = { x: 0, z: 0 }
  let speedSmooth = 0
  const dede = kind === 'dede'

  function update(dt: number, time: number, o: Owner, poking: boolean): void {
    torch.visible = o.torch
    glow.visible = o.torch
    torchInHand.visible = o.torch
    const moved = Math.hypot(o.pos.x - last.x, o.pos.z - last.z)
    last = o.pos
    const speed = moved / Math.max(dt, 1e-4)
    speedSmooth += (Math.min(speed, 8) - speedSmooth) * Math.min(1, dt * 10)
    root.position.set(o.pos.x, 0, o.pos.z)
    root.rotation.y = Math.PI / 2 - o.face

    const alarm = o.mode === 'alarm'
    const curious = o.mode === 'investigate' || (o.suspicion > 30 && !alarm)
    if (speedSmooth < 0.25) inst.play('idle', 1)
    else if (alarm || speedSmooth > 2.6) inst.play('run', THREE.MathUtils.clamp(speedSmooth / RUN_PACE, 0.7, 1.5))
    else inst.play('walk', THREE.MathUtils.clamp(speedSmooth / WALK_PACE, 0.6, 1.6) * (dede ? 0.9 : 1))
    inst.update(dt)

    // Moods on top of the clips: lean in when curious, bob while tickling, pin out when angry.
    const targetLean = curious ? 0.14 : poking ? 0.2 + Math.max(0, Math.sin(time * 5.2)) * 0.08 : 0
    lean.rotation.x += (targetLean - lean.rotation.x) * Math.min(1, dt * 6)
    if (head !== null && curious) head.rotation.z += Math.sin(time * 2) * 0.15
    pin.visible = alarm
    if (stick !== null && rightHand !== null) {
      root.updateMatrixWorld(true)
      rightHand.getWorldPosition(handPos)
      stick.position.copy(root.worldToLocal(handPos))
      // Stretch the stick so its tip stays on the floor as the hand swings.
      stick.scale.y = THREE.MathUtils.clamp(stick.position.y / 0.9, 0.5, 1.4)
      stick.visible = !alarm
    }
  }

  return { group: root, torch, update }
}
