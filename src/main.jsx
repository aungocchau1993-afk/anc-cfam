import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { SupabaseProvider } from './context/SupabaseContext'
import './index.css'

// Đăng ký Service Worker — tự reload khi có version mới
const updateSW = registerSW({
  onNeedRefresh() {
    // Có bản cập nhật mới — hỏi user có muốn reload không
    if (confirm('🔄 Có phiên bản mới! Cập nhật ngay?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('[PWA] App đã sẵn sàng chạy Offline')
  },
  onRegisteredSW(swUrl, r) {
    // Kiểm tra cập nhật mỗi 30 phút
    r && setInterval(() => r.update(), 30 * 60 * 1000)
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SupabaseProvider>
      <App />
    </SupabaseProvider>
  </React.StrictMode>
)
