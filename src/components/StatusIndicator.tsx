type Status = 'online' | 'offline' | 'warning' | 'error'

type Props = {
  status: Status
  label?: string
}

export function StatusIndicator({ status, label }: Props) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span className={`status-dot ${status}`} />
      {label ? <span>{label}</span> : null}
    </span>
  )
}
