import { el } from './hud'
import { ic, rich, type UiIcon } from './icons'
import { diffName, lang, nightStory, nightTitle, nightTwist, propName, questText, skinName, t, upgradeName, upgradeWhat, type Lang } from './i18n'
import type { Difficulty, UpgradeId } from './sim/config'
import {
  ALBUM_COIN,
  ALBUM_KINDS,
  buySkin,
  buyUpgrade,
  dailyReward,
  LOOT_KINDS,
  MAX_LEVEL,
  nightUnlocked,
  SKINS,
  totalStars,
  upgradePrice,
  UPGRADES,
  type Save,
  type SkinId,
} from './sim/meta'
import { NIGHTS } from './sim/nights'
import { ALL_DONE_BONUS, claimBonus, claimQuest, ensureQuests, isDone, localDay, QUESTS, rerollQuest } from './sim/quests'
import { PROP_DEFS } from './sim/catalog'
import type { Result } from './sim/types'

export interface Settings {
  readonly sound: boolean
  readonly music: boolean
  readonly quality: 'high' | 'low'
  readonly lang: Lang
}

export interface MenuHost {
  readonly save: () => Save
  readonly setSave: (s: Save) => void
  readonly start: (night: number, boost: boolean) => void
  readonly click: () => void
  readonly coin: () => void
  /** Show a rewarded ad; resolves true when the reward should be given. */
  readonly rewarded: () => Promise<boolean>
  readonly settings: () => Settings
  readonly setSettings: (s: Settings) => void
}

export interface Menu {
  readonly showLoading: (k: number) => void
  readonly showError: (retry: () => void) => void
  readonly showMain: (tab?: Tab) => void
  readonly showWin: (night: number, r: Result, onBank: (mult: number) => void) => void
  readonly showCaught: (onAd: () => void, onPlain: () => void, onQuit: () => void) => void
  readonly showPause: (onResume: () => void, onRestart: () => void, onQuit: () => void) => void
  readonly hide: () => void
  readonly visible: () => boolean
  /** A short banner over the menu that fades away. */
  readonly notice: (text: string) => void
}

type Tab = 'geceler' | 'gorevler' | 'dukkan' | 'album' | 'koleksiyon'

const today = (): string => localDay()

function untilMidnight(): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const m = Math.max(0, Math.floor((next.getTime() - now.getTime()) / 60000))
  return t('hours', { h: Math.floor(m / 60), m: m % 60 })
}
const stars = (n: number): string => [0, 1, 2].map((i) => ic(i < n ? 'star' : 'starEmpty')).join('')
const logo = (cls = ''): string => `<div class="logo ${cls}"><img src="ui/logo.webp" alt="${t('titlePlain')}"></div>`

