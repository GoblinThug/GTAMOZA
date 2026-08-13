type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, description, disabled }: Props) {
  if (!label) {
    return (
      <button
        type="button"
        className="toggle"
        role="switch"
        aria-checked={checked}
        data-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-thumb" />
      </button>
    )
  }

  return (
    <div className="setting-field setting-field-inline">
      <div className="setting-field-copy">
        <div className="setting-field-top">
          <span className="setting-field-label">{label}</span>
        </div>
        {description ? <p className="setting-field-desc">{description}</p> : null}
      </div>
      <div className="setting-field-control">
        <button
          type="button"
          className="toggle"
          role="switch"
          aria-checked={checked}
          data-checked={checked}
          disabled={disabled}
          aria-label={label}
          onClick={() => onChange(!checked)}
        >
          <span className="toggle-thumb" />
        </button>
      </div>
    </div>
  )
}
