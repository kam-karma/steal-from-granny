import * as THREE from 'three'

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d') as CanvasRenderingContext2D
  draw(g, size)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  return t
}

/** Warm wooden planks with soft grain and staggered joints. */
export function woodFloor(): THREE.CanvasTexture {
  return canvasTex(512, (g, s) => {
    const rows = 8
    for (let r = 0; r < rows; r++) {
      const y = (r * s) / rows
      const light = 44 + ((r * 13) % 7)
      const grad = g.createLinearGradient(0, y, 0, y + s / rows)
      grad.addColorStop(0, `hsl(27, 52%, ${light + 3}%)`)
      grad.addColorStop(1, `hsl(25, 55%, ${light - 3}%)`)
      g.fillStyle = grad
      g.fillRect(0, y, s, s / rows)
      g.fillStyle = 'hsla(20, 50%, 18%, 0.55)'
      g.fillRect(0, y, s, 2)
      const cut = ((r * 211) % (s - 80)) + 40
      g.fillRect(cut, y, 2, s / rows)
    }
  })
}

/** Herringbone-ish parquet for the dining room. */
export function parquet(): THREE.CanvasTexture {
  return canvasTex(512, (g, s) => {
    const n = 8
    const w = s / n
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const light = 42 + ((i * 3 + j * 5) % 9)
        g.fillStyle = `hsl(25, 50%, ${light}%)`
        g.fillRect(i * w, j * w, w, w)
        g.strokeStyle = '#0003'
        g.strokeRect(i * w, j * w, w, w)
        g.strokeStyle = '#0002'
        for (let k = 1; k < 4; k++) {
          g.beginPath()
          if ((i + j) % 2 === 0) {
            g.moveTo(i * w, j * w + (k * w) / 4)
            g.lineTo(i * w + w, j * w + (k * w) / 4)
          } else {
            g.moveTo(i * w + (k * w) / 4, j * w)
            g.lineTo(i * w + (k * w) / 4, j * w + w)
          }
          g.stroke()
        }
      }
  })
}

export function kitchenTiles(): THREE.CanvasTexture {
  return canvasTex(256, (g, s) => {
    const n = 4
    const w = s / n
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        g.fillStyle = (i + j) % 2 === 0 ? '#f6ecd4' : '#5fb8b0'
        g.fillRect(i * w, j * w, w, w)
      }
    g.strokeStyle = '#0003'
    g.lineWidth = 3
    for (let k = 0; k <= n; k++) {
      g.beginPath()
      g.moveTo(k * w, 0)
      g.lineTo(k * w, s)
      g.moveTo(0, k * w)
      g.lineTo(s, k * w)
      g.stroke()
    }
  })
}

export function bathTiles(): THREE.CanvasTexture {
  return canvasTex(256, (g, s) => {
    const n = 8
    const w = s / n
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        g.fillStyle = (i * 7 + j * 3) % 11 === 0 ? '#9ed8ea' : '#eaf6fb'
        g.fillRect(i * w, j * w, w, w)
      }
    g.strokeStyle = '#8fb3c2'
    g.lineWidth = 2
    for (let k = 0; k <= n; k++) {
      g.beginPath()
      g.moveTo(k * w, 0)
      g.lineTo(k * w, s)
      g.moveTo(0, k * w)
      g.lineTo(s, k * w)
      g.stroke()
    }
  })
}

export function carpet(color: string): THREE.CanvasTexture {
  return canvasTex(256, (g, s) => {
    g.fillStyle = color
    g.fillRect(0, 0, s, s)
    // Soft woolly blotches instead of pixel noise (no shimmer at a distance).
    for (let k = 0; k < 60; k++) {
      const x = Math.random() * s
      const y = Math.random() * s
      const r = 10 + Math.random() * 24
      const grad = g.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, Math.random() < 0.5 ? '#ffffff10' : '#0000000c')
      grad.addColorStop(1, '#00000000')
      g.fillStyle = grad
      g.fillRect(x - r, y - r, r * 2, r * 2)
    }
  })
}

export function wallpaper(base: string, accent: string, kind: 'stripes' | 'dots' | 'diamonds' | 'stars'): THREE.CanvasTexture {
  const t = canvasTex(256, (g, s) => {
    g.fillStyle = base
    g.fillRect(0, 0, s, s)
    g.fillStyle = accent
    if (kind === 'stripes') {
      for (let k = 0; k < 8; k++) g.fillRect(k * 32 + 10, 0, 12, s)
    } else if (kind === 'dots') {
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++) {
          g.beginPath()
          g.arc(i * 32 + 16 + (j % 2) * 16, j * 32 + 16, 5, 0, Math.PI * 2)
          g.fill()
        }
    } else if (kind === 'stars') {
      for (let i = 0; i < 5; i++)
        for (let j = 0; j < 5; j++) {
          const cx = i * 52 + 26 + (j % 2) * 26
          const cy = j * 52 + 26
          g.beginPath()
          for (let k = 0; k < 10; k++) {
            const r = k % 2 === 0 ? 11 : 5
            const a = (k / 10) * Math.PI * 2 - Math.PI / 2
            g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
          }
          g.fill()
        }
    } else {
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          const cx = i * 64 + 32
          const cy = j * 64 + 32
          g.beginPath()
          g.moveTo(cx, cy - 18)
          g.lineTo(cx + 12, cy)
          g.lineTo(cx, cy + 18)
          g.lineTo(cx - 12, cy)
          g.fill()
        }
    }
  })
  t.repeat.set(3, 1)
  return t
}

export function nightSky(): THREE.CanvasTexture {
  return canvasTex(256, (g, s) => {
    const grad = g.createLinearGradient(0, 0, 0, s)
    grad.addColorStop(0, '#0b1240')
    grad.addColorStop(1, '#3a4a9a')
    g.fillStyle = grad
    g.fillRect(0, 0, s, s)
    for (let k = 0; k < 80; k++) {
      g.fillStyle = '#fff'
      g.globalAlpha = 0.4 + Math.random() * 0.6
      g.fillRect(Math.random() * s, Math.random() * s * 0.7, 2, 2)
    }
    g.globalAlpha = 1
    g.fillStyle = '#fff6c8'
    g.beginPath()
    g.arc(s * 0.72, s * 0.28, 22, 0, Math.PI * 2)
    g.fill()
  })
}

export function grass(): THREE.CanvasTexture {
  const t = canvasTex(256, (g, s) => {
    g.fillStyle = '#24432f'
    g.fillRect(0, 0, s, s)
    for (let k = 0; k < 2500; k++) {
      g.fillStyle = Math.random() < 0.5 ? '#2f5a3c' : '#1b3324'
      g.fillRect(Math.random() * s, Math.random() * s, 2, 5)
    }
  })
  t.repeat.set(30, 30)
  return t
}
