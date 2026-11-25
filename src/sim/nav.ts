import type { Box, Vec } from './types'

/**
 * Grid path finding for walkers in the house: A* over 0.5 m cells, then string-pulling so
 * the path is a few straight legs. Walls and furniture are fixed; things on the floor are added per call.
 */
export interface NavGrid {
  readonly minX: number
  readonly minZ: number
  readonly cell: number
  readonly cols: number
  readonly rows: number
  readonly blocked: Uint8Array
}

export interface NavCircle {
  readonly pos: Vec
  readonly r: number
}

function closest(p: Vec, b: Box): Vec {
  return {
    x: Math.max(b.x - b.w / 2, Math.min(p.x, b.x + b.w / 2)),
    z: Math.max(b.z - b.d / 2, Math.min(p.z, b.z + b.d / 2)),
  }
}

export function buildGrid(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, boxes: readonly Box[], r: number, cell = 0.5): NavGrid {
  const cols = Math.round((bounds.maxX - bounds.minX) / cell)
  const rows = Math.round((bounds.maxZ - bounds.minZ) / cell)
  const blocked = new Uint8Array(cols * rows)
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const p = { x: bounds.minX + (i + 0.5) * cell, z: bounds.minZ + (j + 0.5) * cell }
      const edge = p.x < bounds.minX + r || p.x > bounds.maxX - r || p.z < bounds.minZ + r || p.z > bounds.maxZ - r
      const hit = boxes.some((b) => {
        const c = closest(p, b)
        return Math.hypot(p.x - c.x, p.z - c.z) < r
      })
      if (edge || hit) blocked[j * cols + i] = 1
    }
  return { minX: bounds.minX, minZ: bounds.minZ, cell, cols, rows, blocked }
}

const cellOf = (g: NavGrid, p: Vec): [number, number] => [
  Math.max(0, Math.min(g.cols - 1, Math.floor((p.x - g.minX) / g.cell))),
  Math.max(0, Math.min(g.rows - 1, Math.floor((p.z - g.minZ) / g.cell))),
]
const centre = (g: NavGrid, i: number, j: number): Vec => ({ x: g.minX + (i + 0.5) * g.cell, z: g.minZ + (j + 0.5) * g.cell })

function withCircles(g: NavGrid, circles: readonly NavCircle[], r: number): Uint8Array {
  const b = g.blocked.slice()
  for (const c of circles) {
    const reach = c.r + r * 0.8
    const [i0, j0] = cellOf(g, { x: c.pos.x - reach, z: c.pos.z - reach })
    const [i1, j1] = cellOf(g, { x: c.pos.x + reach, z: c.pos.z + reach })
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const p = centre(g, i, j)
        if (Math.hypot(p.x - c.pos.x, p.z - c.pos.z) < reach) b[j * g.cols + i] = 1
      }
  }
  return b
}

/** Nearest free cell to a (possibly blocked) cell, by growing rings. */
function nearestFree(g: NavGrid, b: Uint8Array, i: number, j: number): [number, number] | null {
  if (!b[j * g.cols + i]) return [i, j]
  for (let k = 1; k < 8; k++)
    for (let dj = -k; dj <= k; dj++)
      for (let di = -k; di <= k; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== k) continue
        const x = i + di
        const y = j + dj
        if (x >= 0 && y >= 0 && x < g.cols && y < g.rows && !b[y * g.cols + x]) return [x, y]
      }
  return null
}

function lineFree(g: NavGrid, b: Uint8Array, a: Vec, c: Vec): boolean {
  const steps = Math.ceil(Math.hypot(c.x - a.x, c.z - a.z) / (g.cell * 0.4))
  for (let k = 1; k < steps; k++) {
    const t = k / steps
    const [i, j] = cellOf(g, { x: a.x + (c.x - a.x) * t, z: a.z + (c.z - a.z) * t })
    if (b[j * g.cols + i]) return false
  }
  return true
}

/** Waypoints from a to b avoiding walls, furniture and the given circles; null if there is no way. */
export function findPath(g: NavGrid, a: Vec, goal: Vec, circles: readonly NavCircle[], r: number): Vec[] | null {
  const b = withCircles(g, circles, r)
  const s = nearestFree(g, b, ...cellOf(g, a))
  const e = nearestFree(g, b, ...cellOf(g, goal))
  if (s === null || e === null) return null
  const n = g.cols * g.rows
  const start = s[1] * g.cols + s[0]
  const end = e[1] * g.cols + e[0]
  const gScore = new Float32Array(n).fill(Infinity)
  const came = new Int32Array(n).fill(-1)
  const closed = new Uint8Array(n)
  const heap: Array<[number, number]> = []
  const push = (f: number, k: number): void => {
    heap.push([f, k])
    let c = heap.length - 1
    while (c > 0) {
      const p = (c - 1) >> 1
      if (heap[p][0] <= heap[c][0]) break
      ;[heap[p], heap[c]] = [heap[c], heap[p]]
      c = p
    }
  }
  const pop = (): number => {
    const top = heap[0][1]
    const last = heap.pop() as [number, number]
    if (heap.length > 0) {
      heap[0] = last
      let c = 0
      for (;;) {
        const l = c * 2 + 1
        const r2 = l + 1
        let m = c
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r2 < heap.length && heap[r2][0] < heap[m][0]) m = r2
        if (m === c) break
        ;[heap[m], heap[c]] = [heap[c], heap[m]]
        c = m
      }
    }
    return top
  }
  const h = (k: number): number => Math.hypot((k % g.cols) - e[0], Math.floor(k / g.cols) - e[1])
  gScore[start] = 0
  push(h(start), start)
  const DIRS: Array<[number, number, number]> = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
  ]
  let found = false
  while (heap.length > 0) {
    const k = pop()
    if (k === end) {
      found = true
      break
    }
    if (closed[k]) continue
    closed[k] = 1
    const i = k % g.cols
    const j = Math.floor(k / g.cols)
    for (const [di, dj, cost] of DIRS) {
      const x = i + di
      const y = j + dj
      if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) continue
      const nk = y * g.cols + x
      if (b[nk] || closed[nk]) continue
      // No cutting corners past a blocked cell.
      if (di !== 0 && dj !== 0 && (b[j * g.cols + x] || b[y * g.cols + i])) continue
      const ng = gScore[k] + cost
      if (ng < gScore[nk]) {
        gScore[nk] = ng
        came[nk] = k
        push(ng + h(nk), nk)
      }
    }
  }
  if (!found) return null
  const cells: Vec[] = []
  for (let k = end; k !== -1; k = came[k]) cells.unshift(centre(g, k % g.cols, Math.floor(k / g.cols)))
  // String-pull: keep only the corners we cannot see past.
  const out: Vec[] = []
  let anchor = a
  let k = 0
  while (k < cells.length) {
    let far = k
    for (let m = cells.length - 1; m > k; m--) {
      if (lineFree(g, b, anchor, cells[m])) {
        far = m
        break
      }
    }
    out.push(cells[far])
    anchor = cells[far]
    k = far + 1
  }
  out[out.length - 1] = lineFree(g, b, out.length > 1 ? out[out.length - 2] : a, goal) ? goal : out[out.length - 1]
  return out
}
