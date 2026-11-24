/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the commit. API, e.g. https://commit-api.onrender.com. Unset = browser-only mode. */
  readonly VITE_API_URL?: string
  readonly VITE_ROUTER?: 'hash'
}
