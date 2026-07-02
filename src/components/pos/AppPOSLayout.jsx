// Layout tổng của trang POS — chia 2 cột theo View Mode:
//   Grid    → 70% Product / 30% Bill
//   List    → 60% Product / 40% Bill
//   Compact → 55% Product / 45% Bill
// Order Mode chỉ đổi màu nền nhẹ, không đổi Product Area.
const WIDTH_CLASSES = {
  grid:    { left: 'md:basis-[70%]', right: 'md:basis-[30%]' },
  list:    { left: 'md:basis-[60%]', right: 'md:basis-[40%]' },
  compact: { left: 'md:basis-[55%]', right: 'md:basis-[45%]' },
}

export default function AppPOSLayout({ viewMode, mode, left, right }) {
  const w = WIDTH_CLASSES[viewMode] || WIDTH_CLASSES.grid

  return (
    <div className={`flex-1 flex flex-col md:flex-row gap-6 px-6 pb-6 min-h-0 min-w-0 md:overflow-hidden transition-colors duration-200 ${
      mode === 'order' ? 'bg-amber-50/50' : 'bg-bg'
    }`}>
      <div className={`flex-1 ${w.left} flex flex-col min-w-0 min-h-0 transition-all duration-200`}>
        {left}
      </div>
      <div className={`w-full ${w.right} shrink-0 flex flex-col min-w-0 min-h-0 transition-all duration-200`}>
        {right}
      </div>
    </div>
  )
}
