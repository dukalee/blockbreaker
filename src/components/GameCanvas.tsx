import { useEffect, useRef, useState } from 'react'
import { audio } from '../game/audio'
import { renderBall } from '../game/ball'
import { createBackdrop, renderBackdrop, renderWalls, updateBackdrop } from '../game/backdrop'
import { renderBlocks } from '../game/blockRender'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../game/constants'
import { createGame, drainEvents, setPaused, togglePause, updateGame, type GameState } from '../game/game'
import { InputState } from '../game/input'
import { renderItems } from '../game/items'
import { GameLoop } from '../game/loop'
import { renderPaddle } from '../game/paddle'
import { fitViewport, toLogicalX, toLogicalY, type Viewport } from '../game/scale'
import {
  EXIT_BUTTON,
  hitTest,
  MUTE_BUTTON,
  PAUSE_BUTTON,
  RESTART_BUTTON,
  renderGameOver,
  renderHud,
  renderMuteButton,
  renderPauseButton,
  renderPauseMenu,
  renderTitle,
  SLIDER_HIT_AREA,
  sliderValueAt,
} from '../game/ui'

export type Screen = 'title' | 'playing' | 'gameOver'

/** GAME OVER 직후 눌러 둔 space로 화면이 바로 넘어가지 않도록 하는 대기 시간(초). */
const GAME_OVER_INPUT_DELAY = 0.6

interface Props {
  screen: Screen
  finalScore: number
  onStart: () => void
  onGameOver: (score: number) => void
  onReturnToTitle: () => void
}

function currentViewport(): Viewport {
  return fitViewport(window.innerWidth, window.innerHeight)
}

export function GameCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewport, setViewport] = useState<Viewport>(currentViewport)
  // 화면 전환 콜백이 바뀌어도 루프를 다시 만들지 않도록 최신 props를 ref로 보관한다.
  const propsRef = useRef(props)
  propsRef.current = props
  const { screen } = props

  useEffect(() => {
    const onResize = () => setViewport(currentViewport())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 화면이 바뀔 때마다 입력 상태, 게임 상태, 루프를 새로 만든다.
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const input = new InputState()
    const backdrop = createBackdrop()
    let time = 0
    // playing 화면에서만 존재한다. restart 시 새 게임으로 교체된다.
    let game: GameState | undefined
    // pause 메뉴의 볼륨 슬라이더를 드래그 중인지
    let draggingVolume = false

    // 화면에 맞는 BGM. GAME OVER에서는 BGM을 끄고 게임 오버 효과음만 들려준다.
    // 새 화면은 pause 해제 상태로 시작한다. (pause 메뉴에서 EXIT로 나온 경우 대비)
    audio.setBgmPaused(false)
    if (screen === 'title') audio.playBgm('title')
    else if (screen === 'playing') audio.playBgm('game')
    else audio.stopBgm()

    const logicalPoint = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: toLogicalX(e.clientX, rect.left, rect.width),
        y: toLogicalY(e.clientY, rect.top, rect.height),
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      // 브라우저 자동 재생 정책: 첫 사용자 입력 이후에 오디오를 시작한다.
      audio.unlock()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ') e.preventDefault()
      if (e.key === 'Escape') {
        if (game && !e.repeat) togglePause(game)
        return
      }
      if (e.key === 'm' || e.key === 'M') {
        if (!e.repeat) audio.toggleMute()
        return
      }
      // 키를 누르고 있는 동안 반복되는 space는 무시한다. (화면 전환 직후 바로 발사되는 것을 막는다)
      if (e.key === ' ' && e.repeat) return
      input.keyDown(e.key)
    }
    const onKeyUp = (e: KeyboardEvent) => input.keyUp(e.key)
    const onBlur = () => input.releaseAllKeys()
    const onMouseMove = (e: MouseEvent) => {
      const { x } = logicalPoint(e)
      input.mouseMove(x)
      if (draggingVolume) audio.setVolume(sliderValueAt(x))
    }
    const onMouseDown = (e: MouseEvent) => {
      audio.unlock()
      if (!game?.paused) return
      const { x, y } = logicalPoint(e)
      if (hitTest(SLIDER_HIT_AREA, x, y)) {
        draggingVolume = true
        audio.setVolume(sliderValueAt(x))
      }
    }
    const onMouseUp = () => {
      draggingVolume = false
    }
    const onClick = (e: MouseEvent) => {
      audio.unlock()
      if (!game) return
      const { x, y } = logicalPoint(e)
      if (hitTest(PAUSE_BUTTON, x, y)) {
        togglePause(game)
      } else if (hitTest(MUTE_BUTTON, x, y)) {
        audio.toggleMute()
      } else if (game.paused && hitTest(RESTART_BUTTON, x, y)) {
        game = createGame()
      } else if (game.paused && hitTest(EXIT_BUTTON, x, y)) {
        propsRef.current.onReturnToTitle()
      } else if (!game.paused && !hitTest(SLIDER_HIT_AREA, x, y)) {
        // 버튼이 아닌 곳을 클릭하면 space처럼 공을 발사한다.
        input.requestLaunch()
      }
    }
    // 탭이 비활성화되면 자동으로 pause 한다.
    const onVisibilityChange = () => {
      if (document.hidden && game) setPaused(game, true)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('click', onClick)
    document.addEventListener('visibilitychange', onVisibilityChange)

    let loop: GameLoop
    if (screen === 'title') {
      loop = new GameLoop({
        update: (dt) => {
          time += dt
          updateBackdrop(backdrop, dt)
          if (input.consumeLaunch()) propsRef.current.onStart()
        },
        render: () => renderTitle(ctx, backdrop, time),
      })
    } else if (screen === 'playing') {
      game = createGame()
      loop = new GameLoop({
        update: (dt) => {
          if (!game) return
          // 배경도 pause 중에는 멈춘다.
          if (!game.paused) {
            time += dt
            updateBackdrop(backdrop, dt)
          }
          updateGame(game, input, dt)
          for (const sound of drainEvents(game)) audio.play(sound)
          // pause 중에는 BGM도 멈추고, 재개하면 이어서 재생한다.
          audio.setBgmPaused(game.paused)
          if (game.phase === 'gameover') {
            loop.stop()
            propsRef.current.onGameOver(game.score)
          }
        },
        render: () => {
          if (!game) return
          renderBackdrop(ctx, backdrop, time)
          renderWalls(ctx)
          renderBlocks(ctx, game.blocks)
          renderHud(ctx, game)
          renderItems(ctx, game.items)
          renderPaddle(ctx, game.paddle)
          for (const ball of game.balls) renderBall(ctx, ball)
          renderMuteButton(ctx, audio.isMuted)
          renderPauseButton(ctx)
          if (game.paused) renderPauseMenu(ctx, audio.getVolume(), audio.isMuted)
        },
      })
    } else {
      loop = new GameLoop({
        update: (dt) => {
          time += dt
          updateBackdrop(backdrop, dt)
          const pressed = input.consumeLaunch()
          if (pressed && time >= GAME_OVER_INPUT_DELAY) propsRef.current.onReturnToTitle()
        },
        render: () =>
          renderGameOver(ctx, backdrop, propsRef.current.finalScore, time, time >= GAME_OVER_INPUT_DELAY),
      })
    }
    loop.start()

    return () => {
      loop.stop()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('click', onClick)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [screen])

  return (
    <canvas
      ref={canvasRef}
      width={LOGICAL_WIDTH}
      height={LOGICAL_HEIGHT}
      style={{ width: viewport.width, height: viewport.height }}
    />
  )
}