export function createMenu(parent: HTMLElement, host: MenuHost): Menu {
  const overlay = el('overlay', parent)
  let tab: Tab = 'geceler'
  let busy = false

  const open = (html: string): void => {
    overlay.innerHTML = rich(html)
    overlay.classList.add('show')
  }
  const on = (sel: string, fn: (e: HTMLElement) => void): void => {
    overlay.querySelectorAll<HTMLElement>(sel).forEach((e) =>
      e.addEventListener('click', () => {
        host.click()
        fn(e)
      }),
    )
  }
  /** Run a rewarded ad once; buttons stay inert while it plays. */
  async function ad(): Promise<boolean> {
    if (busy) return false
    busy = true
    overlay.classList.add('busy')
    try {
      return await host.rewarded()
    } finally {
      busy = false
      overlay.classList.remove('busy')
    }
  }

  function header(s: Save): string {
    const diffs = (['kolay', 'orta', 'zor'] as Difficulty[])
      .map((d) => `<button class="diff ${s.difficulty === d ? 'on' : ''}" data-d="${d}">${diffName(d)}</button>`)
      .join('')
    const tabs: Array<[Tab, string, string]> = [
      ['geceler', t('tabNights'), ic('moon')],
      ['gorevler', t('tabQuests'), ic('scroll')],
      ['dukkan', t('tabShop'), ic('shop')],
      ['album', t('tabAlbum'), ic('album')],
      ['koleksiyon', t('tabLoot'), ic('kupa')],
    ]
    return `
      <div class="mhead frame">
        ${logo()}
        <div class="wallet"><div class="chip">${ic('coin')}${s.coins}</div><div class="chip">${ic('star')}${totalStars(s)}<small>/${NIGHTS.length * 3}</small></div></div>
        <div class="diffs" title="${t('diffHint')}">${diffs}</div>
        <button class="gear jelly grape" title="${t('settings')}" aria-label="${t('settings')}">${ic('gear')}</button>
      </div>
      <div class="tabs">${tabs
        .map(([k, label, icon]) => {
          const badge = k === 'gorevler' && claimable(s) > 0 ? `<em>${claimable(s)}</em>` : ''
          return `<button class="tab jelly ${tab === k ? 'on' : ''}" data-t="${k}">${icon}<span>${label}</span>${badge}</button>`
        })
        .join('')}</div>`
  }

  function claimable(s: Save): number {
    const q = s.quests
    return q.list.filter((x) => isDone(x) && !x.claimed).length + (claimBonus(q) !== null ? 1 : 0)
  }

  function questStrip(s: Save): string {
    const done = s.quests.list.filter((x) => x.claimed).length
    const ready = claimable(s)
    return `<button class="qstrip note" data-t="gorevler">${t('qStrip', { d: done, n: s.quests.list.length })} ${ready > 0 ? `<em>${t('qReady', { n: ready })}</em>` : t('qDaily')}</button>`
  }

  function nightsTab(s: Save): string {
    return `${questStrip(s)}<div class="nights">${NIGHTS.map((n, i) => {
      const open = nightUnlocked(s, i)
      return `<button class="night ${open ? '' : 'locked'}" data-n="${i}" ${open ? '' : 'disabled'}>
        <img class="art" src="ui/nights/${i + 1}.webp" alt="">
        <div class="shade"></div>
        ${open ? '' : ic('lock', 'lockic')}
        <div class="nnum">${t('night', { n: i + 1 })}</div>
        <div class="info">
          <div class="ntitle">${open ? nightTitle(i) : '???'}</div>
          <div class="nloot">${open ? n.targets.map((k) => ic(k)).join('') : ''}</div>
          <div class="nstars">${stars(s.stars[i])}</div>
        </div>
      </button>`
    }).join('')}</div>`
  }

  function questsTab(s: Save): string {
    const q = s.quests
    const rows = q.list
      .map((x, i) => {
        const d = QUESTS[x.id]
        const pct = Math.round((x.progress / d.target) * 100)
        const done = isDone(x)
        const btns = x.claimed
          ? `<span class="qok">${t('qClaimed')}</span>`
          : done
            ? `<button class="buy jelly qclaim" data-i="${i}">${t('qClaim', { c: d.reward })}</button><button class="ad jelly qdouble" data-i="${i}">${ic('video')}${t('qDouble')}</button>`
            : q.rerolled
              ? ''
              : `<button class="again jelly qswap" data-i="${i}">${ic('swap')}${t('qSwap')}</button>`
        return `<div class="quest ${done ? 'done' : ''} ${x.claimed ? 'claimed' : ''}">
          <div class="qemoji">${ic(d.icon as UiIcon)}</div>
          <div class="qtext"><b>${questText(x.id)}</b><div class="qbar"><i style="width:${pct}%"></i></div><small>${x.progress}/${d.target} · ${t('qReward', { c: d.reward })}</small></div>
          <div class="qbtns">${btns}</div>
        </div>`
      })
      .join('')
    const all = q.list.every((x) => x.claimed)
    const bonus = q.bonusClaimed
      ? `<div class="qbonus got">${t('qBonusGot')}</div>`
      : `<div class="qbonus ${all ? 'ready' : ''}">${t('qBonus', { c: ALL_DONE_BONUS })} ${all ? `<button class="buy jelly qbonusbtn">${t('qBonusBtn')}</button>` : ''}</div>`
    return `<div class="quests"><p>${t('qIntro', { t: untilMidnight() })}</p>${rows}${bonus}</div>`
  }

  function shopTab(s: Save): string {
    const ups = (Object.keys(UPGRADES) as UpgradeId[])
      .map((id) => {
        const lvl = s.upgrades[id]
        const price = upgradePrice(s, id)
        const pips = Array.from({ length: MAX_LEVEL }, (_, k) => `<i class="${k < lvl ? 'on' : ''}"></i>`).join('')
        return `<div class="up">
          <div class="uemoji">${ic(UPGRADES[id].icon as UiIcon)}</div>
          <div class="utext"><b>${upgradeName(id)}</b><small>${upgradeWhat(id)}</small><div class="pips">${pips}</div></div>
          <button class="buy jelly" data-u="${id}" ${price === null || s.coins < price ? 'disabled' : ''}>${price === null ? t('max') : `${ic('coin')}${price}`}</button>
        </div>`
      })
      .join('')
    const skins = (Object.keys(SKINS) as SkinId[])
      .map((id) => {
        const k = SKINS[id]
        const owned = s.skins.includes(id)
        const color = id === 'gokkusagi' ? 'conic-gradient(red, orange, yellow, lime, cyan, blue, violet, red)' : `#${k.color.toString(16).padStart(6, '0')}`
        return `<button class="skin ${s.skin === id ? 'on' : ''}" data-s="${id}" ${!owned && s.coins < k.price ? 'disabled' : ''}>
          <i style="background:${color}"></i><b>${skinName(id)}</b><small>${owned ? (s.skin === id ? t('worn') : t('wear')) : `🪙 ${k.price}`}</small>
        </button>`
      })
      .join('')
    return `<div class="shop"><h3>${t('upgrades')}</h3>${ups}<h3>${t('skins')}</h3><div class="skins">${skins}</div></div>`
  }

  function albumTab(s: Save): string {
    const cells = ALBUM_KINDS.map((k) => {
      const got = s.album.includes(k)
      return `<div class="card ${got ? 'got' : ''}">${ic(k, got ? '' : 'ghost')}<small>${got ? propName(k) : '???'}</small></div>`
    }).join('')
    return `<div class="album"><p>${t('albumText', { c: ALBUM_COIN })} &nbsp; <b>${s.album.length}/${ALBUM_KINDS.length}</b></p><div class="grid">${cells}</div></div>`
  }

  function lootTab(s: Save): string {
    const cells = LOOT_KINDS.map((k) => {
      const n = s.trophies[k] ?? 0
      return `<div class="card trophy ${n > 0 ? 'got' : ''}">${ic(k, n > 0 ? '' : 'ghost')}<small>${n > 0 ? `${propName(k)} ×${n}` : t('worth', { v: PROP_DEFS[k].value })}</small></div>`
    }).join('')
    return `<div class="album"><p>${t('lootText')}</p><div class="grid">${cells}</div></div>`
  }

  function showSettings(onClose: () => void = () => showMain()): void {
    const st = host.settings()
    const icons: Record<string, UiIcon> = { sound: 'sound', music: 'music', quality: 'star', lang: 'scroll' }
    const row = (key: string, label: string, opts: Array<[string, string]>, cur: string): string =>
      `<div class="setrow"><span>${ic(icons[key])}${label}</span><div class="diffs">${opts.map(([v, l]) => `<button class="diff opt ${cur === v ? 'on' : ''}" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div></div>`
    open(`<div class="panel settings frame"><h2>${t('settings')}</h2>
      ${row('sound', t('sound'), [['1', t('on')], ['0', t('off')]], st.sound ? '1' : '0')}
      ${row('music', t('music'), [['1', t('on')], ['0', t('off')]], st.music ? '1' : '0')}
      ${row('quality', t('quality'), [['high', t('qHigh')], ['low', t('qLow')]], st.quality)}
      ${row('lang', t('language'), [['tr', 'Türkçe'], ['en', 'English']], lang())}
      <p class="credits">${t('credits')}</p>
      <button class="play jelly close">${t('close')}</button></div>`)
    on('.opt', (e) => {
      const k = e.dataset.k as string
      const v = e.dataset.v as string
      const cur = host.settings()
      host.setSettings(
        k === 'sound' ? { ...cur, sound: v === '1' } : k === 'music' ? { ...cur, music: v === '1' } : k === 'quality' ? { ...cur, quality: v as Settings['quality'] } : { ...cur, lang: v as Lang },
      )
      showSettings(onClose)
    })
    on('.close', () => onClose())
  }

  function showMain(next: Tab = tab): void {
    tab = next
    if (host.save().quests.day !== today()) host.setSave({ ...host.save(), quests: ensureQuests(host.save().quests, today()) })
    const s = host.save()
    const daily = dailyReward(s, today())
    const body = { geceler: nightsTab, gorevler: questsTab, dukkan: shopTab, album: albumTab, koleksiyon: lootTab }[tab](s)
    open(`<div class="menu">${header(s)}<div class="tabbody frame">${body}</div></div>${daily !== null ? `<div class="daily"><button class="jar jelly">${ic('jar')}${t('jar')}</button></div>` : ''}`)
    on('.diff', (e) => {
      host.setSave({ ...host.save(), difficulty: e.dataset.d as Difficulty })
      showMain()
    })
    on('.gear', () => showSettings())
    on('.tab', (e) => showMain(e.dataset.t as Tab))
    on('.qstrip', () => showMain('gorevler'))
    on('.night', (e) => showIntro(Number(e.dataset.n)))
    on('.buy[data-u]', (e) => {
      const nextSave = buyUpgrade(host.save(), e.dataset.u as UpgradeId)
      if (nextSave !== null) {
        host.coin()
        host.setSave(nextSave)
      }
      showMain()
    })
    on('.skin', (e) => {
      const nextSave = buySkin(host.save(), e.dataset.s as SkinId)
      if (nextSave !== null) host.setSave(nextSave)
      showMain()
    })
    const claim = (i: number, mult: number): void => {
      const r = claimQuest(host.save().quests, i, mult)
      if (r === null) return
      host.coin()
      host.setSave({ ...host.save(), quests: r.quests, coins: host.save().coins + r.coins })
      showMain()
      notice(`+${r.coins} 🪙`)
    }
    on('.qclaim', (e) => claim(Number(e.dataset.i), 1))
    on('.qdouble', (e) => {
      const i = Number(e.dataset.i)
      void ad().then((ok) => claim(i, ok ? 2 : 1))
    })
    on('.qswap', (e) => {
      const i = Number(e.dataset.i)
      void ad().then((ok) => {
        if (!ok) return
        const q = rerollQuest(host.save().quests, i, Math.floor(Math.random() * 1000))
        if (q !== null) host.setSave({ ...host.save(), quests: q })
        showMain()
      })
    })
    on('.qbonusbtn', () => {
      const r = claimBonus(host.save().quests)
      if (r === null) return
      host.coin()
      host.setSave({ ...host.save(), quests: r.quests, coins: host.save().coins + r.coins })
      showMain()
      notice(t('qBonusNotice', { c: r.coins }))
    })
    on('.jar', () => {
      const r = dailyReward(host.save(), today())
      if (r === null) return
      host.setSave(r.save)
      host.coin()
      open(`<div class="panel frame">${ic('jar', 'huge')}<h2>${t('jarTitle', { c: r.coins })}</h2><p>${t('jarText', { d: r.save.daily.streak })}</p><button class="play jelly">${t('great')}</button></div>`)
      on('.play', () => showMain())
    })
  }

  function showIntro(n: number): void {
    const night = NIGHTS[n]
    const s = host.save()
    open(`<div class="panel intro frame">
      <div class="nnum">${t('night', { n: n + 1 })}, ${diffName(s.difficulty)}</div>
      <h2>${nightTitle(n)}</h2>
      <p>${nightStory(n)}</p>
      <div class="twist note">${nightTwist(n)}</div>
      <div class="goal"><b>${t('steal')}</b> ${night.targets.map((k) => `${ic(k)}${propName(k)}`).join(', ')}</div>
      <div class="goal bonus"><b>${t('bonus')}</b> ${night.bonus.map((k) => `${ic(k)}${propName(k)}`).join(', ')}</div>
      <div class="goal">${t('noAlarmGoal')}</div>
      <button class="play jelly">${t('start')}</button>
      <button class="ad jelly boost">${ic('video')}${t('boost')}</button>
      <button class="again jelly back">${t('back')}</button>
    </div>`)
    on('.play', () => host.start(n, false))
    on('.boost', () => void ad().then((ok) => host.start(n, ok)))
    on('.back', () => showMain())
  }

  function showWin(n: number, r: Result, onBank: (mult: number) => void): void {
    open(`<div class="panel win frame">
      <h2>${t('won')}</h2>
      <div class="nnum">${t('night', { n: n + 1 })}: ${nightTitle(n)}</div>
      <div class="stars">${r.stars.map((x, i) => `<div class="${x ? 'on' : ''}">${ic(x ? 'star' : 'starEmpty')}<small>${[t('starEscaped'), t('starBonus'), t('starQuiet')][i]}</small></div>`).join('')}</div>
      <div class="lootrow">${r.loot.map((k) => ic(k)).join('')}</div>
      <div class="loot">${ic('coin')}<b class="g">${r.gold}</b></div>
      <div class="meter"><span>×2</span><span class="x3">×3</span><span class="x5">×5</span><span class="x3">×3</span><span>×2</span><i class="needle"></i></div>
      <button class="ad jelly">${ic('video')}${t('adMult')}</button>
      <button class="again jelly">${t('cont', { c: r.gold })}</button>
    </div>`)
    const needle = overlay.querySelector('.needle') as HTMLElement
    const mLabel = overlay.querySelector('.m') as HTMLElement
    const mults = [2, 3, 5, 3, 2]
    let stopped = false
    let mult = 2
    const t0 = performance.now()
    const swing = (): void => {
      if (stopped || !overlay.contains(needle)) return
      const k = (Math.sin((performance.now() - t0) / 260) + 1) / 2
      needle.style.left = `${k * 100}%`
      mult = mults[Math.min(4, Math.floor(k * 5))]
      mLabel.textContent = `×${mult}`
      requestAnimationFrame(swing)
    }
    requestAnimationFrame(swing)
    let banked = false
    const bank = (m: number): void => {
      if (banked) return
      banked = true
      onBank(m)
    }
    let adPending = false
    on('.ad', () => {
      if (stopped) return
      stopped = true
      adPending = true
      const chosen = mult
      void ad().then((ok) => {
        if (ok) {
          ;(overlay.querySelector('.g') as HTMLElement).textContent = `${r.gold * chosen}`
          host.coin()
          window.setTimeout(() => bank(chosen), 700)
        } else bank(1)
      })
    })
    on('.again', () => {
      // After an ad the doubled gold is banked by the ad path; ignore a quick extra tap.
      if (adPending) return
      stopped = true
      bank(1)
    })
  }

  function showCaught(onAd: () => void, onPlain: () => void, onQuit: () => void): void {
    open(`<div class="panel caught frame">
      ${ic('teyzeAlarm', 'huge')}
      <h2>${t('caught')}</h2>
      <p>${t('caughtText')}</p>
      <button class="ad jelly">${ic('video')}${t('caughtAd')}</button>
      <button class="again jelly plain">${t('caughtPlain')}</button>
      <button class="again jelly quit">${t('toMenu')}</button>
    </div>`)
    on('.ad', () => void ad().then((ok) => (ok ? onAd() : onPlain())))
    on('.plain', onPlain)
    on('.quit', onQuit)
  }

  function showPause(onResume: () => void, onRestart: () => void, onQuit: () => void): void {
    open(`<div class="panel frame"><h2>${t('paused')}</h2>
      <button class="play jelly">${t('resume')}</button>
      <button class="again jelly restart">${t('restart')}</button>
      <button class="again jelly settings-btn">${ic('gear')}${t('settings')}</button>
      <button class="again jelly quit">${t('toMenu')}</button></div>`)
    on('.play', onResume)
    on('.restart', onRestart)
    on('.quit', onQuit)
    on('.settings-btn', () => showSettings(() => showPause(onResume, onRestart, onQuit)))
  }

  function notice(text: string): void {
    const n = el('notice note', parent, rich(text))
    n.style.top = `${18 + (parent.querySelectorAll('.notice').length - 1) * 58}px`
    window.setTimeout(() => n.classList.add('show'), 20)
    window.setTimeout(() => n.classList.remove('show'), 2600)
    window.setTimeout(() => n.remove(), 3100)
  }

  return {
    notice,
    showLoading: (k) =>
      open(`<div class="panel">${logo('big')}<div class="loadbar"><i style="width:${Math.round(k * 100)}%"></i></div><p>${t('loading', { p: Math.round(k * 100) })}</p></div>`),
    showError: (retry) => {
      open(`<div class="panel frame">${ic('catScared', 'huge')}<p>${t('loadFail')}</p><button class="play jelly retry">${t('retry')}</button></div>`)
      on('.retry', retry)
    },
    showMain,
    showWin,
    showCaught,
    showPause,
    hide: () => {
      overlay.classList.remove('show')
      overlay.innerHTML = ''
    },
    visible: () => overlay.classList.contains('show'),
  }
}
