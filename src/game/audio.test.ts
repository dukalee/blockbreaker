import { describe, expect, it } from 'vitest'
import {
  AudioEngine,
  DEFAULT_VOLUME,
  MAX_VOICES,
  type AudioContextLike,
  type AudioParamLike,
  type GainLike,
  type OscillatorLike,
} from './audio'
import { SOUNDS, SOUND_MIN_INTERVAL, type SoundName } from './sounds'

class FakeParam implements AudioParamLike {
  value = 0
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
}

class FakeOsc implements OscillatorLike {
  type: OscillatorType = 'sine'
  frequency = new FakeParam()
  onended: (() => void) | null = null
  started = false
  connect() {}
  start() {
    this.started = true
  }
  stop() {}
}

class FakeCtx implements AudioContextLike {
  state = 'suspended'
  currentTime = 0
  destination = {}
  oscillators: FakeOsc[] = []
  gains: GainLike[] = []
  resumeCalls = 0
  resume() {
    this.resumeCalls++
    this.state = 'running'
  }
  createOscillator() {
    const o = new FakeOsc()
    this.oscillators.push(o)
    return o
  }
  createGain() {
    const g: GainLike = { gain: new FakeParam(), connect() {} }
    this.gains.push(g)
    return g
  }
  createDynamicsCompressor() {
    return { connect() {} }
  }
}

function setup() {
  const ctx = new FakeCtx()
  let created = 0
  const engine = new AudioEngine(() => {
    created++
    return ctx
  })
  return { ctx, engine, created: () => created }
}

const ALL: SoundName[] = [
  'launch',
  'bounce',
  'blockBreak',
  'hardHit',
  'itemPickup',
  'lifeLost',
  'stageClear',
  'gameOver',
]

describe('효과음 정의', () => {
  it('8종이 모두 정의되어 있고 서로 구분된다', () => {
    expect(Object.keys(SOUNDS).sort()).toEqual([...ALL].sort())
    const signatures = ALL.map((n) => JSON.stringify(SOUNDS[n]))
    expect(new Set(signatures).size).toBe(8)
    for (const name of ALL) {
      expect(SOUNDS[name].length).toBeGreaterThan(0)
      expect(SOUND_MIN_INTERVAL[name]).toBeGreaterThan(0)
      for (const t of SOUNDS[name]) {
        expect(t.from).toBeGreaterThan(0)
        expect(t.to).toBeGreaterThan(0)
        expect(t.duration).toBeGreaterThan(0)
        expect(t.gain).toBeGreaterThan(0)
        expect(t.gain).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('AudioEngine 시작', () => {
  it('unlock 전에는 오류 없이 무음이고 AudioContext도 만들지 않는다', () => {
    const { ctx, engine, created } = setup()
    expect(() => engine.play('launch')).not.toThrow()
    expect(ctx.oscillators).toHaveLength(0)
    expect(created()).toBe(0)
    expect(engine.isRunning).toBe(false)
  })

  it('unlock 이후에는 재생되고, 여러 번 unlock해도 컨텍스트는 하나다', () => {
    const { ctx, engine, created } = setup()
    engine.unlock()
    engine.unlock()
    expect(created()).toBe(1)
    expect(ctx.resumeCalls).toBe(1)
    engine.play('launch')
    expect(ctx.oscillators).toHaveLength(SOUNDS.launch.length)
    expect(ctx.oscillators.every((o) => o.started)).toBe(true)
  })

  it('컨텍스트 생성이 실패해도(미지원 환경) 예외 없이 무음이다', () => {
    const engine = new AudioEngine(() => {
      throw new Error('unsupported')
    })
    expect(() => engine.unlock()).not.toThrow()
    expect(() => engine.play('bounce')).not.toThrow()
  })

  it('종류별로 오실레이터 개수가 정의대로 만들어진다', () => {
    for (const name of ALL) {
      const { ctx, engine } = setup()
      engine.unlock()
      engine.play(name)
      expect(ctx.oscillators).toHaveLength(SOUNDS[name].length)
    }
  })
})

describe('연속 충돌 처리', () => {
  it('같은 효과음은 최소 간격 안에서 다시 재생되지 않는다', () => {
    const { ctx, engine } = setup()
    engine.unlock()
    for (let i = 0; i < 6; i++) engine.play('bounce') // 공 6개가 같은 순간 충돌
    expect(ctx.oscillators).toHaveLength(1)
    ctx.currentTime += SOUND_MIN_INTERVAL.bounce + 0.001
    engine.play('bounce')
    expect(ctx.oscillators).toHaveLength(2)
  })

  it('서로 다른 효과음은 서로 막지 않는다', () => {
    const { ctx, engine } = setup()
    engine.unlock()
    engine.play('bounce')
    engine.play('blockBreak')
    engine.play('hardHit')
    expect(ctx.oscillators).toHaveLength(
      SOUNDS.bounce.length + SOUNDS.blockBreak.length + SOUNDS.hardHit.length,
    )
  })

  it('동시 발음 수가 상한을 넘지 않는다', () => {
    const { ctx, engine } = setup()
    engine.unlock()
    for (let i = 0; i < 500; i++) {
      ctx.currentTime += 1 // 간격 제한은 통과시키고 동시 발음 상한만 시험한다
      engine.play('stageClear')
    }
    expect(ctx.oscillators.length).toBeLessThanOrEqual(MAX_VOICES)
  })

  it('소리가 끝나면 발음 수가 반환되어 다시 재생할 수 있다', () => {
    const { ctx, engine } = setup()
    engine.unlock()
    for (let i = 0; i < 20; i++) {
      ctx.currentTime += 1
      engine.play('itemPickup')
    }
    const before = ctx.oscillators.length
    for (const o of ctx.oscillators) o.onended?.()
    ctx.currentTime += 1
    engine.play('itemPickup')
    expect(ctx.oscillators.length).toBe(before + SOUNDS.itemPickup.length)
  })
})

describe('마스터 볼륨', () => {
  it('기본 볼륨이 마스터 게인에 적용되고, setVolume으로 바뀐다', () => {
    const { ctx, engine } = setup()
    engine.unlock()
    const master = ctx.gains[0]
    expect(master.gain.value).toBe(DEFAULT_VOLUME)
    engine.setVolume(0.2)
    expect(master.gain.value).toBe(0.2)
    expect(engine.getVolume()).toBe(0.2)
  })

  it('볼륨은 0~1로 제한되고, unlock 전에 설정한 값도 유지된다', () => {
    const { ctx, engine } = setup()
    engine.setVolume(5)
    expect(engine.getVolume()).toBe(1)
    engine.setVolume(-1)
    expect(engine.getVolume()).toBe(0)
    engine.setVolume(0.3)
    engine.unlock()
    expect(ctx.gains[0].gain.value).toBe(0.3)
  })

  it('모든 효과음은 같은 마스터 게인을 거친다 (효과음 버스가 하나뿐이다)', () => {
    const { ctx, engine } = setup()
    engine.unlock()
    // 마스터 + 효과음 버스 + BGM 버스만 만들어지고, 소리마다 엔벨롭 게인이 추가된다.
    expect(ctx.gains).toHaveLength(3)
  })
})
