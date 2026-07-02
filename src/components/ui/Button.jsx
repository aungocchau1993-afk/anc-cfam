import { LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

const VARIANT_CLASS = {
  primary:   'btn-primary',
  secondary: 'btn-ghost',
  ghost:     'btn-ghost',
  danger:    'btn-danger',
  success:   'btn-success',
}

// h-11 (44px) mặc định từ .btn-* — size sm/lg override chiều cao qua utility
// (utilities layer nằm sau components layer nên luôn thắng specificity).
const SIZE_CLASS = {
  sm: 'h-9 px-3.5 text-[14px] rounded-lg gap-1.5',
  md: '',
  lg: 'h-12 px-6 text-base rounded-xl gap-2.5',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  type = 'button',
  className = '',
  children,
  ...props
}) {
  const isDisabled = disabled || loading
  return (
    <button
      type={type}
      disabled={isDisabled}
      className={cn(
        VARIANT_CLASS[variant] ?? VARIANT_CLASS.primary,
        SIZE_CLASS[size],
        fullWidth && 'w-full',
        isDisabled && 'opacity-disabled cursor-not-allowed pointer-events-none',
        className,
      )}
      {...props}
    >
      {loading ? (
        <LoaderCircle size={16} strokeWidth={2.2} className="animate-spin" />
      ) : Icon ? (
        <Icon size={16} strokeWidth={2.1} />
      ) : null}
      {children && <span>{children}</span>}
      {!loading && IconRight && <IconRight size={16} strokeWidth={2.1} />}
    </button>
  )
}
