import { MAX_FRAME_MS, UPDATE_STEP_MS } from './constants'

export interface GameLoopOptions {
  /** 고정 간격(stepMs)으로 호출된다. dt는 초 단위. */
  update: (dt: number) => void
  /** requestAnimationFrame마다 호출된다. alpha는 다음 update까지의 진행률(0~1). */
  render: (alpha: number) => void
  stepMs?: number
}

// 고정 시간 간격 update + 가변 render 루프. 프레임 시간 누적 방식.
export class GameLoop {
  private readonly update: (dt: number) => void
  private readonly render: (alpha: number) => void
  private readonly stepMs: number
  private accumulator = 0
  private last = 0
  private rafId: number | null = null

  constructor({ update, render, stepMs = UPDATE_STEP_MS }: GameLoopOptions) {
    this.update = update
    this.render = render
    this.stepMs = stepMs
  }

  /** 경과 시간(ms)만큼 누적하고 필요한 횟수만큼 update를 호출한다. */
  advance(frameMs: number): void {
    this.accumulator += Math.min(frameMs, MAX_FRAME_MS)
    while (this.accumulator >= this.stepMs) {
      this.update(this.stepMs / 1000)
      this.accumulator -= this.stepMs
    }
    this.render(this.accumulator / this.stepMs)
  }

  start(): void {
    if (this.rafId !== null) return
    this.last = performance.now()
    const tick = (now: number) => {
      this.advance(now - this.last)
      this.last = now
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this.accumulator = 0
  }
}
