import type { Box, Vec } from './types'

/**
 * The big house: seven rooms on one floor, seen from the front (+z) like a dollhouse.
 * Back row: kitchen | living room | bedroom. Front row: bathroom | dining room | kids' room | study.
 */
export interface Room {
  readonly name: string
  readonly loc: string
  readonly x0: number
  readonly x1: number
  readonly z0: number
  readonly z1: number
}

export const ROOMS: readonly Room[] = [
  { name: 'Mutfak', loc: 'mutfakta', x0: -17, x1: -6, z0: -11, z1: 0 },
  { name: 'Salon', loc: 'salonda', x0: -6, x1: 6, z0: -11, z1: 0 },
  { name: 'Yatak Odası', loc: 'yatak odasında', x0: 6, x1: 17, z0: -11, z1: 0 },
  { name: 'Banyo', loc: 'banyoda', x0: -17, x1: -9, z0: 0, z1: 11 },
  { name: 'Yemek Odası', loc: 'yemek odasında', x0: -9, x1: 3, z0: 0, z1: 11 },
  { name: 'Çocuk Odası', loc: 'çocuk odasında', x0: 3, x1: 10, z0: 0, z1: 11 },
  { name: 'Çalışma Odası', loc: 'çalışma odasında', x0: 10, x1: 17, z0: 0, z1: 11 },
]
export const R = { mutfak: 0, salon: 1, yatak: 2, banyo: 3, yemek: 4, cocuk: 5, calisma: 6 } as const
export const ALL_ROOMS: readonly number[] = ROOMS.map((_, i) => i)

export const HOUSE = { minX: -17, maxX: 17, minZ: -11, maxZ: 11, wallH: 2.8 } as const
export const DOOR_W = 2.2

/** A straight wall along x (axis 'x', at z = at) or along z (axis 'z', at x = at), with door gaps. */
export interface Wall {
  readonly axis: 'x' | 'z'
  readonly at: number
  readonly from: number
  readonly to: number
  readonly doors: readonly number[]
  readonly outer?: boolean
  readonly front?: boolean
}

export const WALLS: readonly Wall[] = [
  { axis: 'x', at: -11, from: -17, to: 17, doors: [], outer: true },
  { axis: 'x', at: 0, from: -17, to: 17, doors: [-7.5, 0, 15.2] },
  { axis: 'x', at: 11, from: -17, to: 17, doors: [], outer: true, front: true },
  { axis: 'z', at: -17, from: -11, to: 11, doors: [], outer: true },
  { axis: 'z', at: 17, from: -11, to: 11, doors: [], outer: true },
  { axis: 'z', at: -6, from: -11, to: 0, doors: [-4.5] },
  { axis: 'z', at: 6, from: -11, to: 0, doors: [-4.5] },
  { axis: 'z', at: -9, from: 0, to: 11, doors: [5.5] },
  { axis: 'z', at: 3, from: 0, to: 11, doors: [5.5] },
  { axis: 'z', at: 10, from: 0, to: 11, doors: [5.5] },
]

export const SPAWN: Vec = { x: -15.3, z: -3 }
export const EXIT = { x: -16.4, z: -3, r: 0.95 } as const
export const WINDOW = { x: -17, z: -3, w: 2.0 } as const

export function roomAt(p: Vec): number {
  const i = ROOMS.findIndex((r) => p.x >= r.x0 && p.x < r.x1 && p.z >= r.z0 && p.z < r.z1)
  if (i >= 0) return i
  // Outside (clamped walkers sit on the edge): nearest room centre.
  let best = 0
  let bd = Infinity
  ROOMS.forEach((r, k) => {
    const d = Math.hypot(p.x - (r.x0 + r.x1) / 2, p.z - (r.z0 + r.z1) / 2)
    if (d < bd) {
      bd = d
      best = k
    }
  })
  return best
}

export interface Door {
  readonly pos: Vec
  readonly normal: Vec
  readonly a: number
  readonly b: number
}

