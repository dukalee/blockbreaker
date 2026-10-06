import { describe, expect, it } from 'vitest'
import { fitViewport } from './scale'

describe('fitViewport', () => {
  it('창이 더 넓으면 높이에 맞추고 16:9를 유지한다', () => {
    const v = fitViewport(2000, 720)
    expect(v.height).toBe(720)
    expect(v.width).toBeCloseTo(1280)
  })

  it('창이 더 좁으면 너비에 맞추고 16:9를 유지한다', () => {
    const v = fitViewport(640, 1000)
    expect(v.width).toBe(640)
    expect(v.height).toBeCloseTo(360)
    expect(v.width / v.height).toBeCloseTo(16 / 9)
  })
})
