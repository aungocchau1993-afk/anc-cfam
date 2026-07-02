import { Search, X } from 'lucide-react'
import { cn } from '../../lib/cn'

// Search field dùng chung (khác với components/pos/SearchBar.jsx — component đó có
// dropdown autocomplete gắn riêng cho nghiệp vụ POS).
export default function SearchInput({
  value,
  onChange,
  placeholder = 'Tìm kiếm…',
  onClear,
  size = 'md',
  className = '',
}) {
  const inputCls = size === 'sm' ? 'input-sm' : 'input-base'
  return (
    <div className={cn('relative', className)}>
      <Search
        size={16}
        strokeWidth={2}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle pointer-events-none"
      />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputCls, 'pl-10', value && 'pr-9')}
      />
      {value && (
        <button
          type="button"
          onClick={() => (onClear ? onClear() : onChange(''))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-cred transition-colors"
        >
          <X size={14} strokeWidth={2.2} />
        </button>
      )}
    </div>
  )
}
