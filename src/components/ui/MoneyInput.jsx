import { useState, useEffect } from 'react'
import { parseVNDInput, formatMoneyLive } from '../../lib/formatters'

export default function MoneyInput({ value, onChange, placeholder = '0', className = '', disabled = false }) {
  const [display, setDisplay] = useState(value ? formatMoneyLive(value) : '')

  useEffect(() => {
    setDisplay(value ? formatMoneyLive(value) : '')
  }, [value])

  function handleInput(e) {
    const raw = e.target.value
    const formatted = formatMoneyLive(raw)
    setDisplay(formatted)
    onChange(parseVNDInput(raw))
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleInput}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete="off"
      className={`input-money ${className}`}
      onFocus={e => e.target.select()}
    />
  )
}
