// Component hiển thị tiền dùng chung — thay cho việc gọi trực tiếp fmtVNDFull()/fmtVND()
// rải rác trong JSX. Đảm bảo: tabular-nums, font mono (JetBrains Mono — không mỏng),
// khoảng cách chuẩn trước ký hiệu ₫, canh phải khi đặt trong <td>.
//
// fmtVNDFull/fmtVND (src/lib/formatters.js) GIỮ NGUYÊN — component này chỉ bọc lại
// cách hiển thị, không đổi công thức tính toán.
import { fmtVND, fmtVNDFull } from '../../lib/formatters'

const TONES = {
  default: 'text-text',
  muted:   'text-muted',
  success: 'text-cgreen',
  danger:  'text-cred',
  primary: 'text-cblue',
}

export default function Money({ value, variant = 'full', tone = 'default', bold = false, className = '' }) {
  const text = variant === 'compact' ? fmtVND(value) : fmtVNDFull(value)
  return (
    <span
      className={`font-mono tabular-nums ${TONES[tone] ?? TONES.default} ${bold ? 'font-bold' : ''} ${className}`}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {text}
    </span>
  )
}
