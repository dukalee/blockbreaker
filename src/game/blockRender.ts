import type { Block } from './blocks'
import { BLOCK_DRAW_INSET } from './constants'

/** 스프라이트 둘레 여백(px). 픽셀 스타일은 글로우가 없어 0이다. */
const GLOW_PAD = 0
/** 위/아래 음영 띠의 두께(px) */
const BAND = 4

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

/** 각진 픽셀 블록: 단색 면 + 윗면 하이라이트 띠 + 아랫면 그림자 띠. */
function drawBlock(ctx: CanvasRenderingContext2D, block: Block, w: number, h: number): void {
  const x = GLOW_PAD
  const y = GLOW_PAD

  if (block.type === 'metal') {
    ctx.fillStyle = '#9aa3b8'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#dfe5f2'
    ctx.fillRect(x, y, w, BAND)
    ctx.fillStyle = '#4f566b'
    ctx.fillRect(x, y + h - BAND, w, BAND)
    ctx.fillRect(x + w - BAND, y, BAND, h)
    // 양 끝의 나사 자국
    ctx.fillStyle = '#4f566b'
    ctx.fillRect(x + 8, y + h / 2 - 2, 4, 4)
    ctx.fillRect(x + w - 16, y + h / 2 - 2, 4, 4)
    return
  }

  const damaged = block.type === 'reinforced' && block.hp === 1
  const face = damaged ? shade(block.color, 0.6) : block.color
  ctx.fillStyle = face
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.fillRect(x, y, w, BAND)
  ctx.fillStyle = shade(block.color, damaged ? 0.35 : 0.5)
  ctx.fillRect(x, y + h - BAND, w, BAND)

  if (block.type === 'reinforced') {
    // 강화 블록은 흰 테두리로 구분한다.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x, y, w, 4)
    ctx.fillRect(x, y + h - 4, w, 4)
    ctx.fillRect(x, y, 4, h)
    ctx.fillRect(x + w - 4, y, 4, h)
  }

  if (damaged) {
    // 1타 후 금이 간 모양 (계단식 픽셀 금)
    ctx.fillStyle = '#0d0f1e'
    ctx.fillRect(x + 28, y + 4, 4, 8)
    ctx.fillRect(x + 32, y + 12, 4, 8)
    ctx.fillRect(x + 28, y + 20, 4, 4)
    ctx.fillRect(x + 36, y + 12, 12, 4)
    ctx.fillRect(x + 48, y + 8, 4, 4)
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

/** 각진 픽셀 블록을 그린다. */
export function renderBlocks(ctx: CanvasRenderingContext2D, blocks: Block[]): void {
  for (const b of blocks) {
    if (b.hp <= 0) continue
    const w = b.width - BLOCK_DRAW_INSET * 2
    const h = b.height - BLOCK_DRAW_INSET * 2
    ctx.drawImage(spriteFor(b, w, h), b.x + BLOCK_DRAW_INSET - GLOW_PAD, b.y + BLOCK_DRAW_INSET - GLOW_PAD)
  }
}
