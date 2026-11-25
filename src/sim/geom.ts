import { DOOR_W, DOORS, HOUSE, roomAt, ROOMS, SOLID_FURNITURE, WALLS, WINDOW, type Wall } from './layout'
import { buildGrid, findPath, type NavGrid } from './nav'
import type { Box, Vec } from './types'

export const v = (x: number, z: number): Vec => ({ x, z })
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, z: a.z + b.z })
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, z: a.z - b.z })
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, z: a.z * k })
export const len = (a: Vec): number => Math.hypot(a.x, a.z)
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.z - b.z)
export const dirOf = (angle: number): Vec => ({ x: Math.cos(angle), z: Math.sin(angle) })
export const angleOf = (a: Vec): number => Math.atan2(a.z, a.x)

export function angDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export function turnToward(face: number, target: number, maxStep: number): number {
  const d = angDiff(target, face)
  if (Math.abs(d) <= maxStep) return target
  return face + Math.sign(d) * maxStep
}

interface Seg {
  readonly a: Vec
  readonly b: Vec
}

const T = 0.12 // half wall thickness

/** The solid pieces of a wall between its gaps (doors, and the window the jelly uses). */
function wallPieces(w: Wall): Array<[number, number]> {
  const gaps = [...w.doors.map((c) => [c - DOOR_W / 2, c + DOOR_W / 2])]
  if (w.axis === 'z' && w.at === WINDOW.x) gaps.push([WINDOW.z - WINDOW.w / 2, WINDOW.z + WINDOW.w / 2])
  gaps.sort((a, b) => a[0] - b[0])
  const pieces: Array<[number, number]> = []
  let cur = w.from
  for (const [g0, g1] of gaps) {
    if (g0 > cur) pieces.push([cur, g0])
    cur = Math.max(cur, g1)
  }
  if (cur < w.to) pieces.push([cur, w.to])
  return pieces
}

export interface WallPiece {
  readonly wall: Wall
  readonly from: number
  readonly to: number
}

export const WALL_PIECES: readonly WallPiece[] = WALLS.flatMap((w) => wallPieces(w).map(([from, to]) => ({ wall: w, from, to })))

const pieceSeg = (p: WallPiece): Seg =>
  p.wall.axis === 'x' ? { a: v(p.from, p.wall.at), b: v(p.to, p.wall.at) } : { a: v(p.wall.at, p.from), b: v(p.wall.at, p.to) }

function boxSegs(b: Box): Seg[] {
  const x0 = b.x - b.w / 2
  const x1 = b.x + b.w / 2
  const z0 = b.z - b.d / 2
  const z1 = b.z + b.d / 2
  return [
    { a: v(x0, z0), b: v(x1, z0) },
    { a: v(x1, z0), b: v(x1, z1) },
    { a: v(x1, z1), b: v(x0, z1) },
    { a: v(x0, z1), b: v(x0, z0) },
  ]
}

/** Inner walls and tall furniture (wardrobes, fridges) block sight. */
const SIGHT_SEGS: readonly Seg[] = [
  ...WALL_PIECES.filter((p) => !p.wall.outer).map(pieceSeg),
  ...SOLID_FURNITURE.filter((f) => f.tall).flatMap((f) => boxSegs(f.box)),
]
const RAY_SEGS: readonly Seg[] = [...SIGHT_SEGS, ...WALL_PIECES.filter((p) => p.wall.outer).map(pieceSeg)]

/** Wall pieces as boxes for collision. */
export const WALL_BOXES: readonly Box[] = WALL_PIECES.map((p) =>
  p.wall.axis === 'x'
    ? { x: (p.from + p.to) / 2, z: p.wall.at, w: p.to - p.from, d: T * 2, h: HOUSE.wallH }
    : { x: p.wall.at, z: (p.from + p.to) / 2, w: T * 2, d: p.to - p.from, h: HOUSE.wallH },
)

const SOLID_BOXES: readonly Box[] = [...WALL_BOXES, ...SOLID_FURNITURE.map((f) => f.box)]

const cross = (a: Vec, b: Vec): number => a.x * b.z - a.z * b.x

