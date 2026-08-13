import { useEffect, useMemo, useRef } from 'react'

type Props = {
  values: number[]
  label: string
  unit?: string
  min?: number
  max?: number
}

export function TelemetryChart({ values, label, unit, min, max }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latest = values[values.length - 1] ?? 0

  const bounds = useMemo(() => {
    if (typeof min === 'number' && typeof max === 'number') return { min, max }
    const lo = Math.min(...values, 0)
    const hi = Math.max(...values, 1)
    const pad = (hi - lo) * 0.15 || 1
    return { min: lo - pad, max: hi + pad }
  }, [values, min, max])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const styles = getComputedStyle(document.documentElement)
    const border = styles.getPropertyValue('--border').trim()
    const line = styles.getPropertyValue('--chart-line').trim()
    const fill = styles.getPropertyValue('--chart-fill').trim()
    const text = styles.getPropertyValue('--text-muted').trim()

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = 'transparent'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = border
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    if (values.length < 2) return

    const range = bounds.max - bounds.min || 1
    const stepX = width / Math.max(values.length - 1, 1)

    const points = values.map((v, i) => {
      const x = i * stepX
      const y = height - ((v - bounds.min) / range) * height
      return { x, y }
    })

    ctx.beginPath()
    ctx.moveTo(points[0].x, height)
    for (const p of points) ctx.lineTo(p.x, p.y)
    ctx.lineTo(points[points.length - 1].x, height)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
    ctx.strokeStyle = line
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = text
    ctx.font = '11px Segoe UI, sans-serif'
    ctx.fillText(label, 10, 16)
  }, [values, bounds, label])

  return (
    <div>
      <div className="field-row" style={{ marginBottom: 8 }}>
        <span className="field-label">{label}</span>
        <span className="field-value">
          {latest.toFixed(1)}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <canvas ref={canvasRef} className="chart" />
    </div>
  )
}
