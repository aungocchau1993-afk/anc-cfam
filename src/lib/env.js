// Phát hiện môi trường chạy — dùng để quyết định hiển thị thông tin kỹ thuật
// (Supabase status/version/build) trên Topbar. Không đụng Auth/Session/Route.
//
// VITE_APP_ENV (tùy chọn, đặt trong .env.staging khi deploy staging) cho phép
// phân biệt Staging với Production dù cả hai đều là bản build (import.meta.env.DEV=false).
// Không đặt gì → mặc định 'production' cho mọi bản build, 'development' khi `vite dev`.
export const APP_ENV = import.meta.env.VITE_APP_ENV || (import.meta.env.DEV ? 'development' : 'production')

export const isDevEnv     = APP_ENV === 'development'
export const isStagingEnv = APP_ENV === 'staging'
export const isProdEnv    = APP_ENV === 'production'

// Cụm thông tin kỹ thuật (Supabase/Version/Build) được phép hiển thị ở dev + staging,
// ẩn hoàn toàn ở production theo yêu cầu "khách hàng không được nhìn thấy".
export const showTechInfo = isDevEnv || isStagingEnv
