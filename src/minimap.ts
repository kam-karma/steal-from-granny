import { WALL_PIECES } from './sim/geom'
import { EXIT, HOUSE, ROOMS } from './sim/layout'
import { ownerRange } from './sim/owner'
import type { GameState } from './sim/types'

const ROOM_COLORS = ['#5fb8b0', '#c98a4e', '#c98fb0', '#9ed8ea', '#a8754a', '#7fa7d9', '#b9874f']

export interface Minimap {
  readonly update: (s: GameState, time: number) => void
}

/** A small map of the whole house: rooms, walls, guards and their gaze, the cat, targets and the window. */
export function createMinimap(parent: HTMLElement): Minimap {
  const canvas = document.createElement('canvas')
  canvas.className = 'minimap'
  const W = 204
  const H = Math.round((W * (HOUSE.maxZ - HOUSE.minZ)) / (HOUSE.maxX - HOUSE.minX))
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  parent.appendChild(canvas)
  const g = canvas.getContext('2d') as CanvasRenderingContext2D
  const sx = (x: number): number => ((x - HOUSE.minX) / (HOUSE.maxX - HOUSE.minX)) * W
  const sz = (z: number): number => ((z - HOUSE.minZ) / (HOUSE.maxZ - HOUSE.minZ)) * H
  const k = W / (HOUSE.maxX - HOUSE.minX)

  function update(s: GameState, time: number): void {
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, W, H)
    ROOMS.forEach((r, i) => {
      g.fillStyle = ROOM_COLORS[i]
      g.globalAlpha = 0.55
      g.fillRect(sx(r.x0), sz(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k)
    })
    g.globalAlpha = 1
    g.strokeStyle = '#f3ead8'
    g.lineWidth = 2
    g.beginPath()
    for (const p of WALL_PIECES) {
      if (p.wall.axis === 'x') {
        g.moveTo(sx(p.from), sz(p.wall.at))
        g.lineTo(sx(p.to), sz(p.wall.at))
      } else {
        g.moveTo(sx(p.wall.at), sz(p.from))
        g.lineTo(sx(p.wall.at), sz(p.to))
      }
    }
    g.stroke()

    // Guards' gaze.
    for (const o of s.owners) {
      const r = ownerRange(o, s.rules) * k
      g.fillStyle = o.mode === 'alarm' ? '#ff3b3066' : o.suspicion > 25 ? '#ff8a3a55' : '#ffe06655'
      g.beginPath()
      g.moveTo(sx(o.pos.x), sz(o.pos.z))
      g.arc(sx(o.pos.x), sz(o.pos.z), r, o.face - s.rules.halfFov, o.face + s.rules.halfFov)
      g.closePath()
      g.fill()
    }
    // Targets still in the house.
    for (const id of [...s.targets, ...s.bonus]) {
      const p = s.props[id]
      if (!p.present) continue
      const main = s.targets.includes(id)
      g.fillStyle = main ? '#7dffa0' : '#ffd23a'
      g.beginPath()
      g.arc(sx(p.pos.x), sz(p.pos.z), main ? 4 : 3, 0, Math.PI * 2)
      g.fill()
    }
    // The window out.
    g.fillStyle = '#81d4fa'
    g.fillRect(sx(EXIT.x) - 3, sz(EXIT.z) - 6, 6, 12)
    if (s.cat !== null) {
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.arc(sx(s.cat.pos.x), sz(s.cat.pos.z), 2.5, 0, Math.PI * 2)
      g.fill()
    }
    for (const o of s.owners) {
      g.fillStyle = o.kind === 'dede' ? '#8d6e63' : '#7e57c2'
      g.strokeStyle = '#fff'
      g.lineWidth = 1.5
      g.beginPath()
      g.arc(sx(o.pos.x), sz(o.pos.z), 4.5, 0, Math.PI * 2)
      g.fill()
      g.stroke()
    }
    const pulse = 4.5 + Math.sin(time * 6) * 1.2
    g.fillStyle = '#2fe08f'
    g.strokeStyle = '#0b3d2f'
    g.lineWidth = 2
    g.beginPath()
    g.arc(sx(s.player.pos.x), sz(s.player.pos.z), pulse, 0, Math.PI * 2)
    g.fill()
    g.stroke()
  }

  return { update }
}
