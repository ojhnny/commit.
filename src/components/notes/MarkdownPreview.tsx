import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'

let hooked = false
function sanitizer() {
  if (!hooked) {
    // Links open outside the app and can't reach back into it.
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A' && node.getAttribute('href')) {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
    })
    hooked = true
  }
  return DOMPurify
}

export function MarkdownPreview({ source, className }: { source: string; className?: string }) {
  const html = useMemo(() => {
    // Task list checkboxes are rendered by marked as disabled inputs; keep them visible but read-only.
    const raw = marked.parse(source, { gfm: true, breaks: true, async: false })
    return sanitizer().sanitize(raw, { FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select', 'iframe'], FORBID_ATTR: ['style', 'id', 'name'] })
  }, [source])
  if (!source.trim()) return <p className={cn('text-body text-text-faint', className)}>Nothing to preview yet.</p>
  return <div className={cn('commit-prose', className)} dangerouslySetInnerHTML={{ __html: html }} />
}
