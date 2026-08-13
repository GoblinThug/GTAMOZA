import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export type SelectOption = {
  value: string
  label: string
}

type Props = {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  label?: string
  disabled?: boolean
}

export function Select({ value, options, onChange, label, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className="field" ref={rootRef}>
      {label ? <span className="field-label">{label}</span> : null}
      <div className="select">
        <button
          type="button"
          className="select-trigger"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span>{selected?.label ?? 'Select…'}</span>
          <ChevronDown size={16} />
        </button>
        {open ? (
          <div className="select-menu" role="listbox">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className="select-option"
                role="option"
                data-selected={option.value === value}
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
