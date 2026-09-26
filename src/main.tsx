import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

// Self-hosted variable fonts. Imported here so they are bundled and served
// from the same origin — no third-party font request, and no layout shift from
// a late font swap on an instrument whose readouts must not move.
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/jetbrains-mono'

import './styles/tokens.css'
import './styles/base.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element missing')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
