import { useState, useRef, useEffect } from 'react'
import { cn } from '../../lib/cn'

// Dropdown dùng chung — trừu tượng hoá pattern outside-click/Escape đã lặp lại
// ở UserMenu (Topbar) và NotificationBell. trigger/children nhận render-prop { open, setOpen }/{ close }.
export default function Dropdown({ trigger, children, align = 'right', className = '', menuClassName = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div className={cn('relative', className)} ref={ref}>
      {typeof trigger === 'function' ? (
        trigger({ open, setOpen })
      ) : (
        <button onClick={() => setOpen(v => !v)}>{trigger}</button>
      )}

      {open && (
        <div
          className={cn(
            'absolute top-full mt-2 min-w-[200px] bg-white border border-border rounded-2xl shadow-card z-dropdown overflow-hidden animate-slideUp',
            align === 'right' ? 'right-0' : 'left-0',
            menuClassName,
          )}
        >
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  )
}

Dropdown.Item = function DropdownItem({ icon: Icon, danger = false, className = '', children, ...props }) {
  return (
    <button
      className={cn(
        'w-full flex items-center gap-2.5 px-4 h-10 text-left text-[14px] font-medium transition-colors',
        danger ? 'text-cred hover:bg-rose-50' : 'text-text hover:bg-surface2',
        className,
      )}
      {...props}
    >
      {Icon && <Icon size={15} strokeWidth={2} />}
      {children}
    </button>
  )
}

Dropdown.Divider = function DropdownDivider() {
  return <div className="h-px bg-border" />
}
