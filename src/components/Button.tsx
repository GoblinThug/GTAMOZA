import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: Props) {
  const sizeClass = size === 'md' ? '' : `btn-${size}`
  return (
    <button className={`btn btn-${variant} ${sizeClass} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}
