import { useState } from 'react'
import { GameCanvas, type Screen } from './components/GameCanvas'

export default function App() {
  const [screen, setScreen] = useState<Screen>('title')
  const [finalScore, setFinalScore] = useState(0)

  return (
    <div className="stage">
      <GameCanvas
        screen={screen}
        finalScore={finalScore}
        onStart={() => setScreen('playing')}
        onGameOver={(score) => {
          setFinalScore(score)
          setScreen('gameOver')
        }}
        onReturnToTitle={() => setScreen('title')}
      />
    </div>
  )
}
