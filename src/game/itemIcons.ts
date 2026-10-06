import type { ItemType } from './items'

const ICON_COLOR = '#10102a'

/**
 * 아이템 종류별 아이콘을 (cx, cy)를 중심으로 size 크기의 정사각형 안에 그린다. 좌표는 -1~1 단위 공간에서 그린다.
 * - 공 분산: 공 세 개
 * - 공 속도 +: 공 위로 쌍 화살표(∧∧), 공 속도 -: 공 아래로 쌍 화살표(∨∨)
 * - 막대 길이 +: 막대 양옆으로 바깥을 향한 화살표, 막대 길이 -: 짧은 막대 양옆에서 안쪽을 향한 화살표
 * - 점수 +: 별
 */
export function drawItemIcon(
  ctx: CanvasRenderingContext2D,
  type: ItemType,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(size / 2, size / 2)
  ctx.fillStyle = ICON_COLOR
  ctx.strokeStyle = ICON_COLOR
  ctx.lineWidth = 0.17
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const circle = (x: number, y: number, r: number) => {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const polyline = (...pts: number[]) => {
    ctx.beginPath()
    ctx.moveTo(pts[0], pts[1])
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1])
    ctx.stroke()
  }
  const bar = (halfWidth: number) => {
    ctx.beginPath()
    ctx.roundRect(-halfWidth, -0.15, halfWidth * 2, 0.3, 0.1)
    ctx.fill()
  }

  switch (type) {
    case 'multiBall':
      circle(0, -0.48, 0.3)
      circle(-0.52, 0.38, 0.3)
      circle(0.52, 0.38, 0.3)
      break
    case 'ballSpeedUp':
      circle(0, 0.5, 0.32)
      polyline(-0.5, -0.02, 0, -0.42, 0.5, -0.02)
      polyline(-0.5, -0.5, 0, -0.9, 0.5, -0.5)
      break
    case 'ballSpeedDown':
      circle(0, -0.5, 0.32)
      polyline(-0.5, 0.02, 0, 0.42, 0.5, 0.02)
      polyline(-0.5, 0.5, 0, 0.9, 0.5, 0.5)
      break
    case 'paddleLong':
      bar(0.32)
      polyline(-0.55, -0.34, -0.92, 0, -0.55, 0.34)
      polyline(0.55, -0.34, 0.92, 0, 0.55, 0.34)
      break
    case 'paddleShort':
      bar(0.14)
      polyline(-0.92, -0.34, -0.55, 0, -0.92, 0.34)
      polyline(0.92, -0.34, 0.55, 0, 0.92, 0.34)
      break
    case 'scoreBonus': {
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 0.95 : 0.4
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const x = Math.cos(a) * r
        const y = Math.sin(a) * r + 0.06
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
      break
    }
  }
  ctx.restore()
}

/** 글로우가 있는 색 원 위에 아이콘을 올린 아이템 배지. 낙하 중인 아이템과 HUD 효과 칩에서 함께 쓴다. */
export function drawItemBadge(
  ctx: CanvasRenderingContext2D,
  type: ItemType,
  color: string,
  cx: number,
  cy: number,
  diameter: number,
): void {
  const r = diameter / 2
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = diameter * 0.45
  const body = ctx.createLinearGradient(0, cy - r, 0, cy + r)
  body.addColorStop(0, '#ffffff')
  body.addColorStop(0.35, color)
  body.addColorStop(1, color)
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = Math.max(1.5, diameter * 0.05)
  ctx.beginPath()
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2)
  ctx.stroke()

  drawItemIcon(ctx, type, cx, cy, diameter * 0.64)
}
