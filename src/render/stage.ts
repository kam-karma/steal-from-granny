import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

export interface Stage {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly key: THREE.DirectionalLight
  /** Low: no bloom, 1x pixels, smaller shadows (phones). */
  readonly setQuality: (q: 'high' | 'low') => void
  /** Power cut: almost no light but the moon and torches. */
  readonly setDark: (on: boolean) => void
  readonly render: () => void
  /** Draw an extra view into a screen rectangle (CSS pixels, from the top-left). */
  readonly renderInset: (cam: THREE.Camera, x: number, y: number, w: number, h: number) => void
}

/** Cosy night-time dollhouse: warm lamps inside, blue night outside, soft bloom on gold and lamps. */
export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const bg = new THREE.Color(0x1b2140)
  scene.background = bg
  scene.fog = new THREE.Fog(bg, 40, 80)

  const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 120)

  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x4a3a5a, 1.0)
  scene.add(hemi)
  const key = new THREE.DirectionalLight(0xffe6c4, 1.6)
  key.position.set(-6, 22, 14)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  const sc = key.shadow.camera
  sc.left = -15
  sc.right = 15
  sc.top = 13
  sc.bottom = -13
  sc.near = 4
  sc.far = 60
  key.shadow.bias = -0.0005
  key.shadow.normalBias = 0.03
  scene.add(key)
  scene.add(key.target)

  // Moonlight through the kitchen window, so the way in and out is easy to find.
  const moon = new THREE.PointLight(0x8fb8ff, 2.2, 6, 1.6)
  moon.position.set(-16.4, 2.0, -3)
  scene.add(moon)

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.5, 0.88)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  function resize(): void {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    bloom.resolution.set(w, h)
    camera.aspect = w / h
    camera.fov = w < h ? 60 : 42
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)

  function renderInset(cam: THREE.Camera, x: number, y: number, w: number, h: number): void {
    const H = canvas.clientHeight || window.innerHeight
    const by = H - y - h
    renderer.setScissorTest(true)
    renderer.setScissor(x, by, w, h)
    renderer.setViewport(x, by, w, h)
    renderer.render(scene, cam)
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, canvas.clientWidth || window.innerWidth, H)
  }

  let high = true
  function setQuality(q: 'high' | 'low'): void {
    high = q === 'high'
    renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 2) : 1)
    const size = high ? 2048 : 1024
    if (key.shadow.mapSize.x !== size) {
      key.shadow.mapSize.set(size, size)
      key.shadow.map?.dispose()
      key.shadow.map = null
    }
    resize()
  }

  function setDark(on: boolean): void {
    hemi.intensity = on ? 0.16 : 1.0
    hemi.color.setHex(on ? 0x8fa8ff : 0xfff1dc)
    key.intensity = on ? 0.18 : 1.6
    key.color.setHex(on ? 0x8fb8ff : 0xffe6c4)
    moon.intensity = on ? 6 : 2.2
  }

  return { renderer, scene, camera, key, setQuality, setDark, render: () => (high ? composer.render() : renderer.render(scene, camera)), renderInset }
}
