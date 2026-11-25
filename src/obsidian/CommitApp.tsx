import { Archive } from '@/pages/Archive'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Dashboard } from '@/pages/Dashboard'
import { HabitDetails } from '@/pages/HabitDetails'
import { NotFound } from '@/pages/NotFound'
import type { HabitRepository } from '@/services/habitRepository'
import { HabitStoreProvider } from '@/state/HabitStore'
import { PlatformProvider, usePlatform, type Platform } from '@/platform/Platform'
import { NoteHostProvider } from '@/components/notes/noteHost'

function ScrollToTop() {
  const { pathname } = useLocation()
  const platform = usePlatform()
  const type = useNavigationType()
  // Replacements (a note's path following its new title) keep the scroll position.
  useEffect(() => {
    if (type !== 'REPLACE') platform.scrollToTop()
  }, [pathname, platform, type])
  return null
}

interface CommitAppProps {
  repository: HabitRepository
  subscribe: (onChange: () => void) => () => void
  platform: Platform
  /** Optional route to open on mount, e.g. `/habits/<id>`. */
  initialPath?: string
}

export function CommitApp({ repository, subscribe, platform, initialPath = '/' }: CommitAppProps) {
  const toaster: ReactNode = (
    <Toaster
      position="bottom-center"
      offset={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}
      toastOptions={{
        duration: 2500,
        classNames: {
          toast: '!bg-surface-3 !border !border-border !text-text !rounded-lg !text-body !font-sans !shadow-[0_8px_24px_rgb(0_0_0/0.4)]',
          description: '!text-text-muted',
          actionButton: '!bg-text !text-bg !font-medium',
        },
      }}
    />
  )
  const openNote = platform.openNote
  return (
    <PlatformProvider platform={platform}>
      <NoteHostProvider host={openNote ? { openLabel: 'Open in Obsidian', open: openNote } : null}>
        <HabitStoreProvider repository={repository} subscribe={subscribe}>
          <MemoryRouter initialEntries={[initialPath]}>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/habits/:habitId" element={<HabitDetails />} />
              <Route path="/habits/:habitId/notes" element={<HabitDetails />} />
              <Route path="/habits/:habitId/notes/:noteId" element={<HabitDetails />} />
              <Route path="/archive" element={<Archive />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </MemoryRouter>
          {platform.portalContainer ? createPortal(toaster, platform.portalContainer) : toaster}
        </HabitStoreProvider>
      </NoteHostProvider>
    </PlatformProvider>
  )
}
