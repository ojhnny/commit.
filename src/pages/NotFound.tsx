import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Page } from '@/components/layout/Page'
import { EmptyState } from '@/components/layout/StateViews'

export function NotFound() {
  return (
    <Page className="pt-16">
      <EmptyState
        title="Page not found"
        body="There's nothing at this address."
        action={
          <Button asChild variant="primary">
            <Link to="/">Back to habits</Link>
          </Button>
        }
      />
    </Page>
  )
}
