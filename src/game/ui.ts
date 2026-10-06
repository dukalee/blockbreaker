import { renderBackdrop, type Backdrop } from './backdrop'
import { INITIAL_LIFE, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './constants'
import { activeEffects, type Effects } from './effects'
import type { GameState } from './game'
import { drawItemBadge } from './itemIcons'
import { itemColor } from './items'

// 별 배경 관련 함수는 backdrop.ts로 옮겼고, 기존 import 경로를 위해 다시 내보낸다.
export { createStars, STAR_COUNT, updateStars, type Star } from './backdrop'

const FONT_FAMILY =
  '"Segoe UI", "Inter", system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
const MUTED = '#8fa2ff'
const ACCENT_A = '#4de3ff'
const ACCENT_B = '#6a7bff'

/** 시간(초)에 따라 0.15~1 사이로 부드럽게 깜빡이는 투명도. */
export function blinkAlpha(time: number, rate = 4): number {
  return 0.575 + 0.425 * Math.sin(time * rate)
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function hitTest(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}

// ---- 공통 그리기 도구 ----

interface TextOptions {
  size: number
  weight?: number
  color?: string | CanvasGradient
  align?: CanvasTextAlign
  /** 글자 간격(px) */
  spacing?: number
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: TextOptions): void {
  ctx.font = `${o.weight ?? 600} ${o.size}px ${FONT_FAMILY}`
  ctx.textAlign = o.align ?? 'left'
  ctx.letterSpacing = `${o.spacing ?? 0}px`
  ctx.fillStyle = o.color ?? '#ffffff'
  ctx.fillText(text, x, y)
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'left'
}

/** 반투명 유리 느낌의 둥근 패널. */
function glassPanel(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  radius: number,
  opts: { fill?: string; border?: string; shadow?: string } = {},
): void {
  ctx.save()
  if (opts.shadow) {
    ctx.shadowColor = opts.shadow
    ctx.shadowBlur = 24
  }
  ctx.fillStyle = opts.fill ?? 'rgba(14, 18, 48, 0.58)'
  ctx.beginPath()
  ctx.roundRect(r.x, r.y, r.width, r.height, radius)
  ctx.fill()
  ctx.restore()

  // 위쪽이 살짝 밝은 광택
  const sheen = ctx.createLinearGradient(0, r.y, 0, r.y + r.height)
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.10)')
  sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = sheen
  ctx.beginPath()
  ctx.roundRect(r.x, r.y, r.width, r.height, radius)
  ctx.fill()

  ctx.strokeStyle = opts.border ?? 'rgba(255, 255, 255, 0.16)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(r.x + 0.75, r.y + 0.75, r.width - 1.5, r.height - 1.5, radius)
  ctx.stroke()
}

/** 그라데이션 채움의 둥근 버튼 (주요 동작용). */
function accentButton(ctx: CanvasRenderingContext2D, r: Rect, radius: number): void {
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.width, r.y + r.height)
  g.addColorStop(0, ACCENT_A)
  g.addColorStop(1, ACCENT_B)
  ctx.save()
  ctx.shadowColor = 'rgba(77, 227, 255, 0.55)'
  ctx.shadowBlur = 20
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.roundRect(r.x, r.y, r.width, r.height, radius)
  ctx.fill()
  ctx.restore()
}

function gradientText(ctx: CanvasRenderingContext2D, y0: number, y1: number, a: string, b: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  g.addColorStop(0, a)
  g.addColorStop(1, b)
  return g
}

/** 글로우가 번지는 큰 제목 글자. */
function heroText(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  size: number,
  top: string,
  bottom: string,
  glow: string,
): void {
  ctx.save()
  ctx.shadowColor = glow
  ctx.shadowBlur = 32
  drawText(ctx, text, LOGICAL_WIDTH / 2, y, {
    size,
    weight: 800,
    spacing: 10,
    align: 'center',
    color: gradientText(ctx, y - size * 0.75, y, top, bottom),
  })
  ctx.restore()
}

/** "PRESS SPACE ..." 같은 안내 문구를 둥근 알약 모양으로 그린다. */
function promptPill(ctx: CanvasRenderingContext2D, label: string, cx: number, cy: number, width: number, alpha: number): void {
  const r: Rect = { x: cx - width / 2, y: cy - 24, width, height: 48 }
  ctx.save()
  ctx.globalAlpha = alpha
  glassPanel(ctx, r, 24, { fill: 'rgba(255, 255, 255, 0.07)', border: 'rgba(255, 255, 255, 0.45)' })
  drawText(ctx, label, cx, cy + 7, { size: 18, weight: 600, spacing: 4, align: 'center' })
  ctx.restore()
}

// ---- 화면 ----

