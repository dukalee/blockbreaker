import type { Block } from './blocks'
import { BLOCK_DRAW_INSET } from './constants'

/** 스프라이트 둘레에 글로우가 번질 여백(px) */
const GLOW_PAD = 16
const RADIUS = 4

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** 색을 factor배로 밝게(>1) 또는 어둡게(<1) 한다. 밝게 할 때는 흰색 쪽으로 섞는다. */
export function shade(hex: string, factor: number): string {
  const [r, g, b] = parseHex(hex)
  const ch = (v: number) =>
    Math.round(factor <= 1 ? v * factor : v + (255 - v) * Math.min(1, factor - 1))
  return `rgb(${ch(r)}, ${ch(g)}, ${ch(b)})`
}

interface Look {
  top: string
  mid: string
  bottom: string
  outline: string
  glow: string
}

function lookOf(block: Block): Look {
  if (block.type === 'metal') {
    return { top: '#e6edf7', mid: '#8b95a5', bottom: '#454c58', outline: '#eaf6ff', glow: '#9fd8ff' }
  }
  const damaged = block.type === 'reinforced' && block.hp === 1
  const base = damaged ? shade(block.color, 0.6) : block.color
  return {
    top: shade(block.color, damaged ? 1.1 : 1.35),
    mid: base,
    bottom: shade(block.color, damaged ? 0.35 : 0.55),
    outline: block.type === 'reinforced' ? '#ffffff' : shade(block.color, 1.6),
    glow: block.color,
  }
}

function drawBlock(ctx: CanvasRenderingContext2D, block: Block, w: number, h: number): void {
  const look = lookOf(block)
  const x = GLOW_PAD
  const y = GLOW_PAD

  // 네온 글로우 + 위는 밝고 아래는 어두운 그라데이션 몸체
  ctx.save()
  ctx.shadowColor = look.glow
  ctx.shadowBlur = block.type === 'reinforced' ? 14 : 11
  const body = ctx.createLinearGradient(0, y, 0, y + h)
  body.addColorStop(0, look.top)
  body.addColorStop(0.5, look.mid)
  body.addColorStop(1, look.bottom)
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, RADIUS)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, RADIUS)
  ctx.clip()
  // 윗면 하이라이트와 아랫면 그림자로 입체감을 준다.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'
  ctx.fillRect(x, y, w, h * 0.38)
  ctx.fillStyle = 'rgba(0, 0, 20, 0.3)'
  ctx.fillRect(x, y + h * 0.78, w, h * 0.22)

  if (block.type === 'metal') {
    // 금속판 느낌의 사선 결
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
    ctx.lineWidth = 1.5
    for (let i = -h; i < w; i += 14) {
      ctx.beginPath()
      ctx.moveTo(x + i, y + h)
      ctx.lineTo(x + i + h, y)
      ctx.stroke()
    }
  }
  ctx.restore()

  ctx.strokeStyle = look.outline
  ctx.lineWidth = block.type === 'reinforced' ? 2.5 : 1.5
  ctx.beginPath()
  ctx.roundRect(x + 1, y + 1, w - 2, h - 2, RADIUS)
  ctx.stroke()

  if (block.type === 'reinforced' && block.hp === 1) {
    // 1타 후 금이 간 모양
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x + w * 0.3, y)
    ctx.lineTo(x + w * 0.45, y + h * 0.5)
    ctx.lineTo(x + w * 0.35, y + h)
    ctx.moveTo(x + w * 0.45, y + h * 0.5)
    ctx.lineTo(x + w * 0.7, y + h * 0.3)
    ctx.stroke()
  }
}

// 블록 모양(종류·색·남은 체력)별로 한 번만 그려 두고 매 프레임 복사한다. 글로우(shadowBlur)가 비싸서 필요하다.
const spriteCache = new Map<string, HTMLCanvasElement>()

function spriteFor(block: Block, w: number, h: number): HTMLCanvasElement {
  const key = `${block.type}|${block.color}|${block.hp}|${w}x${h}`
  let sprite = spriteCache.get(key)
  if (!sprite) {
    sprite = document.createElement('canvas')
    sprite.width = w + GLOW_PAD * 2
    sprite.height = h + GLOW_PAD * 2
    const sctx = sprite.getContext('2d')
    if (sctx) drawBlock(sctx, block, w, h)
    spriteCache.set(key, sprite)
  }
  return sprite
}

/** 네온 빛이 나는 입체적인 블록을 그린다. */
export function renderBlocks(ctx: CanvasRenderingContext2D, blocks: Block[]): void {
  for (const b of blocks) {
    if (b.hp <= 0) continue
    const w = b.width - BLOCK_DRAW_INSET * 2
    const h = b.height - BLOCK_DRAW_INSET * 2
    ctx.drawImage(spriteFor(b, w, h), b.x + BLOCK_DRAW_INSET - GLOW_PAD, b.y + BLOCK_DRAW_INSET - GLOW_PAD)
  }
}
