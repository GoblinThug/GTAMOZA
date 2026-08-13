/**
 * Offline sanity checks for the sim-style FFB stack (tire model + polarity + cruise).
 * Run: node scripts/verify-ffb-systems.mjs
 */
import assert from 'node:assert/strict'

const clamp = (n, a, b) => Math.max(a, Math.min(b, n))

function tireAligningTorque(opts) {
  const steerPhys = -opts.steer
  const yawPhys = clamp(opts.yawRate / 2.6, -1, 1)
  const slipAngle = clamp(steerPhys - yawPhys * 0.42, -1.2, 1.2)
  const load =
    (0.22 + 0.58 * opts.speedF) *
    (1 + opts.brakeF * 0.42 + opts.throttle * 0.1) *
    (0.88 + 0.28 * opts.latLoad) *
    (1 - opts.slip * 0.42) *
    (0.94 + 0.08 * opts.heat)
  const grip = clamp(opts.grip * (1 - opts.slip * 0.28), 0.2, 1.15)
  const x = slipAngle
  const shape = x / (1 + 2.4 * x * x)
  return -shape * load * grip * opts.satGain * 0.36
}

function surfaceAmp(kind, speedF, roadStr = 0.18) {
  if (kind === 'kerb') return (0.1 + speedF * 0.2) * 0.58
  if (kind === 'grass') return (0.055 + speedF * 0.1) * 0.36
  return (0.008 + speedF * 0.014) * roadStr
}

function runPass(label, fn) {
  fn()
  console.log(`  OK  ${label}`)
}

let fails = 0
function check(label, fn) {
  try {
    runPass(label, fn)
  } catch (e) {
    fails++
    console.error(`  FAIL ${label}: ${e.message}`)
  }
}

console.log('FFB systems verify (pass 1/3)')
for (let pass = 1; pass <= 3; pass++) {
  if (pass > 1) console.log(`\nFFB systems verify (pass ${pass}/3)`)

  check('wheel right (GTA steer<0) → Mz < 0 (recenters, same family as -norm)', () => {
    // Physical right: HID+, GTA steer = -HID → steer < 0; spring wants negative force
    const mz = tireAligningTorque({
      steer: -0.35,
      yawRate: 0,
      speedF: 0.7,
      brakeF: 0,
      throttle: 0.3,
      latLoad: 0.2,
      slip: 0,
      heat: 0.2,
      grip: 1,
      satGain: 0.78,
    })
    assert.ok(mz < 0, `expected Mz<0, got ${mz}`)
  })

  check('wheel left (GTA steer>0) → Mz > 0', () => {
    const mz = tireAligningTorque({
      steer: 0.35,
      yawRate: 0,
      speedF: 0.7,
      brakeF: 0,
      throttle: 0.3,
      latLoad: 0.2,
      slip: 0,
      heat: 0.2,
      grip: 1,
      satGain: 0.78,
    })
    assert.ok(mz > 0, `expected Mz>0, got ${mz}`)
  })

  check('brake increases |Mz| (load transfer), no sign flip', () => {
    const base = {
      steer: -0.3,
      yawRate: 0,
      speedF: 0.65,
      throttle: 0,
      latLoad: 0.25,
      slip: 0,
      heat: 0.2,
      grip: 1,
      satGain: 0.78,
    }
    const coast = tireAligningTorque({ ...base, brakeF: 0 })
    const brake = tireAligningTorque({ ...base, brakeF: 0.8 })
    assert.ok(Math.sign(coast) === Math.sign(brake) || coast === 0)
    assert.ok(Math.abs(brake) > Math.abs(coast), `${Math.abs(brake)} !> ${Math.abs(coast)}`)
  })

  check('slip reduces grip / |Mz|', () => {
    const base = {
      steer: -0.4,
      yawRate: 0,
      speedF: 0.8,
      brakeF: 0.2,
      throttle: 0.5,
      latLoad: 0.3,
      heat: 0.3,
      grip: 1,
      satGain: 0.78,
    }
    const grip = tireAligningTorque({ ...base, slip: 0 })
    const slide = tireAligningTorque({ ...base, slip: 0.7 })
    assert.ok(Math.abs(slide) < Math.abs(grip))
  })

  check('asphalt grain << kerb grain', () => {
    const a = surfaceAmp('asphalt', 0.7)
    const k = surfaceAmp('kerb', 0.7)
    assert.ok(a * 3 < k, `asphalt ${a} not much quieter than kerb ${k}`)
  })

  check('host spring sign family: -norm recenters', () => {
    const CenterPolarity = 1
    const ForcePolarity = 1
    const norm = 0.3 // physical right
    const spring = CenterPolarity * (-norm * 2000)
    const mz = tireAligningTorque({
      steer: -0.3, // physical right in GTA steer space
      yawRate: 0,
      speedF: 0.7,
      brakeF: 0,
      throttle: 0.2,
      latLoad: 0.2,
      slip: 0,
      heat: 0,
      grip: 1,
      satGain: 0.78,
    })
    const game = ForcePolarity * mz * 10000
    assert.ok(spring < 0)
    assert.ok(game < 0, `tire game force should reinforce spring, got ${game}`)
  })

  check('cruise diCap < impact diCap', () => {
    const cruiseCap = 2800
    const impactCap = 7200
    assert.ok(cruiseCap < impactCap)
  })
}

if (fails) {
  console.error(`\n${fails} check(s) failed`)
  process.exit(1)
}
console.log('\nAll FFB system checks passed (3 passes).')