export function renderTitle(ctx: CanvasRenderingContext2D, backdrop: Backdrop, time: number): void {
  renderBackdrop(ctx, backdrop, time)
  heroText(ctx, 'BLOCK', 250, 104, '#c6f6ff', ACCENT_A, ACCENT_A)
  heroText(ctx, 'BREAKER', 360, 104, '#ffd0ee', '#ff5dc8', '#ff5dc8')
  promptPill(ctx, 'PRESS SPACE TO START', LOGICAL_WIDTH / 2, 500, 440, blinkAlpha(time))
}

export function renderGameOver(
  ctx: CanvasRenderingContext2D,
  backdrop: Backdrop,
  score: number,
  time: number,
  canContinue: boolean,
): void {
  renderBackdrop(ctx, backdrop, time)
  const cx = LOGICAL_WIDTH / 2
  glassPanel(ctx, { x: cx - 260, y: 150, width: 520, height: 390 }, 28, {
    fill: 'rgba(14, 18, 48, 0.66)',
    shadow: 'rgba(255, 93, 115, 0.35)',
  })
  ctx.save()
  ctx.shadowColor = '#ff5d73'
  ctx.shadowBlur = 24
  drawText(ctx, 'GAME OVER', cx, 245, {
    size: 54,
    weight: 800,
    spacing: 6,
    align: 'center',
    color: gradientText(ctx, 200, 250, '#ffd0d6', '#ff5d73'),
  })
  ctx.restore()
  drawText(ctx, 'FINAL SCORE', cx, 325, { size: 14, weight: 600, spacing: 5, align: 'center', color: MUTED })
  drawText(ctx, score.toLocaleString('en-US'), cx, 400, { size: 68, weight: 800, align: 'center' })
  if (canContinue) {
    promptPill(ctx, 'PRESS SPACE TO RETURN TO TITLE', cx, 470, 440, blinkAlpha(time))
  }
}

// ---- 게임 HUD ----

const HUD_CARD: Rect = { x: 24, y: 20, width: 230, height: 66 }
const LIFE_PILL: Rect = { x: 272, y: 30, width: 150, height: 46 }

export function renderHud(ctx: CanvasRenderingContext2D, game: GameState): void {
  // 좌측 상단: Stage 번호와 그 아래 score
  glassPanel(ctx, HUD_CARD, 16)
  drawText(ctx, 'STAGE', 44, 44, { size: 12, spacing: 3, color: MUTED })
  drawText(ctx, String(game.stage), 124, 47, { size: 22, weight: 700 })
  drawText(ctx, 'SCORE', 44, 72, { size: 12, spacing: 3, color: MUTED })
  drawText(ctx, game.score.toLocaleString('en-US'), 124, 75, { size: 22, weight: 700 })

  // LIFE: 남은 개수만큼 빛나는 점
  glassPanel(ctx, LIFE_PILL, 23)
  drawText(ctx, 'LIFE', LIFE_PILL.x + 20, LIFE_PILL.y + 28, { size: 12, spacing: 3, color: MUTED })
  for (let i = 0; i < INITIAL_LIFE; i++) {
    const cx = LIFE_PILL.x + 82 + i * 24
    const cy = LIFE_PILL.y + LIFE_PILL.height / 2
    ctx.save()
    if (i < game.life) {
      ctx.shadowColor = '#ff5d73'
      ctx.shadowBlur = 12
      ctx.fillStyle = '#ff5d73'
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)'
    }
    ctx.beginPath()
    ctx.arc(cx, cy, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  renderActiveEffects(ctx, game.effects)
}

/** 적용 중인 효과를 둥근 칩(아이콘 + 남은 시간)으로 표시한다. 공 속도 효과는 시간 없이 아이콘만. */
function renderActiveEffects(ctx: CanvasRenderingContext2D, effects: Effects): void {
  let x = 442
  for (const effect of activeEffects(effects)) {
    const color = itemColor(effect.type)
    const timed = effect.remaining !== null
    const chip: Rect = { x, y: 35, width: timed ? 88 : 46, height: 36 }
    glassPanel(ctx, chip, 18)
    drawItemBadge(ctx, effect.type, color, chip.x + 18, chip.y + 18, 28)

    if (timed) {
      drawText(ctx, `${Math.ceil(effect.remaining ?? 0)}s`, chip.x + 40, chip.y + 24, { size: 17, weight: 700 })
    }
    x += chip.width + 10
  }
}

// ---- 버튼과 pause 메뉴 ----

export const PAUSE_BUTTON: Rect = { x: LOGICAL_WIDTH - 40 - 60, y: 31, width: 60, height: 44 }
/** 음소거 토글 버튼: pause 버튼 바로 왼쪽 */
export const MUTE_BUTTON: Rect = { x: PAUSE_BUTTON.x - 70, y: 31, width: 60, height: 44 }
const MENU_PANEL: Rect = { x: 440, y: 190, width: 400, height: 370 }
export const RESTART_BUTTON: Rect = { x: 490, y: 300, width: 300, height: 60 }
export const EXIT_BUTTON: Rect = { x: 490, y: 390, width: 300, height: 60 }
/** 볼륨 슬라이더 막대. 클릭/드래그 판정은 위아래로 여유를 둔 SLIDER_HIT_AREA를 쓴다. */
export const SLIDER_TRACK: Rect = { x: 490, y: 508, width: 300, height: 8 }
export const SLIDER_HIT_AREA: Rect = { x: 470, y: 488, width: 340, height: 48 }

/** 슬라이더 위의 논리 x 좌표를 볼륨(0~1)으로 바꾼다. 막대 밖은 양 끝으로 제한한다. */
export function sliderValueAt(x: number): number {
  return Math.min(1, Math.max(0, (x - SLIDER_TRACK.x) / SLIDER_TRACK.width))
}

export function renderPauseButton(ctx: CanvasRenderingContext2D): void {
  const r = PAUSE_BUTTON
  glassPanel(ctx, r, 14)
  ctx.fillStyle = '#ffffff'
  for (const dx of [-8, 2]) {
    ctx.beginPath()
    ctx.roundRect(r.x + r.width / 2 + dx, r.y + 13, 6, r.height - 26, 3)
    ctx.fill()
  }
}

export function renderMuteButton(ctx: CanvasRenderingContext2D, muted: boolean): void {
  const r = MUTE_BUTTON
  glassPanel(ctx, r, 14)
  const cx = r.x + r.width / 2
  const cy = r.y + r.height / 2
  // 스피커 본체
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(cx - 14, cy - 5)
  ctx.lineTo(cx - 7, cy - 5)
  ctx.lineTo(cx + 1, cy - 12)
  ctx.lineTo(cx + 1, cy + 12)
  ctx.lineTo(cx - 7, cy + 5)
  ctx.lineTo(cx - 14, cy + 5)
  ctx.closePath()
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  if (muted) {
    ctx.strokeStyle = '#ff5d73'
    ctx.beginPath()
    ctx.moveTo(cx + 7, cy - 7)
    ctx.lineTo(cx + 19, cy + 7)
    ctx.moveTo(cx + 19, cy - 7)
    ctx.lineTo(cx + 7, cy + 7)
    ctx.stroke()
  } else {
    ctx.strokeStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx + 2, cy, 8, -Math.PI / 3, Math.PI / 3)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx + 2, cy, 14, -Math.PI / 3, Math.PI / 3)
    ctx.stroke()
  }
  ctx.lineCap = 'butt'
}

