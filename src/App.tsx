import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Dashboard } from '@/pages/Dashboard'
import { HabitDetails } from '@/pages/HabitDetails'
import { NotFound } from '@/pages/NotFound'
import type { HabitRepository } from '@/services/habitRepository'
import { HabitStoreProvider } from '@/state/HabitStore'

// Hash routing is used for static hosting where the server can't rewrite deep links.
const Router = ({ children }: { children: ReactNode }) =>
  import.meta.env.VITE_ROUTER === 'hash' ? <HashRouter>{children}</HashRouter> : <BrowserRouter>{children}</BrowserRouter>

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export function App({ repository }: { repository: HabitRepository }) {
  return (
    <HabitStoreProvider repository={repository}>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/habits/:habitId" element={<HabitDetails />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
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
    </HabitStoreProvider>
  )
}
