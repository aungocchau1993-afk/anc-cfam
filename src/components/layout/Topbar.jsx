import { isSupabaseConfigured } from '../../lib/supabase'
import NotificationBell from '../ui/NotificationBell'

const TITLES = {
  business:    '🏪 Kinh Doanh',
  dashboard:   '📊 Dashboard',
  assumptions: '⚙️ Giả Định',
  quarterly:   '📅 Dòng Tiền Quý',
  annual:      '📆 Tổng Hợp Năm',
  monthly:     '📝 Nhập Tháng',
  portfolio:   '🏦 Danh Mục & Rủi Ro',
  creditcards: '💳 Thẻ Visa / Tín Dụng',
  config:      '🎛️ Cấu Hình',
}

export default function Topbar({ page, onNavigate }) {
  const now = new Date().toLocaleTimeString('vi-VN')
  return (
    <div className="bg-surface border-b border-border px-6 py-3.5 flex items-center justify-between sticky top-0 z-20"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 14px)' }}>
      <div className="font-bold text-[15px]">{TITLES[page] || page}</div>
      <div className="flex items-center gap-3 text-[12px] text-muted">
        <NotificationBell onNavigate={onNavigate} />
        {isSupabaseConfigured
          ? <span className="tag-green">☁ Supabase</span>
          : <span className="tag-blue">💾 Local</span>
        }
        <span>Cập nhật: {now}</span>
      </div>
    </div>
  )
}
