import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
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

// Swap this for an HTTP-backed repository once the backend exists.
const repository = new LocalStorageHabitRepository({ storage: browserStorage(), seedOnFirstRun: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App repository={repository} />
  </StrictMode>,
)
