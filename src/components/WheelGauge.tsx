import { useEffect, useRef } from 'react'

type WheelGaugeProps = {
  angle: number
  maxAngle?: number
  torque?: number
  maxTorque?: number
  connected?: boolean
}

const CX = 120
const CY = 120
const R_TRAVEL = 92
const R_RING = 68
/** Compact dial span each side of center. */
const DIAL_SPAN = 110

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/** 0° = top, positive = clockwise (+). */
function polar(r: number, dialDeg: number) {
  const rad = (dialDeg * Math.PI) / 180
  return {
    x: CX + r * Math.sin(rad),
    y: CY - r * Math.cos(rad),
  }
}

function arcPath(r: number, fromDeg: number, toDeg: number): string {
  if (Math.abs(toDeg - fromDeg) < 0.04) return ''
  const start = polar(r, fromDeg)
  const end = polar(r, toDeg)
  const delta = toDeg - fromDeg
  const large = Math.abs(delta) > 180 ? 1 : 0
  const sweep = delta >= 0 ? 1 : 0
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

function pointerPoints(dialDeg: number): string {
  const tip = polar(R_TRAVEL + 7, dialDeg)
  const a = polar(R_TRAVEL - 5, dialDeg - 4.2)
  const b = polar(R_TRAVEL - 5, dialDeg + 4.2)
  return `${tip.x},${tip.y} ${a.x},${a.y} ${b.x},${b.y}`
}

/** Clean circular steering dial — thin needle + wide travel arc. */
export function WheelGauge({
  angle,
  maxAngle = 450,
  connected = false,
}: WheelGaugeProps) {
  const targetRef = useRef(angle)
  const displayRef = useRef(angle)
  const maxRef = useRef(maxAngle)

  const valueRef = useRef<HTMLSpanElement>(null)
  const travelRef = useRef<SVGPathElement>(null)
  const tipRef = useRef<SVGPolygonElement>(null)
  const wheelRef = useRef<SVGGElement>(null)
  const signRef = useRef<HTMLSpanElement>(null)
  const ringGlowRef = useRef<SVGCircleElement>(null)

  targetRef.current = clamp(angle, -maxAngle, maxAngle)
  maxRef.current = Math.max(1, maxAngle)

  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const alpha = 1 - Math.exp(-28 * dt)

      displayRef.current += (targetRef.current - displayRef.current) * alpha

      const shown = displayRef.current
      const max = maxRef.current
      const ratio = clamp(shown / max, -1, 1)
      // Outer wide dial = lock travel (− / + from center)
      const lockDial = ratio * DIAL_SPAN

      if (valueRef.current) {
        valueRef.current.textContent = `${shown.toFixed(1)}`
      }
      if (signRef.current) {
        const absPct = Math.round(Math.abs(ratio) * 100)
        if (absPct < 1) {
          signRef.current.textContent = 'CENTER'
          signRef.current.dataset.side = 'center'
        } else if (ratio > 0) {
          signRef.current.textContent = `+${absPct}%`
          signRef.current.dataset.side = 'right'
        } else {
          signRef.current.textContent = `−${absPct}%`
          signRef.current.dataset.side = 'left'
        }
      }
      if (travelRef.current) {
        const d = arcPath(R_TRAVEL, 0, lockDial)
        travelRef.current.setAttribute('d', d || 'M0 0')
        travelRef.current.style.opacity = d ? '1' : '0'
        travelRef.current.setAttribute(
          'stroke',
          ratio >= 0 ? 'url(#wg-arc-right)' : 'url(#wg-arc-left)',
        )
      }
      if (tipRef.current) {
        // Tip rides the wide lock dial (end of travel arc)
        tipRef.current.setAttribute('points', pointerPoints(lockDial))
      }
      if (wheelRef.current) {
        // Inner circle rotates with real wheel angle (multi-turn)
        wheelRef.current.setAttribute(
          'transform',
          `rotate(${shown.toFixed(2)} ${CX} ${CY})`,
        )
      }
      if (ringGlowRef.current) {
        const side =
          Math.abs(ratio) < 0.01 ? 'center' : ratio > 0 ? 'right' : 'left'
        ringGlowRef.current.dataset.side = side
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Horseshoe through top: ±DIAL_SPAN spans 220° → large-arc = 1
  const trackStart = polar(R_TRAVEL, -DIAL_SPAN)
  const trackEnd = polar(R_TRAVEL, DIAL_SPAN)
  const trackPath = `M ${trackStart.x.toFixed(2)} ${trackStart.y.toFixed(2)} A ${R_TRAVEL} ${R_TRAVEL} 0 1 1 ${trackEnd.x.toFixed(2)} ${trackEnd.y.toFixed(2)}`

  const ticks = [-1, -0.5, 0, 0.5, 1].map((t) => {
    const d = t * DIAL_SPAN
    const outer = polar(R_TRAVEL + 2, d)
    const inner = polar(t === 0 ? R_TRAVEL - 11 : R_TRAVEL - 7, d)
    return { t, outer, inner }
  })

  return (
    <div className="wheel-gauge" data-connected={connected ? 'true' : 'false'}>
      <div className="wheel-gauge-ring">
        <svg viewBox="0 0 240 240" className="wheel-gauge-svg" aria-hidden>
          <defs>
            <linearGradient id="wg-arc-right" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="wg-arc-left" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="var(--info)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--info)" stopOpacity="1" />
            </linearGradient>
            <radialGradient id="wg-disc" cx="38%" cy="32%" r="70%">
              <stop offset="0%" stopColor="#2a303c" />
              <stop offset="55%" stopColor="#161a22" />
              <stop offset="100%" stopColor="#0c0e13" />
            </radialGradient>
            <filter id="wg-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Soft outer halo */}
          <circle
            cx={CX}
            cy={CY}
            r="108"
            fill="none"
            stroke="color-mix(in srgb, var(--border) 55%, transparent)"
            strokeWidth="1"
          />

          {/* Wide travel track */}
          <path
            d={trackPath}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            className="wheel-gauge-track"
          />
          <path
            ref={travelRef}
            d="M0 0"
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            stroke="url(#wg-arc-right)"
            className="wheel-gauge-travel"
            filter="url(#wg-glow)"
            opacity="0"
          />

          {ticks.map(({ t, outer, inner }) => (
            <line
              key={t}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              className={
                t === 0 ? 'wheel-gauge-tick wheel-gauge-tick-center' : 'wheel-gauge-tick'
              }
            />
          ))}

          {/* Inner disc — rotates with real wheel angle */}
          <circle
            ref={ringGlowRef}
            cx={CX}
            cy={CY}
            r={R_RING}
            className="wheel-gauge-disc"
            data-side="center"
          />
          <circle
            cx={CX}
            cy={CY}
            r={R_RING - 1}
            fill="url(#wg-disc)"
            stroke="color-mix(in srgb, var(--border-strong) 80%, transparent)"
            strokeWidth="1.5"
          />
          <circle
            cx={CX}
            cy={CY}
            r="22"
            fill="none"
            stroke="color-mix(in srgb, var(--border) 70%, transparent)"
            strokeWidth="1"
          />
          <circle cx={CX} cy={CY} r="5" className="wheel-gauge-core" />

          <g ref={wheelRef}>
            {/* Fixed top mark on the rotating disc = physical wheel orientation */}
            <line
              x1={CX}
              y1={CY - 18}
              x2={CX}
              y2={CY - R_RING + 8}
              className="wheel-gauge-needle"
            />
            <circle
              cx={CX}
              cy={CY - R_RING + 2}
              r="6"
              className="wheel-gauge-bead"
            />
          </g>

          {/* Narrow tip on outer dial — lock travel end */}
          <polygon
            ref={tipRef}
            points={pointerPoints(0)}
            className="wheel-gauge-pointer"
          />
        </svg>
      </div>

      <div className="wheel-gauge-readout">
        <span className="wheel-gauge-value">
          <span ref={valueRef}>0.0</span>
          <span className="wheel-gauge-unit">°</span>
        </span>
        <span ref={signRef} className="wheel-gauge-travel-label" data-side="center">
          CENTER
        </span>
        <span className="wheel-gauge-label">STEERING</span>
      </div>
    </div>
  )
}
