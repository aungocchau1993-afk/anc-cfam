import { X } from 'lucide-react'
import ModalOverlay from './ModalOverlay'
import { cn } from '../../lib/cn'

const SIZE_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

// Modal dùng chung: build trên ModalOverlay sẵn có (Escape + click-outside để đóng).
export default function Modal({
  open = true,
  onClose,
  title,
  icon: Icon,
  size = 'md',
  footer,
  children,
  className = '',
}) {
  if (!open) return null
  return (
    <ModalOverlay onClose={onClose}>
      <div
        className={cn(
          'bg-surface border border-border rounded-2xl w-full shadow-cardHover overflow-hidden animate-scaleIn',
          SIZE_CLASS[size] ?? SIZE_CLASS.md,
          className,
        )}
      >
        {(title || onClose) && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5 min-w-0">
              {Icon && <Icon size={18} strokeWidth={2} className="text-cblue shrink-0" />}
              <div className="font-bold text-[16px] text-text truncate">{title}</div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors flex items-center justify-center shrink-0"
              >
                <X size={15} strokeWidth={2.2} />
              </button>
            )}
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && <div className="px-5 pb-5 flex items-center justify-end gap-2.5">{footer}</div>}
      </div>
    </ModalOverlay>
  )
}
