import * as THREE from 'three'
import '@fontsource/fredoka/latin-500.css'
import '@fontsource/fredoka/latin-600.css'
import '@fontsource/fredoka/latin-700.css'
import '@fontsource/fredoka/latin-ext-500.css'
import '@fontsource/fredoka/latin-ext-600.css'
import '@fontsource/fredoka/latin-ext-700.css'
import './style.css'
import { createSfx } from './audio'
import { createDirector } from './director'
import { createHud } from './hud'
import { preloadIcons } from './icons'
import { createInput } from './input'
import { nightTwist, propName, questText, setLang, t } from './i18n'
import { createMenu, type Settings } from './menu'
import { createPlatform } from './platform'
import { createCat, type CatView } from './render/catMesh'
import { createCone } from './render/cone'
import { createFx } from './render/fx'
import { createPerson, type PersonView } from './render/granny'
import { loadRigged } from './render/rigged'
import { loadCatRig } from './render/catRig'
import { createRiggedCat } from './render/riggedCat'
import { createRiggedPerson } from './render/riggedPerson'
import { buildHouse, HOUSE_MODELS, type HouseView } from './render/house'
import { createJelly } from './render/jelly'
import { loadModels } from './render/models'
import { createPropsView, PROP_MODELS } from './render/props'
import { createStage } from './render/stage'
import { createVacuum } from './render/vacuumMesh'
import type { PropKind } from './sim/catalog'
import { makeRules } from './sim/config'
import { botInput, newBot, type Bot } from './sim/bot'
import { bellyKinds, continueAfterCaught, createGame, hasTargets, stepGame } from './sim/game'
import { dist } from './sim/geom'
import { EXIT, HOUSE } from './sim/layout'
import { addHabits, addToAlbum, bankNight, favourite, newSave, parseSave, SKINS, type Save } from './sim/meta'
import { applyNight, ensureQuests, localDay, type NightStats, type QuestId } from './sim/quests'
import type { GameEvent, GameState, OwnerKind, PlayerInput } from './sim/types'

const SAVE_KEY = 'kilik-soygunu-save-v1'

function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw === null ? newSave() : parseSave(JSON.parse(raw))
  } catch (error) {
    console.error('Save could not be read, starting fresh.', error)
    return newSave()
  }
}
let save = loadSave()
function persist(s: Save): void {
  save = s
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s))
  } catch (error) {
    console.error('Save could not be written.', error)
  }
}

const SETTINGS_KEY = 'kilik-soygunu-settings-v1'

function loadSettings(): Settings {
  const lang = navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en'
  const base: Settings = { sound: true, music: true, quality: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'low' : 'high', lang }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw === null) return base
    const r = JSON.parse(raw) as Partial<Settings>
    return {
      sound: r.sound !== false,
      music: r.music !== false,
      quality: r.quality === 'low' ? 'low' : r.quality === 'high' ? 'high' : base.quality,
      lang: r.lang === 'tr' || r.lang === 'en' ? r.lang : lang,
    }
  } catch (error) {
    console.error('Settings could not be read.', error)
    return base
  }
}
let settings = loadSettings()
setLang(settings.lang)

const canvas = document.getElementById('stage') as HTMLCanvasElement
const stage = createStage(canvas)
const fx = createFx(stage.scene)
const hud = createHud(document.body)
hud.show(false)
const sfx = createSfx()
const platform = createPlatform((muted) => sfx.setAdMute(muted))
let nightsStarted = 0

function applySettings(next: Settings): void {
  const langChanged = next.lang !== settings.lang
  settings = next
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  } catch (error) {
    console.error('Settings could not be written.', error)
  }
  setLang(next.lang)
  sfx.setSound(next.sound)
  sfx.setMusic(next.music)
  stage.setQuality(next.quality)
  if (langChanged) hud.relabel()
}
const jelly = createJelly()
jelly.setSkin(save.skin)

const projected = new THREE.Vector3()
function toScreen(x: number, y: number, z: number): { x: number; y: number } {
  projected.set(x, y, z).project(stage.camera)
  return { x: (projected.x * 0.5 + 0.5) * window.innerWidth, y: (-projected.y * 0.5 + 0.5) * window.innerHeight }
}
const director = createDirector(hud, sfx, fx, jelly, toScreen)

type Mode = 'loading' | 'menu' | 'play' | 'paused' | 'result'
let mode: Mode = 'loading'
let state: GameState = createGame(1, 0, makeRules(save.difficulty, save.upgrades))
let house: HouseView | null = null

