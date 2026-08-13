/** Unwrap pedal math checks. node scripts/sim-pedals.mjs */
const HALF = 32768
const SPAN = 65536
const ARM = 800

function wrappedDelta(from, to) {
  let d = to - from
  if (d > HALF) d -= SPAN
  if (d < -HALF) d += SPAN
  return d
}

function run(seq, dir = 1) {
  const cal = {
    rest: 32768,
    dir,
    unwrap: 32768,
    lastRaw: 32768,
    position: 0,
  }
  const out = []
  for (const raw of seq) {
    cal.unwrap += wrappedDelta(cal.lastRaw, raw)
    cal.lastRaw = raw
    if (Math.abs(raw - cal.rest) < ARM) {
      cal.unwrap = cal.rest
      cal.position = 0
      out.push(0)
      continue
    }
    const eng =
      dir > 0
        ? Math.max(0, cal.unwrap - cal.rest)
        : Math.max(0, cal.rest - cal.unwrap)
    cal.position = eng
    out.push(eng)
  }
  return out
}

let ok = true
{
  console.log('press through wrap climbs toward 64k')
  const seq = [40000, 55000, 65000, 2000, 10000, 20000, 30000]
  const es = run(seq, 1)
  console.log(es)
  for (let i = 1; i < es.length; i++) {
    if (es[i] + 1 < es[i - 1]) {
      ok = false
      console.log('FAIL dropped', i)
    }
  }
  if (es[es.length - 1] < 60000) {
    ok = false
    console.log('FAIL expected ~64k class', es[es.length - 1])
  }
}
{
  console.log('near rest always zeros (even after fake seed)')
  const cal = {
    rest: 32768,
    dir: 1,
    unwrap: 32768 + 65500,
    lastRaw: 5000,
    position: 65500,
  }
  // simulate released raw near rest
  const raw = 32768
  cal.unwrap += wrappedDelta(cal.lastRaw, raw)
  let eng = 0
  if (Math.abs(raw - cal.rest) < ARM) eng = 0
  else eng = Math.max(0, cal.unwrap - cal.rest)
  console.log('after rest sample', eng)
  if (eng !== 0) {
    ok = false
    console.log('FAIL stuck after rest')
  }
}
console.log(ok ? 'ALL OK' : 'FAILED')
process.exit(ok ? 0 : 1)
