import type { PropKind } from './catalog'
import type { OwnerKind, Waypoint } from './types'

const FRONT = Math.PI / 2
const BACK = -Math.PI / 2
const LEFT = Math.PI
const RIGHT = 0

export interface OwnerDef {
  readonly kind: OwnerKind
  readonly patrol: readonly Waypoint[]
  readonly speedMul: number
  readonly rangeMul: number
  readonly alert?: boolean
  readonly torch?: boolean
}

export interface NightDef {
  readonly title: string
  readonly story: string
  readonly owners: readonly OwnerDef[]
  readonly cat: boolean
  /** Must be in the belly to leave through the window. */
  readonly targets: readonly PropKind[]
  /** Second star: all of these too. */
  readonly bonus: readonly PropKind[]
  readonly memoryMul?: number
  readonly twist: string
  readonly vacuum?: boolean
  readonly dark?: boolean
  /** Owners distrust the disguise the player used most before. */
  readonly learns?: boolean
}

/** Teyze's evening round through the whole house. */
const TEYZE_ROUND: readonly Waypoint[] = [
  { x: -1.0, z: -3.0, sweep: [BACK, LEFT, RIGHT] },
  { x: 10.5, z: -4.2, sweep: [BACK, RIGHT, LEFT] },
  { x: 13.6, z: 4.6, sweep: [FRONT, RIGHT, LEFT] },
  { x: 6.5, z: 4.2, sweep: [FRONT, LEFT, RIGHT] },
  { x: -6.4, z: 7.6, sweep: [RIGHT, LEFT, BACK] },
  { x: -12.6, z: 4.6, sweep: [LEFT, FRONT], hold: 0.9 },
  { x: -6.4, z: 7.6, sweep: [RIGHT], hold: 0.6 },
  { x: -9.2, z: -2.4, sweep: [LEFT, BACK, RIGHT] },
]

/** A shorter, faster round for later nights. */
const TEYZE_FAST: readonly Waypoint[] = [
  { x: -1.0, z: -3.0, sweep: [BACK, LEFT, RIGHT], hold: 0.95 },
  { x: 10.5, z: -4.2, sweep: [BACK, RIGHT, LEFT], hold: 0.95 },
  { x: 13.6, z: 4.6, sweep: [FRONT, RIGHT, LEFT], hold: 0.95 },
  { x: 6.5, z: 4.2, sweep: [FRONT, LEFT], hold: 0.95 },
  { x: -3.0, z: 8.0, sweep: [LEFT, RIGHT, BACK], hold: 0.95 },
  { x: -9.2, z: -2.4, sweep: [LEFT, BACK, RIGHT], hold: 0.95 },
]

/** Dede mostly sits in the living room and wanders to the dining table. */
const DEDE_ROUND: readonly Waypoint[] = [
  { x: 2.6, z: -6.6, sweep: [LEFT, BACK, FRONT, RIGHT], hold: 2.2 },
  { x: -1.5, z: 8.0, sweep: [BACK, LEFT, RIGHT], hold: 1.8 },
  { x: -10.5, z: -7.6, sweep: [LEFT, FRONT], hold: 1.6 },
]

const teyze = (patrol: readonly Waypoint[] = TEYZE_ROUND, extra: Partial<OwnerDef> = {}): OwnerDef => ({
  kind: 'teyze',
  patrol,
  speedMul: 1,
  rangeMul: 1,
  ...extra,
})
const dede = (): OwnerDef => ({ kind: 'dede', patrol: DEDE_ROUND, speedMul: 0.65, rangeMul: 0.75 })

/** Teyze with a torch in a power cut: sees far down a narrow beam, nothing outside it. */
const torch = (): OwnerDef => teyze(TEYZE_ROUND, { torch: true, rangeMul: 1.45, speedMul: 0.95 })

export const NIGHTS: readonly NightDef[] = [
  {
    title: 'İlk Gece',
    story: 'Teyze altın vazosunu yatak odasına sakladı.',
    owners: [teyze()],
    cat: false,
    targets: ['vazo'],
    bonus: ['kavanoz', 'yuzuk'],
    twist: 'Teyze bakarken kıpırdama!',
  },
  {
    title: 'Pamuk Uyanık',
    story: 'Çocuk odasındaki oyuncakları geri al. Kedi küçük eşyalara atlar!',
    owners: [teyze()],
    cat: true,
    targets: ['ayicik', 'kumbara'],
    bonus: ['radyo', 'ordek'],
    twist: 'Yeni: Kedi Pamuk. Salatalıktan korkar.',
  },
  {
    title: 'Çalışma Odası',
    story: 'Teyze’nin altın kupası ve bilgisayarı çalışma odasında.',
    owners: [teyze(TEYZE_FAST)],
    cat: true,
    vacuum: true,
    targets: ['laptop', 'kupa'],
    bonus: ['yuzuk', 'mucevher'],
    twist: 'Yeni: Robot süpürge küçük kılıkları emer!',
  },
  {
    title: 'Misafir Dede',
    story: 'Dede misafirliğe geldi. Yavaş ama her şeye bakar!',
    owners: [teyze(), dede()],
    cat: true,
    targets: ['tv', 'radyo'],
    bonus: ['mucevher', 'kavanoz', 'ordek'],
    twist: 'Yeni: İki bekçi! Eski televizyon büyük; karnını doldurur.',
  },
  {
    title: 'Elektrik Kesik',
    story: 'Fırtına çıktı, elektrikler gitti. Teyze elinde fenerle dolaşıyor!',
    owners: [torch()],
    cat: true,
    dark: true,
    targets: ['mucevher', 'vazo'],
    bonus: ['laptop', 'kumbara'],
    memoryMul: 1.3,
    twist: 'Yeni: Karanlıkta yalnızca fenerin ışığı görür — ama çok uzağı.',
  },
  {
    title: 'Büyük Soygun',
    story: 'Son gece: hepsini al ve kaç! Teyze dünkü kılıklarını hatırlıyor.',
    owners: [teyze(TEYZE_FAST, { speedMul: 1.1 }), dede()],
    cat: true,
    vacuum: true,
    learns: true,
    targets: ['vazo', 'kupa', 'tv'],
    bonus: ['mucevher', 'kumbara', 'yuzuk'],
    twist: 'Her şey bir arada. Büyük Karın yükseltmesi işe yarar!',
  },
]