const menu = createMenu(document.body, {
  save: () => save,
  setSave: (s) => {
    persist(s)
    jelly.setSkin(s.skin)
  },
  start: (n, boost) => startNight(n, boost),
  click: () => {
    sfx.unlock()
    sfx.poke()
  },
  coin: () => sfx.coin(),
  rewarded: () => platform.rewardedBreak(),
  settings: () => settings,
  setSettings: (s) => applySettings(s),
})
applySettings(settings)

const input = createInput(canvas, hud.buttons, () => toScreen(state.player.pos.x, 0.5, state.player.pos.z), () => sfx.unlock())
const propsView = createPropsView(stage.scene)
stage.scene.add(jelly.group)
const people: Record<OwnerKind, PersonView> = { teyze: createPerson('teyze'), dede: createPerson('dede') }
stage.scene.add(people.teyze.group, people.dede.group)
let cat: CatView = createCat()
stage.scene.add(cat.group)

/** Tripo characters replace the hand-built ones once loaded; if one fails, the hand-built one stays. */
const RIGGED: ReadonlyArray<{ kind: OwnerKind; url: string; height: number }> = [
  { kind: 'teyze', url: 'chars/teyze.glb', height: 1.95 },
  { kind: 'dede', url: 'chars/dede.glb', height: 2.0 },
]
/** The cat is re-skinned on our own skeleton at load (see catRig.ts); it finds its own facing. */
const RIGGED_CAT: { url: string; height: number } | null = { url: 'chars/pamuk.glb', height: 0.8 }
async function loadCharacters(): Promise<void> {
  const owners = RIGGED.map(async ({ kind, url, height }) => {
    try {
      const view = createRiggedPerson(kind, await loadRigged(url, height))
      stage.scene.remove(people[kind].group)
      people[kind] = view
      stage.scene.add(view.group)
    } catch (error) {
      console.error(`Character ${kind} could not be loaded, keeping the simple one.`, error)
    }
  })
  const pet = (async () => {
    if (RIGGED_CAT === null) return
    try {
      const view = createRiggedCat(await loadCatRig(RIGGED_CAT.url, RIGGED_CAT.height))
      stage.scene.remove(cat.group)
      cat = view
      stage.scene.add(view.group)
    } catch (error) {
      console.error('The cat could not be loaded, keeping the simple one.', error)
    }
  })()
  await Promise.all([...owners, pet])
}
const vacuum = createVacuum()
stage.scene.add(vacuum.group)
const cones = [createCone(), createCone()]
for (const c of cones) stage.scene.add(c.mesh)

const guideMat = new THREE.MeshStandardMaterial({ color: 0x7dffa0, emissive: 0x2bd96b, emissiveIntensity: 1.2 })
const guide = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 4), guideMat)
guide.rotation.x = Math.PI
stage.scene.add(guide)
const pipCam = new THREE.PerspectiveCamera(62, 1.56, 0.2, 40)

/** A normal ad break between nights (never before the very first one), then the night. */
let starting = false
function startNight(n: number, boost: boolean): void {
  // One start at a time: a second tap while an ad plays must not start the night underneath it.
  if (starting) return
  starting = true
  sfx.unlock()
  menu.hide()
  const go = (): void => {
    starting = false
    beginNight(n, boost)
  }
  if (nightsStarted > 0 && !boost) void platform.commercialBreak().then(go)
  else go()
}

/** Teaching cards: three steps on the very first night, the night's new rule on the others. */
let coachPlan: Array<{ at: number; text: string; secs: number }> = []
function planCoach(n: number): void {
  const first = n === 0 && save.stars[0] === 0
  coachPlan = first
    ? [
        { at: 0.6, text: t('tutorial2'), secs: 5.5 },
        { at: 7, text: t('tutorial1'), secs: 5.5 },
        { at: 14, text: t('tutorial3'), secs: 5 },
      ]
    : [{ at: 0.6, text: `✨ ${nightTwist(n)}`, secs: 4.5 }]
}