/** Distance along a ray (unit dir) to a segment, or Infinity. */
function rayHit(o: Vec, d: Vec, s: Seg): number {
  const e = sub(s.b, s.a)
  const den = cross(d, e)
  if (Math.abs(den) < 1e-9) return Infinity
  const w = sub(s.a, o)
  const t = cross(w, e) / den
  const u = cross(w, d) / den
  return t >= 0 && u >= 0 && u <= 1 ? t : Infinity
}

export function hasLOS(a: Vec, b: Vec): boolean {
  const d = sub(b, a)
  const l = len(d)
  if (l < 1e-6) return true
  const u = scale(d, 1 / l)
  return SIGHT_SEGS.every((s) => rayHit(a, u, s) >= l)
}

/** How far a sight ray travels before a wall or tall furniture stops it. */
export function rayLength(o: Vec, angle: number, max: number): number {
  const d = dirOf(angle)
  let best = max
  for (const s of RAY_SEGS) best = Math.min(best, rayHit(o, d, s))
  return best
}

export interface Eye {
  readonly pos: Vec
  readonly face: number
}

export function canSee(eye: Eye, target: Vec, range: number, halfFov: number): boolean {
  const d = sub(target, eye.pos)
  const l = len(d)
  if (l > range) return false
  if (l > 0.5 && Math.abs(angDiff(angleOf(d), eye.face)) > halfFov) return false
  return hasLOS(eye.pos, target)
}

function closestOnBox(p: Vec, b: Box): Vec {
  return {
    x: Math.max(b.x - b.w / 2, Math.min(p.x, b.x + b.w / 2)),
    z: Math.max(b.z - b.d / 2, Math.min(p.z, b.z + b.d / 2)),
  }
}

function pushOutOfBox(p: Vec, r: number, b: Box): Vec {
  const hx = b.w / 2
  const hz = b.d / 2
  const c = closestOnBox(p, b)
  const dx = p.x - c.x
  const dz = p.z - c.z
  const d2 = dx * dx + dz * dz
  if (d2 >= r * r) return p
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2)
    return { x: c.x + (dx / d) * r, z: c.z + (dz / d) * r }
  }
  const left = p.x - (b.x - hx)
  const right = b.x + hx - p.x
  const back = p.z - (b.z - hz)
  const front = b.z + hz - p.z
  const m = Math.min(left, right, back, front)
  if (m === left) return { x: b.x - hx - r, z: p.z }
  if (m === right) return { x: b.x + hx + r, z: p.z }
  if (m === back) return { x: p.x, z: b.z - hz - r }
  return { x: p.x, z: b.z + hz + r }
}

function pushOutOfCircle(p: Vec, r: number, c: Vec, cr: number): Vec {
  const d = dist(p, c)
  const min = r + cr
  if (d >= min) return p
  if (d < 1e-6) return { x: c.x + min, z: c.z }
  return add(c, scale(sub(p, c), min / d))
}

export interface Circle {
  readonly pos: Vec
  readonly r: number
}

/** Keep a walker inside the house, out of walls, furniture and the given circles. */
export function collide(p: Vec, r: number, circles: readonly Circle[] = []): Vec {
  let q = p
  for (let pass = 0; pass < 2; pass++) {
    for (const b of SOLID_BOXES) q = pushOutOfBox(q, r, b)
    for (const c of circles) q = pushOutOfCircle(q, r, c.pos, c.r)
    q = {
      x: Math.max(HOUSE.minX + r, Math.min(HOUSE.maxX - r, q.x)),
      z: Math.max(HOUSE.minZ + r, Math.min(HOUSE.maxZ - r, q.z)),
    }
  }
  return q
}

/** Rooms to pass through, by breadth-first search over the doors. */
function roomPath(a: number, b: number): number[] {
  const prev = new Map<number, number>([[a, -1]])
  const queue = [a]
  while (queue.length > 0) {
    const r = queue.shift() as number
    if (r === b) break
    for (const d of DOORS) {
      const next = d.a === r ? d.b : d.b === r ? d.a : -1
      if (next >= 0 && !prev.has(next)) {
        prev.set(next, r)
        queue.push(next)
      }
    }
  }
  if (!prev.has(b)) return [a]
  const path: number[] = []
  for (let r = b; r !== -1; r = prev.get(r) as number) path.unshift(r)
  return path
}

let grid: NavGrid | null = null
export const navGrid = (): NavGrid => (grid ??= buildGrid(HOUSE, SOLID_BOXES, 0.42))