function renderVolumeSlider(ctx: CanvasRenderingContext2D, volume: number, muted: boolean): void {
  const t = SLIDER_TRACK
  drawText(ctx, 'VOLUME', t.x, 488, { size: 13, spacing: 3, color: MUTED })
  drawText(ctx, muted ? 'MUTED' : `${Math.round(volume * 100)}%`, t.x + t.width, 488, {
    size: 15,
    weight: 700,
    align: 'right',
    color: muted ? '#ff8da0' : '#ffffff',
  })

  // 트랙과 채워진 부분
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)'
  ctx.beginPath()
  ctx.roundRect(t.x, t.y, t.width, t.height, 4)
  ctx.fill()
  const filled = Math.max(t.height, t.width * volume)
  const fill = ctx.createLinearGradient(t.x, 0, t.x + t.width, 0)
  fill.addColorStop(0, muted ? '#6b7290' : ACCENT_A)
  fill.addColorStop(1, muted ? '#4b5270' : ACCENT_B)
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(t.x, t.y, filled, t.height, 4)
  ctx.fill()

  // 손잡이
  ctx.save()
  ctx.shadowColor = muted ? 'rgba(255, 255, 255, 0.3)' : ACCENT_A
  ctx.shadowBlur = 14
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(t.x + t.width * volume, t.y + t.height / 2, 11, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function renderPauseMenu(ctx: CanvasRenderingContext2D, volume: number, muted: boolean): void {
  ctx.fillStyle = 'rgba(5, 7, 22, 0.72)'
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)
  glassPanel(ctx, MENU_PANEL, 24, { fill: 'rgba(18, 22, 58, 0.92)', shadow: 'rgba(77, 227, 255, 0.25)' })

  const cx = LOGICAL_WIDTH / 2
  drawText(ctx, 'PAUSED', cx, 262, { size: 30, weight: 800, spacing: 8, align: 'center' })

  // 주요 동작(RESTART)은 색을 채우고, 보조 동작(EXIT)은 유리 버튼으로 구분한다.
  accentButton(ctx, RESTART_BUTTON, 16)
  drawText(ctx, 'RESTART', cx, RESTART_BUTTON.y + 38, {
    size: 20,
    weight: 700,
    spacing: 4,
    align: 'center',
    color: '#0a1030',
  })
  glassPanel(ctx, EXIT_BUTTON, 16, { fill: 'rgba(255, 255, 255, 0.06)', border: 'rgba(255, 255, 255, 0.28)' })
  drawText(ctx, 'EXIT', cx, EXIT_BUTTON.y + 38, { size: 20, weight: 700, spacing: 4, align: 'center' })

  renderVolumeSlider(ctx, volume, muted)
}
