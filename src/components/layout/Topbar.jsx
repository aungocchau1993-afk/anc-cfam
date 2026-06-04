import { isSupabaseConfigured } from '../../lib/supabase'

const TITLES = {
  dashboard:   '📊 Dashboard',
  assumptions: '⚙️ Giả Định',
  quarterly:   '📅 Dòng Tiền Quý',
  annual:      '📆 Tổng Hợp Năm',
  monthly:     '📝 Nhập Tháng',
  portfolio:   '🏦 Danh Mục & Rủi Ro',
  creditcards: '💳 Thẻ Visa / Tín Dụng',
  config:      '🎛️ Cấu Hình',
}

export default function Topbar({ page }) {
  const now = new Date().toLocaleTimeString('vi-VN')
  return (
    <div className="bg-surface border-b border-border px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
      <div className="font-bold text-[15px]">{TITLES[page] || page}</div>
      <div className="flex items-center gap-3 text-[12px] text-muted">
        {isSupabaseConfigured
          ? <span className="tag-green">☁ Supabase</span>
          : <span className="tag-blue">💾 Local</span>
        }
        <span>Cập nhật: {now}</span>
      </div>
    </div>
  )
}
