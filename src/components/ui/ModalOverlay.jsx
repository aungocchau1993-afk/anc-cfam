import { useEffect } from 'react'

/**
 * Wrapper chung cho tất cả Modal:
 * - Bấm Escape → gọi onClose()
 * - Click vùng tối backdrop → gọi onClose()
 * - Click vào nội dung bên trong → không đóng (target check)
 */
export default function ModalOverlay({ onClose, children, className = '' }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${className}`}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>
  )
}
