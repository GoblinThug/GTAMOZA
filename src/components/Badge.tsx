import type { ReactNode } from 'react'

type Tone = 'default' | 'success' | 'warning' | 'error' | 'accent'

type Props = {
  children: ReactNode
  tone?: Tone
  className?: string
}

export function Badge({ children, tone = 'default', className = '' }: Props) {
  const toneClass = tone === 'default' ? '' : `badge-${tone}`
  return <span className={`badge ${toneClass} ${className}`.trim()}>{children}</span>
}
