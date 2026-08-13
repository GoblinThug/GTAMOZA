import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
}

export function Input({ label, hint, id, className = '', ...rest }: Props) {
  const inputId = id ?? rest.name
  return (
    <label className="field" htmlFor={inputId}>
      {label ? <span className="field-label">{label}</span> : null}
      <input id={inputId} className={`input ${className}`.trim()} {...rest} />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}