function beginNight(n: number, boost: boolean): void {
  nightsStarted++
  planCoach(n)
  const base = makeRules(save.difficulty, save.upgrades)
  const rules = boost ? { ...base, bellyMax: base.bellyMax + 1 } : base
  state = createGame(Math.floor(Math.random() * 1e6), n, rules, favourite(save))
  if (state.learned !== null) coachPlan = [...coachPlan, { at: 5.5, text: t('learned', { k: propName(state.learned) }), secs: 5 }]
  propsView.reset(state)
  jelly.setSkin(save.skin)
  director.setTrailColor(SKINS[save.skin].color)
  stage.setDark(state.dark)
  house?.setLights(!state.dark)
  director.reset()
  announced = new Set()
  menu.hide()
  hud.show(true)
  mode = 'play'
  platform.gameplayStart()
  sfx.music('sneak')
}

/** Attract mode: behind the menu the bot plays a night on its own. */
let demoBot: Bot = newBot(true)
function startDemo(): void {
  state = createGame(Math.floor(Math.random() * 1e6), Math.floor(Math.random() * 4), makeRules('kolay'))
  demoBot = newBot(true)
  propsView.reset(state)
  jelly.setSkin(save.skin)
}

function toMenu(): void {
  platform.gameplayStop()
  stage.setDark(false)
  house?.setLights(true)
  startDemo()
  hud.show(false)
  mode = 'menu'
  sfx.music('menu')
  menu.showMain('geceler')
}

function nightStats(won: boolean): NightStats {
  const r = state.result
  return {
    ...director.counts(),
    won,
    noAlarm: !state.alarmed,
    stars: won && r !== null ? r.stars.filter(Boolean).length : 0,
    gold: won && r !== null ? r.gold : 0,
    difficulty: save.difficulty,
  }
}

/** Add this night to today's quests; returns the quests it finished. */
function bankQuests(won: boolean): QuestId[] {
  const r = applyNight(ensureQuests(save.quests, localDay()), nightStats(won))
  persist({ ...save, quests: r.quests })
  return r.finished
}

/** Cheer as soon as a quest is done, not only at the end of the night. */
let announced = new Set<QuestId>()
function announceQuests(): void {
  const preview = applyNight(ensureQuests(save.quests, localDay()), nightStats(false))
  for (const id of preview.finished) {
    if (announced.has(id)) continue
    announced.add(id)
    hud.toast(t('tQuest', { q: questText(id) }), 'good')
    sfx.coin()
  }
}

function questNotice(done: readonly QuestId[]): void {
  if (done.length > 0) menu.notice(t('questsDone', { n: done.length }))
}

function bankAlbum(): number {
  persist(addHabits(save, director.uses() as Partial<Record<PropKind, number>>))
  const kinds = [...director.seenKinds(), ...bellyKinds(state)] as PropKind[]
  const r = addToAlbum(save, kinds)
  persist(r.save)
  return r.newKinds.length
}

function onPhase(prev: GameState['phase']): void {
  if (prev === state.phase) return
  if (state.phase === 'caught') {
    mode = 'result'
    platform.gameplayStop()
    const resume = (keep: boolean): void => {
      state = continueAfterCaught(state, keep)
      menu.hide()
      mode = 'play'
      platform.gameplayStart()
    }
    menu.showCaught(
      () => resume(true),
      () => resume(false),
      () => {
        bankAlbum()
        const done = bankQuests(false)
        toMenu()
        questNotice(done)
      },
    )
  }
  if (state.phase === 'won' && state.result !== null) {
    mode = 'result'
    platform.gameplayStop()
    sfx.music('menu')
    const night = state.night
    const result = state.result
    menu.showWin(night, result, (mult) => {
      const fresh = bankAlbum()
      const r = bankNight(save, night, result, mult)
      persist(r.save)
      const done = bankQuests(true)
      toMenu()
      if (fresh > 0) menu.notice(t('newKinds', { n: fresh }))
      questNotice(done)
    })
  }
}

function handle(events: readonly GameEvent[]): void {
  for (const e of events) director.event(e, state)
  if (events.length > 0) announceQuests()
}

