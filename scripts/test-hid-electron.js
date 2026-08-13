const path = require('path')
const { createRequire } = require('module')
const { app } = require('electron')

app.whenReady().then(() => {
  try {
    const r = createRequire(path.join(process.cwd(), 'package.json'))
    const h = r('node-hid')
    console.log('devices fn', typeof h.devices)
    const moza = h.devices().filter((d) => d.vendorId === 0x346e)
    console.log('moza', moza.map((d) => ({ product: d.product, pid: d.productId })))
  } catch (e) {
    console.error('FAIL', e)
  } finally {
    app.quit()
  }
})
