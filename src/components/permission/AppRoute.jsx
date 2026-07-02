import { usePermission } from '../../hooks/usePermission'
import Unauthorized from './Unauthorized'

/**
 * <AppRoute permission="inventory.view" label="Hàng Hóa"><Products /></AppRoute>
 *
 * Route Guard cấp trang — Page KHÔNG tự kiểm tra quyền, tất cả đi qua đây.
 * ANC-CFAM điều hướng bằng state (tab/page), không dùng URL router, nên
 * AppRoute bọc trực tiếp phần tử trang tại điểm dispatch (BusinessModule.jsx,
 * App.jsx) thay vì gắn vào <Route> của react-router.
 */
export default function AppRoute({ permission, label, children }) {
  const { can, loading } = usePermission()

  // Đang tải Profile/Role — không kết luận vội là không có quyền, tránh
  // nháy màn hình 403 rồi mới hiện đúng nội dung ngay sau đó.
  if (loading) return null

  if (!can(permission)) return <Unauthorized label={label} />

  return children
}
