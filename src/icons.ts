import type { PropKind } from './sim/catalog'

/**
 * Game art icons (made with Nano Banana, cut by scripts/cut-icons.py) in public/ui/icons.
 * Every prop kind has an icon with the same name; these are the interface icons.
 */
export type UiIcon =
  | 'coin' | 'star' | 'starEmpty' | 'lock' | 'target' | 'check' | 'gift' | 'jar' | 'gear' | 'moon' | 'album'
  | 'shop' | 'scroll' | 'video' | 'grab' | 'hide' | 'spit' | 'speed' | 'ice' | 'belly' | 'feather' | 'chameleon'
  | 'masks' | 'moneybag' | 'shush' | 'flame' | 'sound' | 'music' | 'pause' | 'swap'

export type Portrait = 'teyzeCalm' | 'teyzeSus' | 'teyzeAlarm' | 'dedeCalm' | 'dedeSus' | 'dedeAlarm' | 'catCalm' | 'catAngry' | 'catScared'

export const iconUrl = (name: UiIcon | PropKind | Portrait): string => `ui/icons/${name}.webp`

/** An inline icon image; `cls` adds a size or effect class. */
export function ic(name: UiIcon | PropKind | Portrait, cls = ''): string {
  return `<img class="ic ${cls}" src="${iconUrl(name)}" alt="" draggable="false">`
}

/** Emoji in translated strings that have a drawn icon. */
const SWAPS: ReadonlyArray<[string, UiIcon]> = [
  ['🪙', 'coin'],
  ['⭐', 'star'],
  ['🎯', 'target'],
  ['✅', 'check'],
  ['🎁', 'gift'],
  ['🫙', 'jar'],
  ['🔒', 'lock'],
  ['🌙', 'moon'],
  ['📖', 'album'],
  ['🛒', 'shop'],
  ['📜', 'scroll'],
  ['📺', 'video'],
  ['⚙️', 'gear'],
  ['🏆', 'kupa' as UiIcon],
  ['💦', 'spit'],
  ['✋', 'grab'],
  ['😑', 'hide'],
  ['🏃', 'speed'],
  ['🥒', 'salatalik' as UiIcon],
  ['💰', 'moneybag'],
  ['🎭', 'masks'],
  ['😱', 'teyzeAlarm' as UiIcon],
  ['🐱', 'catAngry' as UiIcon],
  ['😹', 'catScared' as UiIcon],
  ['🧠', 'teyzeSus' as UiIcon],
]

/** Any emoji left over after the swaps (they would clash with the drawn art). */
const LEFTOVER = /(?:\p{Extended_Pictographic}|‍|️)+\s?/gu

/** Swap known emoji in our own (trusted) strings for icon images and drop the rest. */
export function rich(text: string): string {
  const marked = SWAPS.reduce((s, [emoji, name]) => s.split(emoji).join(`\u0000${name}\u0001`), text)
  return marked.replace(LEFTOVER, '').replace(/\u0000(\w+)\u0001/g, (_, name: string) => ic(name as UiIcon))
}

/** Start loading every icon so menus never pop in. */
export function preloadIcons(names: ReadonlyArray<UiIcon | PropKind | Portrait>): void {
  for (const n of names) {
    const img = new Image()
    img.src = iconUrl(n)
  }
}
