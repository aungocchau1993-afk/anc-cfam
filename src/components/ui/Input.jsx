import { cn } from '../../lib/cn'

// Input dùng chung: label + icon trái + hint/error, wrap .input-base/.input-sm sẵn có.
export default function Input({
  label,
  hint,
  error,
  icon: Icon,
  size = 'md',
  className = '',
  wrapperClassName = '',
  id,
  ...props
}) {
  const inputCls = size === 'sm' ? 'input-sm' : 'input-base'
  return (
    <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
      {label && (
        <label htmlFor={id} className="text-[14px] font-semibold text-text">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            size={16}
            strokeWidth={2}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle pointer-events-none"
          />
        )}
        <input
          id={id}
          className={cn(
            inputCls,
            Icon && 'pl-10',
            error && '!border-cred focus:!border-cred focus:!ring-cred/10',
            className,
          )}
          {...props}
        />
      </div>
      {error ? (
        <span className="text-[12px] text-cred">{error}</span>
      ) : hint ? (
        <span className="text-[12px] text-muted">{hint}</span>
      ) : null}
    </div>
  )
}
