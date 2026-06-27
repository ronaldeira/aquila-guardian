import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import App from './App'
import '@deframe-sdk/components/styles.css'
import './style.css'

const globalWithBuffer = globalThis as typeof globalThis & { Buffer?: typeof Buffer }
globalWithBuffer.Buffer ??= Buffer

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
