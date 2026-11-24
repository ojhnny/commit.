import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Dialogs on ≥640px, bottom sheets below (DESIGN.md §9). */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 640px)')
}

export function useCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)')
}
