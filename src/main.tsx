import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { captureInstallPrompt } from './lib/platform'
import { SafeMode } from './safe/SafeMode'
import { installErrorRecorder, isSafeMode } from './safe/diagnostics'

installErrorRecorder()
captureInstallPrompt()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSafeMode() ? <SafeMode /> : <App />}
  </StrictMode>,
)
