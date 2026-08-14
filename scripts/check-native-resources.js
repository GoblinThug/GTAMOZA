/**
 * Fail pack/dist if extraResources inputs are missing.
 * electron-builder silently omits empty extraResources folders.
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const required = [
  path.join(root, 'gta-mod', 'dist', 'GTAMOZA.dll'),
  path.join(root, 'tools', 'ffb-host', 'dist', 'gtamoza-ffb.exe'),
]

const missing = required.filter((p) => !fs.existsSync(p))
if (missing.length) {
  console.error('[check-native-resources] missing:')
  for (const p of missing) console.error('  -', p)
  console.error('Run npm run build:native first.')
  process.exit(1)
}

console.log('[check-native-resources] ok')
for (const p of required) {
  const st = fs.statSync(p)
  console.log(`  ${path.relative(root, p)}  ${st.size} bytes`)
}
