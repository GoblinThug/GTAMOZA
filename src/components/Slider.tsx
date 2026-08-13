type Props = {
  label: string
  description?: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  disabled?: boolean
  onChange: (value: number) => void
  formatValue?: (value: number) => string
}

export function Slider({
  label,
  description,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit,
  disabled,
  onChange,
  formatValue,
}: Props) {
  const display = formatValue
    ? formatValue(value)
    : `${value}${unit ? ` ${unit}` : ''}`

  return (
    <div className={`setting-field setting-field-stack${disabled ? ' is-disabled' : ''}`}>
      <div className="setting-field-copy">
        <div className="setting-field-top">
          <span className="setting-field-label">{label}</span>
          <span className="setting-field-value">{display}</span>
        </div>
        {description ? <p className="setting-field-desc">{description}</p> : null}
      </div>
      <div className="setting-field-control">
        <input
          className="slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
      </div>
    </div>
  )
}
