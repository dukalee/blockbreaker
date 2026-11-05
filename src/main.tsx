import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/press-start-2p'
import App from './App'
import './index.css'

// 캔버스 글자가 첫 프레임부터 픽셀 폰트로 나오도록 미리 불러온다.
void document.fonts.load('16px "Press Start 2P"')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
