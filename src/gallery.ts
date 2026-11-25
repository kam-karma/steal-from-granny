import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { HOUSE_MODELS } from './render/house'
import { PROP_MODELS } from './render/props'
import { loadModels, model, type ModelKey } from './render/models'

/** Dev page: every model in a grid with its name, to check scale and which way it faces (+z = towards you). */
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
document.body.style.margin = '0'
document.body.appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xdde4ee)
scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 2.2))
const sun = new THREE.DirectionalLight(0xffffff, 1.5)
sun.position.set(5, 10, 8)
scene.add(sun)
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 400)
const controls = new OrbitControls(camera, renderer.domElement)

const pack = new URLSearchParams(location.search).get('pack') ?? 'k'
const params = new URLSearchParams(location.search)
const from = Number(params.get('from') ?? 0)
const count = Number(params.get('n') ?? 999)
const all: ModelKey[] = [...new Set([...HOUSE_MODELS, ...PROP_MODELS])].filter((k) => k.startsWith(`${pack}:`))
const keys = all.slice(from, from + count)

function label(text: string): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 48
  const g = c.getContext('2d') as CanvasRenderingContext2D
  g.fillStyle = '#000a'
  g.fillRect(0, 0, 256, 48)
  g.fillStyle = '#fff'
  g.font = 'bold 22px sans-serif'
  g.fillText(text, 8, 32)
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }))
  s.scale.set(2, 0.375, 1)
  return s
}

void loadModels(keys).then(() => {
  const cols = Number(params.get('cols') ?? 12)
  const gap = 3.4
  keys.forEach((k, i) => {
    const x = (i % cols) * gap
    const z = Math.floor(i / cols) * gap
    const m = model(k)
    m.position.set(x, 0, z)
    scene.add(m)
    const l = label(k.slice(2))
    l.position.set(x, -0.3, z + 1.2)
    scene.add(l)
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(x, 0.02, z), 1.1, 0xff2222)
    scene.add(arrow)
  })
  const rows = Math.ceil(keys.length / cols)
  const cx = ((cols - 1) * gap) / 2
  const cz = ((rows - 1) * gap) / 2
  camera.position.set(cx, rows * 3.2 + 4, cz + rows * 2.6 + 5)
  controls.target.set(cx, 0, cz)
  controls.update()
})

function loop(): void {
  renderer.render(scene, camera)
  requestAnimationFrame(loop)
}
loop()
