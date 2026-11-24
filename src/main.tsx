import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { CloudRoot } from './state/Account'
import { LocalStorageHabitRepository, createMemoryStorage, type KeyValueStorage } from './services/localStorageRepository'
import './styles/index.css'

function browserStorage(): KeyValueStorage {
  try {
    const probe = '__commit_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    // Private mode / blocked storage: keep working for this session only.
    return createMemoryStorage()
  }
}

// Ask the browser not to evict our data under storage pressure (best effort).
void navigator.storage?.persist?.().catch(() => undefined)

// With VITE_API_URL set, habits live in your account on the server (sign-in required).
// Without it, the app keeps everything in this browser (used for the clickable preview).
const apiUrl = import.meta.env.VITE_API_URL?.trim()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {apiUrl ? (
      <CloudRoot apiUrl={apiUrl} />
    ) : (
      <App repository={new LocalStorageHabitRepository({ storage: browserStorage(), seedOnFirstRun: true })} />
    )}
  </StrictMode>,
)