/** Waypoints from a to b round walls, furniture and the given things on the floor. */
export function routeTo(a: Vec, b: Vec, circles: readonly Circle[] = []): readonly Vec[] {
  const nearby = circles.filter((c) => dist(c.pos, b) > c.r + 0.5 && dist(c.pos, a) > c.r + 0.5)
  return findPath(navGrid(), a, b, nearby, 0.42) ?? doorRoute(a, b)
}

/** Fallback: waypoints from a to b through the doors. */
function doorRoute(a: Vec, b: Vec): readonly Vec[] {
  const rooms = roomPath(roomAt(a), roomAt(b))
  const pts: Vec[] = []
  for (let k = 0; k + 1 < rooms.length; k++) {
    const from = rooms[k]
    const to = rooms[k + 1]
    const door = DOORS.find((d) => (d.a === from && d.b === to) || (d.a === to && d.b === from))
    if (door === undefined) continue
    const s = door.a === from ? 1 : -1
    pts.push(sub(door.pos, scale(door.normal, 0.9 * s)), add(door.pos, scale(door.normal, 0.9 * s)))
  }
  pts.push(b)
  return pts
}

export interface Walk {
  readonly pos: Vec
  readonly route: readonly Vec[]
  readonly heading: number | null
}

/** Walk along a route at a speed; drops reached waypoints and steps round furniture in the way. */
export function walkRoute(pos: Vec, route: readonly Vec[], speed: number, dt: number, r: number, circles: readonly Circle[] = []): Walk {
  let rest = route
  while (rest.length > 1 && dist(pos, rest[0]) < 0.3) rest = rest.slice(1)
  if (rest.length === 0) return { pos, route: rest, heading: null }
  const goal = rest[0]
  const d = sub(goal, pos)
  const l = len(d)
  if (l < 0.05) return { pos, route: rest.length === 1 ? [] : rest.slice(1), heading: null }
  const stepLen = Math.min(l, speed * dt)
  const next = collide(add(pos, scale(d, stepLen / l)), r, circles)
  const progress = dist(pos, goal) - dist(next, goal)
  if (progress < stepLen * 0.3 && l > 0.6 && rest.length < 12) {
    const detour = detourPoint(pos, r, circles, goal)
    if (detour !== null && dist(detour, pos) > 0.15) return { pos, route: [detour, ...rest], heading: angleOf(d) }
  }
  return { pos: next, route: rest, heading: angleOf(d) }
}

/** A free corner of the blocking box (or a side of the blocking circle), reachable in a straight line. */
function detourPoint(pos: Vec, r: number, circles: readonly Circle[], goal: Vec): Vec | null {
  const m = r + 0.25
  const box = SOLID_BOXES.find((b) => dist(pos, closestOnBox(pos, b)) < r + 0.06)
  const candidates: Vec[] = []
  if (box !== undefined) {
    const crosses = (q: Vec): boolean => {
      for (let k = 1; k < 12; k++) {
        const t = k / 12
        const x = pos.x + (q.x - pos.x) * t
        const z = pos.z + (q.z - pos.z) * t
        if (Math.abs(x - box.x) < box.w / 2 + r * 0.9 && Math.abs(z - box.z) < box.d / 2 + r * 0.9) return true
      }
      return false
    }
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const q = v(box.x + sx * (box.w / 2 + m), box.z + sz * (box.d / 2 + m))
        if (!crosses(q)) candidates.push(q)
      }
  } else {
    const c = circles.find((q) => dist(q.pos, pos) < q.r + r + 0.06)
    if (c === undefined) return null
    const away = sub(pos, c.pos)
    const side = { x: -away.z, z: away.x }
    const k = (c.r + m) / Math.max(1e-6, len(side))
    candidates.push(add(c.pos, scale(side, k)), add(c.pos, scale(side, -k)))
  }
  const free = candidates.map((q) => collide(q, r, circles)).filter((q) => dist(q, pos) > 0.15)
  if (free.length === 0) return null
  return free.reduce((best, q) => (dist(pos, q) + dist(q, goal) < dist(pos, best) + dist(best, goal) ? q : best))
}

export const roomCentre = (i: number): Vec => ({ x: (ROOMS[i].x0 + ROOMS[i].x1) / 2, z: (ROOMS[i].z0 + ROOMS[i].z1) / 2 })
