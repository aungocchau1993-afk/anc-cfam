import { ShieldAlert } from 'lucide-react'

// View 403 dùng chung cho Route Guard — hiển thị khi CurrentUser không có
// quyền truy cập trang đang chọn, thay vì Page tự kiểm tra và render rỗng.
export default function Unauthorized({ label }) {
  return (
    <div className="w-full flex flex-col items-center justify-center gap-3 py-24 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500">
        <ShieldAlert size={26} strokeWidth={1.8} />
      </div>
      <div className="font-bold text-lg text-text">Bạn không có quyền truy cập</div>
      <p className="text-sm text-muted max-w-sm">
        {label ? `Khu vực "${label}" yêu cầu quyền mà tài khoản của bạn hiện chưa được cấp.` : 'Trang này yêu cầu quyền mà tài khoản của bạn hiện chưa được cấp.'}
        {' '}Liên hệ quản trị viên nếu bạn cho rằng đây là nhầm lẫn.
      </p>
    </div>
  )
}
