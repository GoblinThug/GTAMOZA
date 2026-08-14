import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/useI18n'

/** Map KeyboardEvent → WinForms Keys name used by the GTA plugin. */
export function eventToWinFormsKey(e: KeyboardEvent): string | null {
  const code = e.code
  if (code.startsWith('Key') && code.length === 4) return code.slice(3)
  if (code.startsWith('Digit') && code.length === 6) return `D${code.slice(5)}`
  if (code.startsWith('F') && /^F([1-9]|1[0-2])$/.test(code)) return code

  const map: Record<string, string> = {
    Space: 'Space',
    Enter: 'Enter',
    Escape: 'Escape',
    Tab: 'Tab',
    Backspace: 'Back',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Numpad0: 'NumPad0',
    Numpad1: 'NumPad1',
    Numpad2: 'NumPad2',
    Numpad3: 'NumPad3',
    Numpad4: 'NumPad4',
    Numpad5: 'NumPad5',
    Numpad6: 'NumPad6',
    Numpad7: 'NumPad7',
    Numpad8: 'NumPad8',
    Numpad9: 'NumPad9',
    Equal: 'Oemplus',
    Minus: 'OemMinus',
    NumpadAdd: 'Add',
    NumpadSubtract: 'Subtract',
  }
  return map[code] ?? null
}

const HOTKEY_LABELS: Record<string, string> = {
  Oemplus: '=',
  OemMinus: '-',
  Add: 'Num+',
  Subtract: 'Num-',
}

type Props = {
  value: string
  disabled?: boolean
  onChange: (hotkey: string) => void
}

export function HotkeyCapture({ value, disabled, onChange }: Props) {
  const { t } = useI18n()
  const [listening, setListening] = useState(false)

  useEffect(() => {
    if (!listening) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setListening(false)
        return
      }
      const name = eventToWinFormsKey(e)
      if (!name) return
      onChange(name)
      setListening(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [listening, onChange])

  return (
    <button
      type="button"
      className="hotkey-btn"
      data-listening={listening}
      disabled={disabled}
      onClick={() => {
        if (!disabled) setListening(true)
      }}
    >
      {listening ? t('cheats.pressKey') : HOTKEY_LABELS[value] || value || '—'}
    </button>
  )
}
