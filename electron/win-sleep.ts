/**
 * Sync sleep without spawning powershell/cmd (those flash conhost and hitch the UI).
 * Node allows Atomics.wait on the main thread.
 */
export function sleepSync(ms: number): void {
  const n = Math.max(0, Math.floor(ms))
  if (n <= 0) return
  try {
    const buf = new SharedArrayBuffer(4)
    const view = new Int32Array(buf)
    Atomics.wait(view, 0, 0, n)
  } catch {
    const until = Date.now() + n
    while (Date.now() < until) {
      /* spin fallback */
    }
  }
}
