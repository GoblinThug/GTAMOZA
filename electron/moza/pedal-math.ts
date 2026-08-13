/**
 * Linear one-way pedals (MOZA R5 HID).
 *
 * Rest ≈ 32768. A full press walks to one rail then UINT16-wraps onto the
 * other side — same press, continuous travel. We unwrap the axis like an
 * encoder so the count climbs ~0 → 64k through the wrap (not abs-from-center).
 *
 * Press  → number / bar only go UP
 * Release → only go DOWN
 * Wrap mid-press → keeps rising (no dive)
 */

export const PEDAL_ARM = 800
/** Ignore residual unwrap noise at rest. */
export const PEDAL_REST_NOISE = 64
export const PEDAL_DEADZONE = 0.008
export const PEDAL_PROVISIONAL_FULL = 64_000
export const PEDAL_LOCK_MIN_TRAVEL = 10_000
export const PEDAL_ARM_TRAVEL = PEDAL_ARM
export const PEDAL_AXIS_SPAN = 65_536
const HALF = 32_768

export type PedalAxisCal = {
  rest: number
  extreme: number
  maxTravel: number
  dir: 1 | -1
  dirKnown: boolean
  samples: number
  primed: boolean
  floorLocked: boolean
  /** Continuous unwrapped axis (encoder-style). */
  unwrap: number
  lastRaw: number
  hasLastRaw: boolean
  /** Live engagement counts from rest along press dir (0 = released). */
  position: number
  lastEngagement: number
}

export function freshPedalCal(rest = HALF): PedalAxisCal {
  return {
    rest,
    extreme: rest,
    maxTravel: 0,
    dir: 1,
    dirKnown: false,
    samples: 0,
    primed: false,
    floorLocked: false,
    unwrap: rest,
    lastRaw: rest,
    hasLastRaw: false,
    position: 0,
    lastEngagement: 0,
  }
}

/** Shortest signed step from `from` → `to` on a uint16 circle. */
export function wrappedDelta(from: number, to: number): number {
  let d = to - from
  if (d > HALF) d -= PEDAL_AXIS_SPAN
  if (d < -HALF) d += PEDAL_AXIS_SPAN
  return d
}

/** Distance on the press side only (0 on the opposite / wrap side). */
export function directedTravel(raw: number, rest: number, dir: 1 | -1): number {
  if (dir < 0) return raw >= rest ? 0 : rest - raw
  return raw <= rest ? 0 : raw - rest
}

export function circularTravel(raw: number, rest: number, dir: 1 | -1): number {
  if (dir > 0) return (raw - rest + PEDAL_AXIS_SPAN) % PEDAL_AXIS_SPAN
  return (rest - raw + PEDAL_AXIS_SPAN) % PEDAL_AXIS_SPAN
}

export function scaleTravel(travel: number, denom: number, cap = 1): number {
  const d = Math.max(denom, PEDAL_ARM)
  let v = travel / d
  if (v < PEDAL_DEADZONE) return 0
  return Math.max(0, Math.min(cap, (v - PEDAL_DEADZONE) / (1 - PEDAL_DEADZONE)))
}

export function resetUnwrap(cal: PedalAxisCal, raw = cal.rest) {
  cal.unwrap = raw
  cal.lastRaw = raw
  cal.hasLastRaw = true
}

export function snapToRest(cal: PedalAxisCal, raw = cal.rest): number {
  cal.unwrap = cal.rest
  cal.lastRaw = raw
  cal.hasLastRaw = true
  cal.position = 0
  cal.lastEngagement = 0
  return 0
}

function engagementAlong(cal: PedalAxisCal): number {
  return cal.dir > 0
    ? Math.max(0, cal.unwrap - cal.rest)
    : Math.max(0, cal.rest - cal.unwrap)
}

/**
 * Continuous unwrap engagement (0 → ~64k through HID wrap).
 * Do NOT treat “raw moving toward rest on the far side” as release — that is
 * exactly the second half of a full press and was capping/jittering at ~32k.
 */
