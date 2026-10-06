import { describe, expect, it, vi } from 'vitest'
import { GameLoop } from './loop'

describe('GameLoop', () => {
  it('프레임 시간과 무관하게 고정 간격으로 update를 호출한다', () => {
    const update = vi.fn()
    const render = vi.fn()
    const loop = new GameLoop({ update, render, stepMs: 10 })
    loop.advance(35)
    expect(update).toHaveBeenCalledTimes(3)
    expect(update).toHaveBeenCalledWith(0.01)
    expect(render).toHaveBeenCalledTimes(1)
    expect(render.mock.calls[0][0]).toBeCloseTo(0.5)
  })
})
