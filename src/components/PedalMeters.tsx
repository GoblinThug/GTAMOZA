type PedalMetersProps = {
  throttle: number
  brake: number
  clutch: number
  /** Unwrap engagement counts (~0..64000) — used for fill if calibrated value is low. */
  throttleRaw?: number
  brakeRaw?: number
  clutchRaw?: number
  labels: { throttle: string; brake: string; clutch: string }
  connected?: boolean
}

const RAW_FULL = 64_000

function PedalBar({
  value,
  raw,
  label,
  tone,
}: {
  value: number
  raw: number
  label: string
  tone: 'throttle' | 'brake' | 'clutch'
}) {
  const force = Math.max(0, Math.round(raw))
  const fillPct = Math.max(
    0,
    Math.min(100, Math.round(Math.max(value, force / RAW_FULL) * 100)),
  )
  return (
    <div className="pedal-col" data-tone={tone}>
      <div className="pedal-value" aria-label={`${label} ${fillPct}%`}>
        {fillPct}%
      </div>
      <div className="pedal-track">
        <div className="pedal-fill" style={{ height: `${fillPct}%` }} />
        <div className="pedal-ticks" aria-hidden />
      </div>
      <div className="pedal-label">{label}</div>
    </div>
  )
}

/** Vertical pedal travel meters (throttle / brake / clutch). */
export function PedalMeters({
  throttle,
  brake,
  clutch,
  throttleRaw = 0,
  brakeRaw = 0,
  clutchRaw = 0,
  labels,
  connected = false,
}: PedalMetersProps) {
  return (
    <div className="pedal-meters" data-connected={connected ? 'true' : 'false'}>
      <PedalBar
        value={throttle}
        raw={throttleRaw}
        label={labels.throttle}
        tone="throttle"
      />
      <PedalBar value={brake} raw={brakeRaw} label={labels.brake} tone="brake" />
      <PedalBar
        value={clutch}
        raw={clutchRaw}
        label={labels.clutch}
        tone="clutch"
      />
    </div>
  )
}
