/**
 * Probe MOZA serial pedal outputs on COM3 (boxflat protocol).
 * Press pedals while this runs to see live values.
 */
import { SerialPort } from 'serialport'

const START = 0x7e
const MAGIC = 13
const PEDALS_ID = 25 // RJ12 pedals through base
const MAIN_ID = 18
const BASE_ID = 19

function checksum(bytes) {
  let v = MAGIC
  for (const b of bytes) v += b
  return v & 0xff
}

function readCmd(deviceId, group, cmdId, valueBytes = 2, value = 1) {
  const idBytes = Buffer.from([cmdId])
  const payload = Buffer.alloc(valueBytes)
  payload.writeUIntBE(value, 0, valueBytes)
  const length = idBytes.length + payload.length
  const body = Buffer.concat([
    Buffer.from([START, length, group, deviceId]),
    idBytes,
    payload,
  ])
  return Buffer.concat([body, Buffer.from([checksum(body)])])
}

function parseFrames(buf) {
  const out = []
  let i = 0
  while (i < buf.length) {
    if (buf[i] !== START) {
      i++
      continue
    }
    if (i + 1 >= buf.length) break
    const len = buf[i + 1]
    if (len < 2 || len > 11) {
      i++
      continue
    }
    const total = 2 + len + 2 // start+len + (group+dev+payload) — wait boxflat reads len+2 after start+len
    // Full frame: start, len, then len+2 bytes (group, device, payload[len], NO checksum in queue)
    // Actually wire has checksum after. Looking at prepare: start,len,group,dev,id...,payload,checksum
    // Wire size = 2 + 1 + 1 + len + 1 = len + 5
    const wire = len + 5
    if (i + wire > buf.length) break
    const frame = buf.subarray(i, i + wire)
    const group = frame[2]
    const device = frame[3]
    const payload = frame.subarray(4, 4 + len)
    const cs = frame[4 + len]
    out.push({ group, device, payload: Buffer.from(payload), cs, frame: Buffer.from(frame) })
    i += wire
  }
  return out
}

function nibbleSwap(b) {
  return ((b & 0x0f) << 4) | ((b & 0xf0) >> 4)
}

const portPath = process.argv[2] || 'COM3'
const port = new SerialPort({ path: portPath, baudRate: 115200, autoOpen: false })

await new Promise((resolve, reject) => {
  port.open((err) => (err ? reject(err) : resolve()))
})
console.log('opened', portPath)

let rx = Buffer.alloc(0)
port.on('data', (chunk) => {
  rx = Buffer.concat([rx, chunk])
  // keep last 4k
  if (rx.length > 4096) rx = rx.subarray(rx.length - 4096)
})

const cmds = [
  { name: 'throttle', id: 1 },
  { name: 'brake', id: 2 },
  { name: 'clutch', id: 3 },
]

const deviceIds = [PEDALS_ID, MAIN_ID, BASE_ID]
let tick = 0

const timer = setInterval(() => {
  tick++
  const deviceId = deviceIds[tick % deviceIds.length]
  for (const c of cmds) {
    // group 37 = throttle/brake/clutch-output
    const msg = readCmd(deviceId, 37, c.id, 2, 1)
    port.write(msg)
  }
  // also try group 35 throttle-min style reads occasionally
  if (tick % 5 === 0) {
    port.write(readCmd(deviceId, 35, 2, 2, 1)) // throttle-min
    port.write(readCmd(deviceId, 35, 3, 2, 1)) // throttle-max
  }

  const frames = parseFrames(rx)
  if (frames.length) {
    const latest = frames.slice(-12)
    for (const f of latest) {
      const group = f.group & 0x7f
      const dev = nibbleSwap(f.device)
      if (group === 37 && f.payload.length >= 3) {
        const cmd = f.payload[0]
        const val = f.payload.readUIntBE(1, 2)
        const name = cmd === 1 ? 'THR' : cmd === 2 ? 'BRK' : cmd === 3 ? 'CLT' : `c${cmd}`
        console.log(
          `t=${tick} devReq=? respDev=${dev} ${name}=${val} raw=${f.frame.toString('hex')}`,
        )
      } else if (tick <= 3 || tick % 10 === 0) {
        console.log(
          `t=${tick} group=${group} respDev=${dev} payload=${f.payload.toString('hex')} frame=${f.frame.toString('hex')}`,
        )
      }
    }
    // drop processed
    const last = frames[frames.length - 1]
    const idx = rx.indexOf(last.frame)
    if (idx >= 0) rx = rx.subarray(idx + last.frame.length)
  } else if (tick <= 5) {
    console.log('t=', tick, 'no frames yet, rx=', rx.toString('hex').slice(0, 80))
  }
}, 80)

setTimeout(() => {
  clearInterval(timer)
  port.close()
  console.log('done')
  process.exit(0)
}, 8000)
