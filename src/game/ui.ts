import { renderBackdrop, renderScanlines, type Backdrop } from './backdrop'
import { INITIAL_LIFE, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './constants'
import { activeEffects, type Effects } from './effects'
import type { GameState } from './game'
import { drawItemBadge } from './itemIcons'
import { itemColor } from './items'

// 별 배경 관련 함수는 backdrop.ts로 옮겼고, 기존 import 경로를 위해 다시 내보낸다.
export { createStars, STAR_COUNT, updateStars, type Star } from './backdrop'

/** 픽셀 폰트. 화면에 나오는 글자는 모두 영문/숫자라 이 폰트만으로 충분하다. */
const FONT_FAMILY = '"Press Start 2P", monospace'
const TEXT = '#e8f1ff'
const LABEL = '#ffd84d'
const ACCENT = '#4dc3ff'
const ACCENT_DARK = '#1f6fa6'
const DANGER = '#ff4d6d'
const INK = '#0d0f1e'
const SHADOW = '#05060f'
const PANEL = '#151934'
const PANEL_BORDER = '#c9d3ff'

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
  color?: string
  align?: CanvasTextAlign
  /** 글자 간격(px) */
  spacing?: number
  /** 글자 오른쪽 아래에 깔리는 단단한 그림자 색 */
  shadow?: string
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: TextOptions): void {
  ctx.font = `${o.size}px ${FONT_FAMILY}`
  ctx.textAlign = o.align ?? 'left'
  ctx.letterSpacing = `${o.spacing ?? 0}px`
  if (o.shadow) {
    const off = Math.max(2, Math.round(o.size / 14))
    ctx.fillStyle = o.shadow
    ctx.fillText(text, x + off, y + off)
  }
  ctx.fillStyle = o.color ?? TEXT
  ctx.fillText(text, x, y)
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'left'
}

/** 각진 픽셀 패널: 단단한 그림자 + 굵은 테두리 + 단색 면. */
function pixelPanel(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  opts: { fill?: string; border?: string; borderWidth?: number; shadow?: boolean } = {},
): void {
  const bw = opts.borderWidth ?? 4
  if (opts.shadow !== false) {
    ctx.fillStyle = SHADOW
    ctx.fillRect(r.x + 4, r.y + 4, r.width, r.height)
  }
  ctx.fillStyle = opts.border ?? PANEL_BORDER
  ctx.fillRect(r.x, r.y, r.width, r.height)
  ctx.fillStyle = opts.fill ?? PANEL
  ctx.fillRect(r.x + bw, r.y + bw, r.width - bw * 2, r.height - bw * 2)
}

/** 문자열 격자('X'가 켜진 칸)로 픽셀 그림을 그린다. */
function drawPixelMap(
  ctx: CanvasRenderingContext2D,
  rows: string[],
  x: number,
  y: number,
  cell: number,
  color: string,
): void {
  ctx.fillStyle = color
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      if (row[rx] === 'X') ctx.fillRect(x + rx * cell, y + ry * cell, cell, cell)
    }
  })
}

const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']

/** 큰 제목 글자: 단색 글자 아래에 같은 계열의 어두운 색을 깔아 픽셀 느낌을 낸다. */
function heroText(ctx: CanvasRenderingContext2D, text: string, y: number, size: number, color: string, shadow: string): void {
  drawText(ctx, text, LOGICAL_WIDTH / 2, y, { size, align: 'center', spacing: 6, color, shadow })
}

/** "PRESS SPACE ..." 같은 안내 문구를 각진 상자 모양으로 그린다. */
function promptBox(ctx: CanvasRenderingContext2D, label: string, cx: number, cy: number, width: number, alpha: number): void {
  const r: Rect = { x: cx - width / 2, y: cy - 28, width, height: 56 }
  ctx.save()
  ctx.globalAlpha = alpha
  pixelPanel(ctx, r, { fill: INK, border: ACCENT })
  drawText(ctx, label, cx, cy + 6, { size: 14, align: 'center', color: TEXT })
  ctx.restore()
}

/** 모든 화면 맨 아래에 들어가는 저작권 문구. */
export function renderFooter(ctx: CanvasRenderingContext2D): void {
  drawText(ctx, '© 2026 aishift. all rights reserved.', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 12, {
    size: 8,
    align: 'center',
    color: '#8a95d8',
  })
}

// ---- 화면 ----

/** 타이틀 화면의 START 버튼(클릭하면 게임 시작). 안내 상자와 같은 영역이다. */
export const START_BUTTON: Rect = { x: LOGICAL_WIDTH / 2 - 220, y: 472, width: 440, height: 56 }

export function renderTitle(ctx: CanvasRenderingContext2D, backdrop: Backdrop, time: number): void {
  renderBackdrop(ctx, backdrop, time)
  heroText(ctx, 'BLOCK', 250, 88, ACCENT, ACCENT_DARK)
  heroText(ctx, 'BREAKER', 360, 88, '#ff6bd6', '#a02d86')
  promptBox(ctx, 'PRESS SPACE TO START', LOGICAL_WIDTH / 2, START_BUTTON.y + 28, START_BUTTON.width, blinkAlpha(time))
  renderFooter(ctx)
  renderScanlines(ctx)
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
  pixelPanel(ctx, { x: cx - 280, y: 150, width: 560, height: 390 }, { fill: INK, border: DANGER })
  drawText(ctx, 'GAME OVER', cx, 250, { size: 44, align: 'center', color: DANGER, shadow: '#a3203d' })
  drawText(ctx, 'FINAL SCORE', cx, 325, { size: 14, align: 'center', color: LABEL })
  drawText(ctx, score.toLocaleString('en-US'), cx, 405, { size: 44, align: 'center', shadow: ACCENT_DARK })
  if (canContinue) {
    promptBox(ctx, 'PRESS SPACE TO RETURN', cx, 480, 460, blinkAlpha(time))
  }
  renderFooter(ctx)
  renderScanlines(ctx)
}

