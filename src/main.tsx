import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans/wght.css'
import './index.css'
import App from './App.tsx'
import { applyTheme, watchSystemTheme } from './app/theme'
import { captureInstallPrompt } from './lib/platform'
import { SafeMode } from './safe/SafeMode'
import { installErrorRecorder, isSafeMode } from './safe/diagnostics'

installErrorRecorder()
applyTheme()
watchSystemTheme()
captureInstallPrompt()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSafeMode() ? <SafeMode /> : <App />}
  </StrictMode>,
)
