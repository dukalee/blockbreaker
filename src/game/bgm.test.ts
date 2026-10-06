import { describe, expect, it } from 'vitest'
import {
  AudioEngine,
  BGM_LOOKAHEAD,
  type AudioContextLike,
  type AudioParamLike,
  type GainLike,
  type OscillatorLike,
} from './audio'
import { BGM_TRACKS, midiToHz, stepSeconds, trackLength } from './bgm'
import { SLIDER_HIT_AREA, SLIDER_TRACK, sliderValueAt, hitTest, MUTE_BUTTON, PAUSE_BUTTON } from './ui'

class FakeParam implements AudioParamLike {
  value = 0
  freqs: number[] = []
  setValueAtTime(v: number) {
    this.freqs.push(v)
  }
  exponentialRampToValueAtTime() {}
}
class FakeOsc implements OscillatorLike {
  type: OscillatorType = 'sine'
  frequency = new FakeParam()
  onended: (() => void) | null = null
  startedAt = -1
  connect() {}
  start(when: number) {
    this.startedAt = when
  }
  stop() {}
}
class FakeCtx implements AudioContextLike {
  state = 'suspended'
  currentTime = 0
  destination = {}
  oscillators: FakeOsc[] = []
  gains: GainLike[] = []
  resume() {
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
  let timers = 0
  const engine = new AudioEngine(
    () => ctx,
    () => {
      timers++
    },
  )
  return { ctx, engine, timers: () => timers }
}

/** 시간을 dt씩 흘리며 tick을 total초 동안 호출한다. */
function run(ctx: FakeCtx, engine: AudioEngine, total: number, dt = 0.05) {
  for (let t = 0; t < total; t += dt) {
    ctx.currentTime += dt
    engine.tick()
  }
}

describe('BGM 곡 정의', () => {
  it('title과 game 두 곡이 서로 다르다', () => {
    expect(Object.keys(BGM_TRACKS).sort()).toEqual(['game', 'title'])
    expect(JSON.stringify(BGM_TRACKS.title)).not.toBe(JSON.stringify(BGM_TRACKS.game))
    expect(BGM_TRACKS.title.bpm).not.toBe(BGM_TRACKS.game.bpm)
  })

  it('모든 파트의 길이가 같고 노트가 유효하다', () => {
    for (const track of Object.values(BGM_TRACKS)) {
      const len = trackLength(track)
      expect(len).toBeGreaterThan(0)
      for (const voice of track.voices) {
        expect(voice.notes).toHaveLength(len)
        expect(voice.gain).toBeGreaterThan(0)
        expect(voice.hold).toBeGreaterThan(0)
        expect(voice.notes.some((n) => n > 0)).toBe(true)
        for (const n of voice.notes) expect(Number.isInteger(n) && n >= 0 && n < 128).toBe(true)
      }
    }
  })

  it('midiToHz는 A4=440Hz 기준이다', () => {
    expect(midiToHz(69)).toBeCloseTo(440)
    expect(midiToHz(81)).toBeCloseTo(880)
  })
})

describe('BGM 재생과 반복', () => {
  it('unlock 전에는 아무 소리도 만들지 않고 오류도 없다', () => {
    const { ctx, engine } = setup()
    engine.playBgm('title')
    expect(() => engine.tick()).not.toThrow()
    expect(ctx.oscillators).toHaveLength(0)
  })

  it('unlock 전에 정한 곡이 unlock 후 시작되고, 타이머는 한 번만 시작된다', () => {
    const { ctx, engine, timers } = setup()
    engine.playBgm('title')
    engine.unlock()
    engine.unlock()
    expect(timers()).toBe(1)
    run(ctx, engine, 1)
    expect(ctx.oscillators.length).toBeGreaterThan(0)
  })

  it('곡이 끝나면 처음부터 반복 재생된다', () => {
    const { ctx, engine } = setup()
    engine.unlock()
    engine.playBgm('title')
    const loopSec = trackLength(BGM_TRACKS.title) * stepSeconds(BGM_TRACKS.title)
    run(ctx, engine, loopSec * 2 + 1)
    const noteCount = BGM_TRACKS.title.voices.reduce(
      (n, v) => n + v.notes.filter((x) => x > 0).length,
      0,
    )
    // 두 번 이상 반복했으므로 한 바퀴 분량의 노트보다 훨씬 많이 예약된다.
    expect(ctx.oscillators.length).toBeGreaterThanOrEqual(noteCount * 2)
    // 노트 시작 시각은 시간순으로 한참 뒤까지 이어진다.
    const last = Math.max(...ctx.oscillators.map((o) => o.startedAt))
    expect(last).toBeGreaterThan(loopSec * 2)
  })

  it('title과 game은 서로 다른 소리(주파수)를 낸다', () => {
    const a = setup()
    a.engine.unlock()
    a.engine.playBgm('title')
    run(a.ctx, a.engine, 3)
    const b = setup()
    b.engine.unlock()
    b.engine.playBgm('game')
    run(b.ctx, b.engine, 3)
    const freqs = (c: FakeCtx) => c.oscillators.map((o) => Math.round(o.frequency.freqs[0])).join(',')
    expect(freqs(a.ctx)).not.toBe(freqs(b.ctx))
  })

  it('같은 곡을 다시 요청해도 처음부터 다시 시작하지 않는다', () => {
    const { ctx, engine } = setup()
    engine.unlock()
    engine.playBgm('game')
    run(ctx, engine, 1)
    const before = ctx.oscillators.length
    engine.playBgm('game')
    run(ctx, engine, 0.05)
    // 다음 노트를 이어서 예약할 뿐, 곡 첫 노트로 되돌아가 한꺼번에 예약하지 않는다.
    expect(ctx.oscillators.length - before).toBeLessThan(6)
    expect(engine.currentBgm).toBe('game')
  })

  it('stopBgm 이후에는 더 이상 노트를 예약하지 않는다', () => {
    const { ctx, engine } = setup()
    engine.unlock()
    engine.playBgm('game')
    run(ctx, engine, 1)
    engine.stopBgm()
    const before = ctx.oscillators.length
    run(ctx, engine, 2)
    expect(ctx.oscillators.length).toBe(before)
    expect(engine.currentBgm).toBeNull()
  })

  it('곡을 바꾸면 새 곡의 처음부터 재생된다', () => {
    const { ctx, engine } = setup()
    engine.unlock()
    engine.playBgm('title')
    run(ctx, engine, 2)
    const before = ctx.oscillators.length
    engine.playBgm('game')
    run(ctx, engine, 0.3)
    const firstGameFreq = midiToHz(BGM_TRACKS.game.voices[0].notes[0])
    const added = ctx.oscillators.slice(before)
    expect(added.some((o) => Math.abs(o.frequency.freqs[0] - firstGameFreq) < 0.01)).toBe(true)
  })
})

describe('pause 중 BGM', () => {
  it('pause 중에는 새 노트를 예약하지 않고, 재개하면 이어서 재생한다', () => {
    const { ctx, engine } = setup()
    engine.unlock()
    engine.playBgm('game')
    run(ctx, engine, 1)
    engine.setBgmPaused(true)
    run(ctx, engine, BGM_LOOKAHEAD) // 이미 예약된 구간은 흘려보낸다
    const paused = ctx.oscillators.length
    run(ctx, engine, 5)
    expect(ctx.oscillators.length).toBe(paused)

    engine.setBgmPaused(false)
    run(ctx, engine, 1)
    expect(ctx.oscillators.length).toBeGreaterThan(paused)
  })

  it('재개 시 멈춰 있던 시간만큼 한꺼번에 몰아서 재생하지 않는다', () => {
    const { ctx, engine } = setup()
    engine.unlock()
    engine.playBgm('game')
    run(ctx, engine, 1)
    engine.setBgmPaused(true)
    ctx.currentTime += 30
    engine.setBgmPaused(false)
    const before = ctx.oscillators.length
    engine.tick()
    expect(ctx.oscillators.length - before).toBeLessThan(10)
  })
})

describe('음소거와 볼륨', () => {
  it('음소거하면 마스터 게인이 0이 되고 해제하면 볼륨으로 돌아간다', () => {
    const { ctx, engine } = setup()
    engine.unlock()
    const master = ctx.gains[0]
    engine.setVolume(0.4)
    expect(master.gain.value).toBe(0.4)
    expect(engine.toggleMute()).toBe(true)
    expect(master.gain.value).toBe(0)
    expect(engine.isMuted).toBe(true)
    expect(engine.toggleMute()).toBe(false)
    expect(master.gain.value).toBe(0.4)
  })

  it('음소거 중 볼륨을 바꿔도 소리는 꺼져 있고, 해제하면 바뀐 볼륨이 적용된다', () => {
    const { ctx, engine } = setup()
    engine.unlock()
    const master = ctx.gains[0]
    engine.setMuted(true)
    engine.setVolume(0.9)
    expect(master.gain.value).toBe(0)
    engine.setMuted(false)
    expect(master.gain.value).toBe(0.9)
  })

  it('unlock 전에 정한 음소거·볼륨이 unlock 후에 적용된다', () => {
    const { ctx, engine } = setup()
    engine.setMuted(true)
    engine.setVolume(0.7)
    engine.unlock()
    expect(ctx.gains[0].gain.value).toBe(0)
    engine.setMuted(false)
    expect(ctx.gains[0].gain.value).toBe(0.7)
  })

  it('효과음과 BGM은 같은 마스터 게인을 거친다 (게인 노드: 마스터, 효과음 버스, BGM 버스)', () => {
    const { ctx, engine } = setup()
    engine.unlock()
    expect(ctx.gains).toHaveLength(3)
  })

  it('음소거·볼륨은 화면(곡) 전환과 무관하게 유지된다', () => {
    const { engine } = setup()
    engine.unlock()
    engine.setMuted(true)
    engine.setVolume(0.25)
    engine.playBgm('title')
    engine.playBgm('game')
    engine.stopBgm()
    expect(engine.isMuted).toBe(true)
    expect(engine.getVolume()).toBe(0.25)
  })
})

describe('볼륨 슬라이더/버튼 좌표', () => {
  it('슬라이더 x 좌표가 0~1 볼륨으로 변환되고 양 끝으로 제한된다', () => {
    expect(sliderValueAt(SLIDER_TRACK.x)).toBe(0)
    expect(sliderValueAt(SLIDER_TRACK.x + SLIDER_TRACK.width)).toBe(1)
    expect(sliderValueAt(SLIDER_TRACK.x + SLIDER_TRACK.width / 2)).toBeCloseTo(0.5)
    expect(sliderValueAt(-100)).toBe(0)
    expect(sliderValueAt(5000)).toBe(1)
  })

  it('슬라이더 판정 영역은 막대를 포함한다', () => {
    expect(hitTest(SLIDER_HIT_AREA, SLIDER_TRACK.x, SLIDER_TRACK.y + 4)).toBe(true)
    expect(hitTest(SLIDER_HIT_AREA, SLIDER_TRACK.x + SLIDER_TRACK.width, SLIDER_TRACK.y + 4)).toBe(true)
  })

  it('음소거 버튼은 pause 버튼 옆에 있고 서로 겹치지 않는다', () => {
    expect(MUTE_BUTTON.x + MUTE_BUTTON.width).toBeLessThanOrEqual(PAUSE_BUTTON.x)
    expect(MUTE_BUTTON.y).toBe(PAUSE_BUTTON.y)
  })
})
