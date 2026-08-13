import type { ReactNode } from 'react'

type Props = {
  label: string
  description?: string
  value?: ReactNode
  children: ReactNode
  /** Layout: control on the right (toggle) or full-width below (slider) */
  layout?: 'stack' | 'inline'
}

export function SettingField({
  label,
  description,
  value,
  children,
  layout = 'stack',
}: Props) {
  return (
    <div className={`setting-field setting-field-${layout}`}>
      <div className="setting-field-copy">
        <div className="setting-field-top">
          <span className="setting-field-label">{label}</span>
          {value != null ? <span className="setting-field-value">{value}</span> : null}
        </div>
        {description ? <p className="setting-field-desc">{description}</p> : null}
      </div>
      <div className="setting-field-control">{children}</div>
    </div>
  )
}