// ---- 게임 HUD ----

const LIFE_X = 380

export function renderHud(ctx: CanvasRenderingContext2D, game: GameState): void {
  // 좌측 상단: SCORE, STAGE
  drawText(ctx, 'SCORE', 40, 44, { size: 10, color: LABEL })
  drawText(ctx, game.score.toLocaleString('en-US'), 40, 74, { size: 18 })
  drawText(ctx, 'STAGE', 250, 44, { size: 10, color: LABEL })
  drawText(ctx, String(game.stage), 250, 74, { size: 18 })

  // LIFE: 남은 개수만큼 채워진 하트
  drawText(ctx, 'LIFE', LIFE_X, 44, { size: 10, color: LABEL })
  for (let i = 0; i < INITIAL_LIFE; i++) {
    drawPixelMap(ctx, HEART, LIFE_X + i * 40, 52, 4, i < game.life ? DANGER : '#3a3f66')
  }

  renderActiveEffects(ctx, game.effects)
}

/** 적용 중인 효과를 각진 칩(아이콘 + 남은 시간)으로 표시한다. 공 속도 효과는 시간 없이 아이콘만. */
function renderActiveEffects(ctx: CanvasRenderingContext2D, effects: Effects): void {
  let x = 560
  for (const effect of activeEffects(effects)) {
    const color = itemColor(effect.type)
    const timed = effect.remaining !== null
    drawItemBadge(ctx, effect.type, color, x + 18, 58, 36)
    if (timed) {
      drawText(ctx, `${Math.ceil(effect.remaining ?? 0)}s`, x + 48, 64, { size: 14 })
    }
    x += timed ? 112 : 56
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
  pixelPanel(ctx, r)
  ctx.fillStyle = TEXT
  for (const dx of [-10, 2]) ctx.fillRect(r.x + r.width / 2 + dx, r.y + 12, 8, r.height - 24)
}

export function renderMuteButton(ctx: CanvasRenderingContext2D, muted: boolean): void {
  const r = MUTE_BUTTON
  pixelPanel(ctx, r)
  const cx = r.x + r.width / 2
  const cy = r.y + r.height / 2
  // 스피커 본체: 계단식 픽셀
  ctx.fillStyle = TEXT
  ctx.fillRect(cx - 16, cy - 4, 8, 8)
  ctx.fillRect(cx - 8, cy - 8, 4, 16)
  ctx.fillRect(cx - 4, cy - 12, 4, 24)
  if (muted) {
    // 빨간 X
    ctx.fillStyle = DANGER
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(cx + 4 + i * 4, cy - 8 + i * 4, 4, 4)
      ctx.fillRect(cx + 4 + i * 4, cy + 4 - i * 4, 4, 4)
    }
  } else {
    ctx.fillStyle = TEXT
    ctx.fillRect(cx + 4, cy - 6, 4, 12)
    ctx.fillRect(cx + 12, cy - 12, 4, 24)
  }
}

function renderVolumeSlider(ctx: CanvasRenderingContext2D, volume: number, muted: boolean): void {
  const t = SLIDER_TRACK
  drawText(ctx, 'VOLUME', t.x, 484, { size: 10, color: LABEL })
  drawText(ctx, muted ? 'MUTED' : `${Math.round(volume * 100)}%`, t.x + t.width, 484, {
    size: 10,
    align: 'right',
    color: muted ? DANGER : TEXT,
  })

  // 트랙과 채워진 부분
  ctx.fillStyle = '#3a3f66'
  ctx.fillRect(t.x, t.y, t.width, t.height)
  ctx.fillStyle = muted ? '#6b7290' : ACCENT
  ctx.fillRect(t.x, t.y, Math.round(t.width * volume), t.height)

  // 손잡이: 네모난 블록
  const hx = Math.round(t.x + t.width * volume) - 8
  ctx.fillStyle = SHADOW
  ctx.fillRect(hx + 3, t.y - 8 + 3, 16, 24)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(hx, t.y - 8, 16, 24)
}

export function renderPauseMenu(ctx: CanvasRenderingContext2D, volume: number, muted: boolean): void {
  ctx.fillStyle = 'rgba(5, 6, 15, 0.8)'
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)
  pixelPanel(ctx, MENU_PANEL, { fill: INK, border: ACCENT })

  const cx = LOGICAL_WIDTH / 2
  drawText(ctx, 'PAUSED', cx, 262, { size: 28, align: 'center', spacing: 4, shadow: ACCENT_DARK })

  // 주요 동작(RESTART)은 색을 채우고, 보조 동작(EXIT)은 테두리만 둔다.
  pixelPanel(ctx, RESTART_BUTTON, { fill: ACCENT, border: '#ffffff' })
  drawText(ctx, 'RESTART', cx, RESTART_BUTTON.y + 37, { size: 18, align: 'center', color: INK })
  pixelPanel(ctx, EXIT_BUTTON, { fill: INK, border: PANEL_BORDER })
  drawText(ctx, 'EXIT', cx, EXIT_BUTTON.y + 37, { size: 18, align: 'center' })

  renderVolumeSlider(ctx, volume, muted)
}
