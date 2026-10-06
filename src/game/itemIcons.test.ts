import { describe, expect, it } from 'vitest'
import { drawItemBadge, drawItemIcon } from './itemIcons'
import { ITEM_TYPES, itemColor, renderItems, type Item } from './items'

/** 호출 기록만 남기는 가짜 캔버스 컨텍스트 */
function recorder() {
  const calls: string[] = []
  const store: Record<string, unknown> = {}
  const ctx = new Proxy(store, {
    get: (t, k: string) =>
      k in t
        ? t[k]
        : k === 'createLinearGradient'
          ? () => ({ addColorStop: () => {} })
          : (...a: unknown[]) => void calls.push(`${k}(${a.map((v) => (typeof v === 'number' ? v.toFixed(3) : String(v))).join(',')})`),
    set: (t, k: string, v) => ((t[k] = v), true),
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

describe('아이템 아이콘', () => {
  it('6종 모두 글자가 아니라 도형(path/arc)으로 그려지고 텍스트를 쓰지 않는다', () => {
    for (const type of ITEM_TYPES) {
      const { ctx, calls } = recorder()
      drawItemIcon(ctx, type, 100, 100, 24)
      expect(calls.some((c) => c.startsWith('fillText'))).toBe(false)
      expect(calls.some((c) => c.startsWith('arc(') || c.startsWith('lineTo(') || c.startsWith('roundRect('))).toBe(true)
    }
  })

  it('6종의 아이콘 그리기 결과가 서로 모두 다르다', () => {
    const signatures = ITEM_TYPES.map((type) => {
      const { ctx, calls } = recorder()
      drawItemIcon(ctx, type, 0, 0, 24)
      return calls.join('|')
    })
    expect(new Set(signatures).size).toBe(ITEM_TYPES.length)
  })

  it('종류별 대표 색도 서로 다르다', () => {
    expect(new Set(ITEM_TYPES.map(itemColor)).size).toBe(ITEM_TYPES.length)
  })

  it('공 분산은 공 3개, 속도 +/-는 공 1개와 화살표 2쌍, 점수 +는 별(10개 꼭짓점)이다', () => {
    const count = (type: (typeof ITEM_TYPES)[number], prefix: string) => {
      const { ctx, calls } = recorder()
      drawItemIcon(ctx, type, 0, 0, 24)
      return calls.filter((c) => c.startsWith(prefix)).length
    }
    expect(count('multiBall', 'arc(')).toBe(3)
    expect(count('ballSpeedUp', 'arc(')).toBe(1)
    expect(count('ballSpeedDown', 'arc(')).toBe(1)
    expect(count('ballSpeedUp', 'stroke(')).toBe(2)
    expect(count('ballSpeedDown', 'stroke(')).toBe(2)
    expect(count('paddleLong', 'roundRect(')).toBe(1)
    expect(count('paddleLong', 'stroke(')).toBe(2)
    // 별: moveTo 1 + lineTo 9
    expect(count('scoreBonus', 'lineTo(')).toBe(9)
  })

  it('막대 길이 +는 막대가 길고 -는 짧으며, 화살표 방향이 서로 반대이다', () => {
    const widthOf = (type: 'paddleLong' | 'paddleShort') => {
      const { ctx, calls } = recorder()
      drawItemIcon(ctx, type, 0, 0, 24)
      const call = calls.find((c) => c.startsWith('roundRect('))!
      return Number(call.slice(10, -1).split(',')[2])
    }
    expect(widthOf('paddleLong')).toBeGreaterThan(widthOf('paddleShort'))

    const firstArrowX = (type: 'paddleLong' | 'paddleShort') => {
      const { ctx, calls } = recorder()
      drawItemIcon(ctx, type, 0, 0, 24)
      const moves = calls.filter((c) => c.startsWith('moveTo('))
      return moves.map((m) => Number(m.slice(7, -1).split(',')[0]))
    }
    // 길이 +: 화살표 시작점이 안쪽(절댓값 작음)에서 바깥으로, 길이 -: 바깥에서 안쪽으로 향한다.
    const longMoves = firstArrowX('paddleLong')
    const shortMoves = firstArrowX('paddleShort')
    expect(Math.abs(longMoves[0])).toBeLessThan(Math.abs(shortMoves[0]))
  })

  it('배지는 색 원에 아이콘을 올려 그리고, 크기에 따라 아이콘이 비례한다', () => {
    const { ctx, calls } = recorder()
    drawItemBadge(ctx, 'scoreBonus', '#ffd93d', 50, 60, 40)
    expect(calls.some((c) => c.startsWith('arc(50.000,60.000,20.000'))).toBe(true)
    expect(calls.some((c) => c.startsWith('fillText'))).toBe(false)
  })

  it('renderItems는 아이템마다 배지를 그린다', () => {
    const { ctx, calls } = recorder()
    const items: Item[] = ITEM_TYPES.map((type, i) => ({ type, x: 100 + i * 60, y: 200, width: 40, height: 40 }))
    renderItems(ctx, items)
    const badges = calls.filter((c) => c.startsWith('arc(') && c.includes(',20.000,'))
    expect(badges.length).toBeGreaterThanOrEqual(ITEM_TYPES.length)
    expect(calls.some((c) => c.startsWith('fillText'))).toBe(false)
  })
})