/** Every door, with the two rooms it joins. */
export const DOORS: readonly Door[] = WALLS.filter((w) => !w.outer).flatMap((w) =>
  w.doors.map((c) => {
    const pos = w.axis === 'x' ? { x: c, z: w.at } : { x: w.at, z: c }
    const normal = w.axis === 'x' ? { x: 0, z: 1 } : { x: 1, z: 0 }
    const a = roomAt({ x: pos.x - normal.x * 0.5, z: pos.z - normal.z * 0.5 })
    const b = roomAt({ x: pos.x + normal.x * 0.5, z: pos.z + normal.z * 0.5 })
    return { pos, normal, a, b }
  }),
)

export type FurnitureModel = `k:${string}` | `y:${string}`

export interface Furniture {
  readonly model: FurnitureModel
  readonly box: Box
  /** Rotation of the model around y (front faces +z at 0). */
  readonly rot: number
  readonly scale?: number
  /** Height above the floor (wall shelves, things on tables). */
  readonly y?: number
  /** Blocks walking. */
  readonly solid: boolean
  /** Tall enough to hide behind: blocks sight. */
  readonly tall: boolean
  /** Collision only; the look comes from other entries (the kitchen counter row). */
  readonly hidden?: boolean
}

const F = Math.PI
const L = Math.PI / 2
const Rt = -Math.PI / 2

function fur(model: FurnitureModel, x: number, z: number, w: number, d: number, h: number, rot = 0, extra: Partial<Furniture> = {}): Furniture {
  return { model, box: { x, z, w, d, h }, rot, solid: true, tall: h >= 1.6, ...extra }
}
const deco = (model: FurnitureModel, x: number, z: number, rot = 0, extra: Partial<Furniture> = {}): Furniture => ({
  model,
  box: { x, z, w: 0, d: 0, h: 0 },
  rot,
  solid: false,
  tall: false,
  ...extra,
})