export function engagementFromRaw(raw: number, cal: PedalAxisCal): number {
  if (!cal.hasLastRaw) {
    resetUnwrap(cal, raw)
  } else {
    cal.unwrap += wrappedDelta(cal.lastRaw, raw)
    cal.lastRaw = raw
  }

  if (!cal.dirKnown) {
    cal.position = 0
    cal.lastEngagement = 0
    return 0
  }

  let eng = engagementAlong(cal)

  // True rest only — keep ~64k if HID aliased near center at full wrap press.
  if (Math.abs(raw - cal.rest) < PEDAL_ARM && eng < PEDAL_ARM * 2) {
    return snapToRest(cal, raw)
  }

  if (eng < PEDAL_REST_NOISE) {
    cal.position = 0
    cal.lastEngagement = 0
    return 0
  }

  // Clamp to one full turn — beyond that is noise, not a deeper press.
  if (eng > PEDAL_AXIS_SPAN - 1) eng = PEDAL_AXIS_SPAN - 1

  cal.position = eng
  cal.lastEngagement = eng
  return eng
}

export function normalizePedalSample(raw: number, cal: PedalAxisCal): number {
  if (!cal.dirKnown) {
    cal.lastEngagement = 0
    return 0
  }

  const travel = engagementFromRaw(raw, cal)
  if (travel < PEDAL_REST_NOISE) return 0

  if (!cal.floorLocked) {
    if (travel < PEDAL_ARM) return 0
    if (travel > cal.maxTravel) {
      cal.maxTravel = travel
      cal.extreme = raw
    }
    return scaleTravel(travel, PEDAL_PROVISIONAL_FULL, 0.99)
  }

  // Floor frozen at lock — deeper press stays ≤100%.
  return scaleTravel(travel, Math.max(cal.maxTravel, PEDAL_ARM), 1)
}

export function firstDirPeak(
  rest: number,
  minRaw: number,
  maxRaw: number,
  dir: 0 | 1 | -1,
): { extreme: number; dir: 1 | -1; travel: number } | null {
  if (dir === 1) {
    const highTravel = Math.max(0, maxRaw - rest)
    const wrapped =
      minRaw < rest - PEDAL_ARM && maxRaw > rest + 10_000
        ? circularTravel(minRaw, rest, 1)
        : 0
    const travel = Math.max(highTravel, wrapped)
    const extreme = wrapped > highTravel ? minRaw : maxRaw
    return { extreme, dir: 1, travel }
  }
  if (dir === -1) {
    const lowTravel = Math.max(0, rest - minRaw)
    const wrapped =
      maxRaw > rest + PEDAL_ARM && minRaw < rest - 10_000
        ? circularTravel(maxRaw, rest, -1)
        : 0
    const travel = Math.max(lowTravel, wrapped)
    const extreme = wrapped > lowTravel ? maxRaw : minRaw
    return { extreme, dir: -1, travel }
  }
  return null
}

export function applyFloorToCal(
  cal: PedalAxisCal,
  point: {
    rest: number
    extreme: number
    dir: 1 | -1
    maxTravel?: number
  },
) {
  cal.rest = point.rest
  cal.extreme = point.extreme
  cal.dir = point.dir
  cal.dirKnown = true
  const linear = Math.abs(point.extreme - point.rest)
  const fromExtreme =
    linear < 800
      ? directedTravel(point.extreme, point.rest, point.dir)
      : Math.max(
          circularTravel(point.extreme, point.rest, point.dir),
          directedTravel(point.extreme, point.rest, point.dir),
        )
  cal.maxTravel = Math.max(PEDAL_ARM, point.maxTravel ?? 0, fromExtreme)
  cal.primed = true
  cal.floorLocked = true
  cal.samples = 40
  snapToRest(cal)
}

export function learnDirFromDelta(delta: number): 1 | -1 {
  return delta > 0 ? 1 : -1
}

/** Keep 100% after locking while the pedal is still floored. */
export function seedFloorEngagement(
  cal: PedalAxisCal,
  travel: number,
  raw?: number,
) {
  const t = Math.max(travel, cal.maxTravel, PEDAL_ARM)
  cal.maxTravel = t
  if (raw == null) return
  cal.position = t
  cal.lastEngagement = t
  cal.hasLastRaw = true
  cal.lastRaw = raw
  cal.unwrap = cal.dir > 0 ? cal.rest + t : cal.rest - t
}
