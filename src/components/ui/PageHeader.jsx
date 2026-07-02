// Hero Header dùng chung cho MỌI module (Dashboard/POS/Hàng Hóa/Kho/CRM/Đơn Hàng/
// Khách Hàng/Báo Cáo/Đa Kênh...) — nền navy #0F172A, cao ~200px, icon + title + subtitle
// bên trái, actions (nút/khối tuỳ trang) bên phải. Full-bleed: đặt PageHeader ở NGOÀI
// div padding của trang (vd `<div className="w-full"><PageHeader/><div className="p-6">…</div></div>`)
// để hero tràn viền đúng như Stripe/Shopify — không đặt PageHeader bên trong div đã có p-6.
//
// Props giữ nguyên như bản cũ (icon/title/subtitle/actions/color) — mọi trang gọi
// <PageHeader icon={...} title="..." subtitle="..." actions={...} /> không cần đổi gì.
//
// `compact` (mới, optional, mặc định false — không ảnh hưởng caller hiện tại):
// dùng cho các layout có chiều cao cố định/không cuộn (vd POS — cart+product phải vừa
// màn hình, không có chỗ cho hero 200px) — vẫn CÙNG ngôn ngữ thiết kế (navy + pattern +
// icon + title), chỉ thấp hơn để không vỡ layout.
export default function PageHeader({ icon: Icon, title, subtitle, actions, color = 'blue', compact = false }) {
  const tones = {
    blue:   'bg-blue-500/15 text-blue-300',
    green:  'bg-emerald-500/15 text-emerald-300',
    amber:  'bg-amber-500/15 text-amber-300',
    violet: 'bg-violet-500/15 text-violet-300',
    rose:   'bg-rose-500/15 text-rose-300',
    teal:   'bg-teal-500/15 text-teal-300',
  }
  return (
    <div
      className={`relative overflow-hidden shrink-0 ${compact ? '' : 'mb-6'}`}
      style={{
        backgroundImage: `linear-gradient(135deg, #0f172a 0%, #131f38 55%, #0f172a 100%), radial-gradient(circle at 1px 1px, rgba(255,255,255,0.045) 1px, transparent 0)`,
        backgroundSize: 'auto, 22px 22px',
      }}
    >
      <div className={`relative z-10 px-6 flex items-center ${compact ? 'py-4 min-h-[76px]' : 'py-8 min-h-[200px]'}`}>
        <div className="w-full flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            {Icon && (
              <span className={`rounded-2xl border border-white/10 flex items-center justify-center shrink-0 ${tones[color] ?? tones.blue} ${compact ? 'w-11 h-11' : 'w-14 h-14'}`}>
                <Icon size={compact ? 22 : 26} strokeWidth={1.8} />
              </span>
            )}
            <div className="min-w-0">
              <h1 className={`text-white leading-tight truncate ${compact ? 'text-page' : 'text-title'}`}>{title}</h1>
              {subtitle && <p className={`text-white/55 truncate ${compact ? 'text-[14px] mt-0.5' : 'text-[14px] mt-1'}`}>{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
        </div>
      </div>
    </div>
  )
}