export const FURNITURE: readonly Furniture[] = [
  // Kitchen: counter row on the back wall, fridge, table.
  deco('k:kitchenCabinet', -16.0, -10.47),
  deco('k:kitchenSink', -15.1, -10.47),
  deco('k:kitchenStove', -14.2, -10.47),
  deco('k:kitchenCabinetDrawer', -13.3, -10.47),
  deco('k:kitchenCabinet', -12.4, -10.47),
  fur('k:kitchenCabinet', -14.2, -10.47, 4.5, 0.95, 1.0, 0, { hidden: true }),
  fur('k:kitchenFridgeLarge', -11.2, -10.52, 1.1, 0.9, 1.95),
  deco('k:kitchenCabinetUpper', -16.0, -10.8, 0, { y: 1.55 }),
  deco('k:kitchenCabinetUpperDouble', -15.1, -10.8, 0, { y: 1.55 }),
  deco('k:hoodModern', -14.2, -10.8, 0, { y: 1.6 }),
  deco('k:kitchenCabinetUpper', -13.3, -10.8, 0, { y: 1.55 }),
  deco('k:kitchenCabinetUpper', -12.4, -10.8, 0, { y: 1.55 }),
  deco('k:kitchenMicrowave', -16.0, -10.45, 0, { y: 0.95 }),
  deco('k:kitchenCoffeeMachine', -13.3, -10.5, 0, { y: 0.95 }),
  fur('y:table_medium', -11.5, -5.0, 1.6, 1.6, 0.8),
  deco('k:rugDoormat', -16.0, -3.0, L),
  deco('y:rug_rectangle_A', -11.5, -5.0, 0, { scale: 1.25 }),
  // Living room.
  fur('k:cabinetTelevision', 0, -10.65, 1.68, 0.55, 0.65),
  deco('k:televisionModern', 0, -10.7, 0, { y: 0.65 }),
  fur('y:couch_pillows', 0, -6.8, 2.4, 1.28, 0.98, F),
  fur('y:table_low', 0, -8.6, 1.92, 1.2, 0.4),
  fur('y:armchair_pillows', -3.6, -8.6, 1.28, 1.44, 0.98, L),
  fur('y:armchair_pillows', 3.6, -8.6, 1.28, 1.44, 0.98, Rt),
  fur('k:bookcaseClosedWide', -4.6, -10.7, 1.68, 0.55, 1.66),
  deco('y:rug_oval_A', 0, -8.3, 0, { scale: 1.5 }),
  deco('y:shelf_B_large_decorated', 3.4, -10.9, 0, { y: 1.5 }),
  deco('y:pictureframe_large_B', -1.0, -10.9, 0, { y: 1.85 }),
  deco('y:pictureframe_medium', 5.2, -10.9, 0, { y: 1.9 }),
  // Bedroom.
  fur('y:bed_double_B', 11.5, -9.6, 2.48, 2.4, 0.8),
  fur('y:cabinet_small_decorated', 9.6, -10.45, 0.84, 0.88, 1.3),
  fur('y:cabinet_small_decorated', 13.4, -10.45, 0.84, 0.88, 1.3),
  fur('y:cabinet_medium_decorated', 7.3, -10.55, 1.63, 0.8, 1.46),
  fur('k:bookcaseClosedDoors', 16.5, -6.0, 0.64, 1.0, 2.15, Rt, { scale: 1.2 }),
  deco('y:rug_rectangle_stripes_A', 11.5, -6.6, 0, { scale: 1.2 }),
  deco('y:pictureframe_large_A', 11.5, -10.9, 0, { y: 2.0 }),
  // Bathroom.
  fur('k:bathtub', -16.35, 3.2, 1.18, 2.5, 0.88, L),
  fur('k:toilet', -13.4, 0.6, 0.65, 1.0, 0.95),
  fur('k:bathroomSink', -11.4, 0.4, 0.72, 0.62, 1.18),
  deco('k:bathroomMirror', -11.4, 0.08, 0, { y: 1.35 }),
  fur('k:washerDryerStacked', -16.5, 8.6, 0.82, 0.82, 1.97, L),
  deco('k:rugRounded', -13.0, 5.0, 0, { scale: 0.9 }),
  // Dining room.
  fur('y:table_medium_long', -3.0, 4.5, 2.4, 1.6, 0.8),
  fur('k:bookcaseClosedDoors', -8.6, 2.2, 0.53, 0.84, 1.79, L),
  deco('k:rugRectangle', -3.0, 4.5, 0, { scale: 1.35 }),
  deco('y:pictureframe_large_A', -5.5, 0.12, 0, { y: 1.75 }),
  deco('y:pictureframe_small_B', 1.2, 0.12, 0, { y: 1.85 }),
  deco('y:shelf_B_small_decorated', -1.5, 0.12, 0, { y: 1.45 }),
  // Kids' room.
  fur('y:bed_single_A', 8.9, 1.35, 1.28, 2.4, 0.8),
  fur('k:bookcaseOpen', 3.6, 0.45, 0.84, 0.53, 1.85),
  fur('y:table_small', 6.3, 8.6, 0.8, 0.8, 0.8),
  deco('k:rugRound', 6.5, 5.5),
  deco('y:pictureframe_small_A', 6.5, 0.12, 0, { y: 1.8 }),
  // Study.
  fur('k:desk', 12.3, 0.5, 1.53, 0.82, 0.8),
  deco('k:computerScreen', 12.3, 0.4, 0, { y: 0.8 }),
  deco('k:computerKeyboard', 12.3, 0.75, 0, { y: 0.8 }),
  fur('k:chairDesk', 12.3, 1.55, 0.69, 0.65, 1.28, F),
  fur('k:bookcaseClosedWide', 16.68, 5.0, 0.55, 1.68, 1.66, Rt),
  fur('y:armchair_pillows', 11.0, 8.8, 1.28, 1.44, 0.98, L),
  deco('y:rug_oval_B', 13.5, 6.0),
  deco('y:pictureframe_medium', 14.5, 0.12, 0, { y: 1.9 }),
]

export const SOLID_FURNITURE = FURNITURE.filter((f) => f.solid)

/** Where the cat sleeps. */
export const CAT_BED: Vec = { x: 4.9, z: -1.6 }
export const CAT_SPOTS: readonly Vec[] = [
  { x: -2.5, z: -3.0 },
  { x: 2.5, z: -2.5 },
  { x: -9.0, z: -2.0 },
  { x: -13.5, z: -6.5 },
  { x: 9.0, z: -4.5 },
  { x: 14.0, z: -3.0 },
  { x: -6.0, z: 8.5 },
  { x: 6.5, z: 5.5 },
  { x: 13.0, z: 5.5 },
  { x: -12.5, z: 6.0 },
]
