/** MOZA USB vendor ID (Gudsen). */
export const MOZA_VID = 0x346e

export type MozaModelInfo = {
  pid: number
  model: string
  name: string
  maxTorqueNm: number
}

/** Known wheelbase product IDs (incl. +0x10 firmware variants). */
export const MOZA_WHEELBASES: MozaModelInfo[] = [
  { pid: 0x0004, model: 'R5', name: 'MOZA R5 Base', maxTorqueNm: 5.5 },
  { pid: 0x0014, model: 'R5', name: 'MOZA R5 Base', maxTorqueNm: 5.5 },
  { pid: 0x0005, model: 'R3', name: 'MOZA R3 Base', maxTorqueNm: 3.9 },
  { pid: 0x0015, model: 'R3', name: 'MOZA R3 Base', maxTorqueNm: 3.9 },
  { pid: 0x0002, model: 'R9', name: 'MOZA R9 Base', maxTorqueNm: 9 },
  { pid: 0x0012, model: 'R9', name: 'MOZA R9 Base', maxTorqueNm: 9 },
  { pid: 0x0006, model: 'R12', name: 'MOZA R12 Base', maxTorqueNm: 12 },
  { pid: 0x0016, model: 'R12', name: 'MOZA R12 Base', maxTorqueNm: 12 },
  { pid: 0x0000, model: 'R16', name: 'MOZA R16 Base', maxTorqueNm: 16 },
  { pid: 0x0010, model: 'Compat', name: 'MOZA Wheel Base', maxTorqueNm: 5.5 },
]

export function resolveMozaBase(pid: number): MozaModelInfo | null {
  return MOZA_WHEELBASES.find((b) => b.pid === pid) ?? null
}

export function isMozaVendor(vendorId: number) {
  return vendorId === MOZA_VID
}