const camPos = new THREE.Vector3(0, 30, 30)
const camLook = new THREE.Vector3()
function updateCamera(dt: number, time: number): void {
  if (mode === 'loading') {
    const a = time * 0.06
    camPos.lerp(new THREE.Vector3(Math.sin(a) * 6, 24, 24 + Math.cos(a) * 3), 1 - Math.exp(-dt * 1.5))
    camLook.lerp(new THREE.Vector3(0, 0, 0), 1 - Math.exp(-dt * 1.5))
  } else if (mode === 'menu') {
    // Follow the demo jelly from high up, slowly.
    const p = state.player.pos
    const a = time * 0.05
    camPos.lerp(new THREE.Vector3(p.x * 0.6 + Math.sin(a) * 4, 19, p.z * 0.5 + 15), 1 - Math.exp(-dt * 0.8))
    camLook.lerp(new THREE.Vector3(p.x * 0.6, 0, p.z * 0.5), 1 - Math.exp(-dt * 0.8))
  } else {
    const p = state.player.pos
    const portrait = window.innerHeight > window.innerWidth
    const cx = portrait ? p.x : Math.max(HOUSE.minX + 6, Math.min(HOUSE.maxX - 6, p.x))
    const cz = Math.max(HOUSE.minZ + 3, Math.min(HOUSE.maxZ - 3, p.z))
    const height = portrait ? 12.5 : 12
    const back = portrait ? 8.6 : 8.6
    camPos.lerp(new THREE.Vector3(cx, height, cz + back), 1 - Math.exp(-dt * 3.5))
    camLook.lerp(new THREE.Vector3(cx, 0.4, cz - 1.0), 1 - Math.exp(-dt * 4.5))
  }
  stage.camera.position.copy(camPos)
  const sh = director.shake()
  if (sh > 0) stage.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * sh * 0.5, (Math.random() - 0.5) * sh * 0.5, 0))
  stage.camera.lookAt(camLook)
  stage.key.position.set(camLook.x - 6, 22, camLook.z + 10)
  stage.key.target.position.set(camLook.x, 0, camLook.z)
}

function updateGuide(time: number): void {
  let target: { x: number; z: number; y: number } | null = null
  if (hasTargets(state)) target = { x: EXIT.x + 0.6, z: EXIT.z, y: 2.3 }
  else {
    const next = state.targets.map((id) => state.props[id]).find((p) => p.present && dist(p.pos, state.player.pos) > 2.5)
    if (next !== undefined) target = { x: next.pos.x, z: next.pos.z, y: 2.4 }
  }
  guide.visible = mode === 'play' && target !== null
  if (target !== null) guide.position.set(target.x, target.y + Math.abs(Math.sin(time * 4)) * 0.4, target.z)
  guide.rotation.y = time * 2
}

const FIXED = 1 / 60
const idle: PlayerInput = { move: { x: 0, z: 0 }, interact: false, eyes: false, spit: false }
let acc = 0
let last = performance.now()
let time = 0

function step(now: number): void {
  // Never negative: a hidden tab or a hand-run frame can leave `last` ahead of the clock.
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000))
  last = now
  time += dt
  const raw = mode === 'play' ? input.read() : (input.read(), idle)
  if (mode === 'play') {
    acc += dt
    let first = true
    while (acc >= FIXED && mode === 'play') {
      const prev = state.phase
      const r = stepGame(state, first ? raw : { ...raw, spit: false }, FIXED)
      first = false
      state = r.state
      handle(r.events)
      onPhase(prev)
      acc -= FIXED
    }
  } else if (mode === 'menu') {
    acc += dt
    while (acc >= FIXED) {
      const b = botInput(demoBot, state, FIXED)
      demoBot = b.bot
      state = stepGame(state, b.input, FIXED).state
      acc -= FIXED
      if (state.phase !== 'play' || state.time > 150) startDemo()
    }
  } else acc = 0

  const inGame = mode !== 'menu' && mode !== 'loading'
  const shown = mode !== 'loading'
  propsView.sync(state, time)
  jelly.group.visible = shown
  jelly.update(dt, time, state, state.owners[0]?.pos ?? null)
  const views = [people.teyze, people.dede]
  views.forEach((v) => (v.group.visible = false))
  state.owners.forEach((o, i) => {
    const v = o.kind === 'dede' ? people.dede : people.teyze
    v.group.visible = true
    v.update(dt, time, o, state.tickle !== null && state.tickle.owner === i)
  })
  cat.update(dt, time, state.cat)
  vacuum.update(shown ? state.vacuum : null, time)
  cones.forEach((c, i) => c.update(shown ? (state.owners[i] ?? null) : null, state.rules, time))
  fx.update(dt)
  updateGuide(time)
  updateCamera(dt, time)
  house?.cutaway(inGame ? state.player.pos : { x: 0, z: -20 }, dt)

  const ownerPts = state.owners.map((o) => toScreen(o.pos.x, 2.15, o.pos.z))
  const catPt = state.cat === null ? { x: -999, y: -999 } : toScreen(state.cat.pos.x, 0.9, state.cat.pos.z)
  const playerPt = toScreen(state.player.pos.x, 0.5, state.player.pos.z)
  const watcher = state.owners.findIndex(
    (o) => o.seesPlayer || (state.tickle !== null && state.tickle.owner === state.owners.indexOf(o)) || (o.mode === 'investigate' && dist(o.pos, state.player.pos) < 6),
  )
  const pip = mode === 'play' && watcher >= 0
  if (mode === 'play') {
    const alarm = state.owners.some((o) => o.mode === 'alarm')
    sfx.music(alarm ? 'chase' : 'sneak')
    sfx.tension(Math.max(0, ...state.owners.map((o) => o.suspicion)) / 100)
  }
  if (mode === 'play' && coachPlan.length > 0 && state.time >= coachPlan[0].at) {
    const c = coachPlan[0]
    coachPlan = coachPlan.slice(1)
    hud.coach(c.text, c.secs)
  }
  if (mode === 'play') director.tick(dt, state, ownerPts, catPt)
  if (inGame) {
    hud.update(state, { owners: ownerPts, cat: catPt, player: playerPt, hint: director.hint(state), hold: director.holdProgress(state), pip })
  }

  stage.render()
  if (pip) {
    const o = state.owners[watcher]
    pipCam.position.set(o.pos.x, 1.55, o.pos.z)
    pipCam.lookAt(o.pos.x + Math.cos(o.face) * 5, 0.5, o.pos.z + Math.sin(o.face) * 5)
    const r = hud.pipRect()
    pipCam.aspect = r.w / r.h
    pipCam.updateProjectionMatrix()
    const vis = views.map((v) => v.group.visible)
    views.forEach((v) => (v.group.visible = false))
    cones.forEach((c) => (c.mesh.visible = false))
    guide.visible = false
    stage.renderInset(pipCam, r.x, r.y, r.w, r.h)
    views.forEach((v, i) => (v.group.visible = vis[i]))
  }
}

function frame(now: number): void {
  step(now)
  requestAnimationFrame(frame)
}

function pauseGame(): void {
  if (mode !== 'play') return
  mode = 'paused'
  platform.gameplayStop()
  menu.showPause(
    () => {
      menu.hide()
      mode = 'play'
      platform.gameplayStart()
    },
    () => startNight(state.night, false),
    () => {
      bankAlbum()
      const done = bankQuests(false)
      toMenu()
      questNotice(done)
    },
  )
}
hud.onPause(pauseGame)
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') pauseGame()
})
// A hidden tab pauses the night and the sound.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseGame()
    sfx.suspend()
  } else sfx.resume()
})
// Browsers only allow sound after a first click or key.
const firstGesture = (): void => {
  sfx.unlock()
  if (mode === 'menu') sfx.music('menu')
  window.removeEventListener('pointerdown', firstGesture)
  window.removeEventListener('keydown', firstGesture)
}
window.addEventListener('pointerdown', firstGesture)
window.addEventListener('keydown', firstGesture)

requestAnimationFrame(frame)
preloadIcons([
  'coin', 'star', 'starEmpty', 'check', 'target', 'belly', 'grab', 'hide', 'spit', 'pause', 'feather', 'flame',
  'teyzeCalm', 'teyzeSus', 'teyzeAlarm', 'dedeCalm', 'dedeSus', 'dedeAlarm',
])
menu.showLoading(0)
Promise.all([loadModels([...HOUSE_MODELS, ...PROP_MODELS], (k) => menu.showLoading(k)), loadCharacters()])
  .then(() => {
    house = buildHouse(stage.scene)
    startDemo()
    mode = 'menu'
    menu.showMain('geceler')
    platform.loadingFinished()
  })
  .catch((error: unknown) => {
    console.error('Loading failed', error)
    menu.showError(() => location.reload())
  })

// Dev-only hook for browser checks.
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__game = {
    get state() {
      return state
    },
    get mode() {
      return mode
    },
    get views() {
      return { people, cat, scene: stage.scene }
    },
    get save() {
      return save
    },
    patch: (fn: (s: GameState) => GameState) => {
      state = fn(state)
    },
    teleport: (x: number, z: number) => {
      state = { ...state, player: { ...state.player, pos: { x, z } } }
    },
    start: (n = 0) => startNight(n, false),
    /** Run frames by hand (the browser pauses animation frames in a hidden tab). */
    advance: (seconds: number) => {
      for (let k = 0; k < Math.round(seconds * 30); k++) step(last + 1000 / 30)
      last = performance.now()
    },
    setSave: (s: Save) => persist(s),
  }
}
