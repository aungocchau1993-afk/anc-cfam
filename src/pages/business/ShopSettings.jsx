import { useState } from 'react'
import { toast } from 'sonner'
import { getShopConfig, saveShopConfig } from '../../lib/printReceipt'

export default function ShopSettings() {
  const [cfg, setCfg]     = useState(() => getShopConfig())
  const [saved, setSaved] = useState(false)

  function set(key, val) {
    setCfg(prev => ({ ...prev, [key]: val }))
    setSaved(false)
  }

  function handleSave() {
    saveShopConfig(cfg)
    setSaved(true)
    toast.success('Đã lưu cài đặt cửa hàng')
  }

  const inp = 'input-base'

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-black text-[#e6edf3]">⚙️ Cài đặt cửa hàng</h2>
        <p className="text-sm text-muted mt-1">Thông tin xuất hiện trên hóa đơn in</p>
      </div>

      {/* Thông tin cơ bản */}
      <div className="card space-y-4">
        <div className="font-bold text-sm text-muted uppercase tracking-wider">🏪 Thông tin cửa hàng</div>
        <label className="block">
          <span className="text-xs text-muted mb-1 block">Tên cửa hàng</span>
          <input className={inp} value={cfg.name} onChange={e => set('name', e.target.value)} placeholder="Tên cửa hàng" />
        </label>
        <label className="block">
          <span className="text-xs text-muted mb-1 block">Địa chỉ</span>
          <input className={inp} value={cfg.address} onChange={e => set('address', e.target.value)} placeholder="123 Đường ABC, Q.X, TP.HCM" />
        </label>
        <label className="block">
          <span className="text-xs text-muted mb-1 block">Số điện thoại</span>
          <input className={inp} value={cfg.phone} onChange={e => set('phone', e.target.value)} placeholder="0901 234 567" />
        </label>
        <label className="block">
          <span className="text-xs text-muted mb-1 block">Lời cảm ơn cuối hóa đơn</span>
          <input className={inp} value={cfg.thankMsg} onChange={e => set('thankMsg', e.target.value)} placeholder="Cảm ơn quý khách! Hẹn gặp lại 🙏" />
        </label>
      </div>

      {/* Logo */}
      <div className="card space-y-4">
        <div className="font-bold text-sm text-muted uppercase tracking-wider">🖼️ Logo</div>
        <label className="block">
          <span className="text-xs text-muted mb-1 block">URL ảnh logo (để trống = không hiện)</span>
          <input className={inp} value={cfg.logo} onChange={e => set('logo', e.target.value)} placeholder="https://..." />
        </label>
        {cfg.logo && (
          <img src={cfg.logo} alt="logo preview" className="h-14 object-contain rounded border border-border" onError={e => e.target.style.display='none'} />
        )}
      </div>

      {/* Thanh toán QR */}
      <div className="card space-y-4">
        <div className="font-bold text-sm text-muted uppercase tracking-wider">💳 Thanh toán QR (VietQR)</div>
        <div className="text-xs text-muted bg-cblue/10 border border-cblue/20 rounded-lg px-3 py-2">
          Điền thông tin ngân hàng để in QR thanh toán trên hóa đơn. Để trống nếu không cần.
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-muted mb-1 block">Tên ngân hàng</span>
            <input className={inp} value={cfg.bankName} onChange={e => set('bankName', e.target.value)} placeholder="Vietcombank" />
          </label>
          <label className="block">
            <span className="text-xs text-muted mb-1 block">Số tài khoản</span>
            <input className={inp} value={cfg.bankNumber} onChange={e => set('bankNumber', e.target.value)} placeholder="1234567890" />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-muted mb-1 block">Tên chủ tài khoản</span>
          <input className={inp} value={cfg.bankAccount} onChange={e => set('bankAccount', e.target.value)} placeholder="NGUYEN VAN A" />
        </label>
      </div>

      {/* Chế độ in mặc định */}
      <div className="card space-y-3">
        <div className="font-bold text-sm text-muted uppercase tracking-wider">🖨️ Chế độ in mặc định</div>
        <div className="flex rounded-xl overflow-hidden border border-border">
          <button
            onClick={() => set('printMode', 'thermal')}
            className={`flex-1 py-3 text-sm font-bold transition-colors flex flex-col items-center gap-0.5
              ${cfg.printMode === 'thermal' ? 'bg-cblue text-white' : 'bg-surface2 text-muted hover:text-[#e6edf3]'}`}
          >
            <span className="text-lg">🖨️</span>
            <span>Nhiệt 80mm</span>
            <span className="text-[10px] opacity-70">Khổ giấy nhiệt</span>
          </button>
          <button
            onClick={() => set('printMode', 'a4')}
            className={`flex-1 py-3 text-sm font-bold transition-colors flex flex-col items-center gap-0.5
              ${cfg.printMode === 'a4' ? 'bg-cblue text-white' : 'bg-surface2 text-muted hover:text-[#e6edf3]'}`}
          >
            <span className="text-lg">📄</span>
            <span>A5 / PDF</span>
            <span className="text-[10px] opacity-70">In giấy thường</span>
          </button>
        </div>

        {cfg.printMode === 'thermal' && (
          <div className="bg-surface2 rounded-xl p-4 text-xs text-muted space-y-2 border border-border">
            <div className="font-bold text-[#e6edf3] text-sm mb-1">📋 Hướng dẫn cài máy in nhiệt 80mm</div>
            <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
              <li>Vào <strong className="text-[#e6edf3]">Settings → Bluetooth & devices → Printers & scanners</strong> → chọn máy in nhiệt</li>
              <li>Nhấn <strong className="text-[#e6edf3]">Printing preferences</strong> → đổi Paper Size thành <strong className="text-[#e6edf3]">80 x 200mm</strong> (hoặc "Receipt" tùy hãng)</li>
              <li>Khi hộp thoại in xuất hiện → chọn đúng máy in → <strong className="text-[#e6edf3]">không cần chỉnh gì thêm</strong></li>
              <li>Để in tự động không hiện hộp thoại: dùng trình duyệt <strong className="text-[#e6edf3]">Chrome</strong> → vào <code className="bg-black/30 px-1 rounded">chrome://settings/content/pdfDocuments</code> → bật <em>Download PDFs</em> và dùng extension như <em>PrintFriendly</em></li>
            </ol>
            <div className="mt-2 bg-cyellow/10 border border-cyellow/20 rounded px-3 py-2 text-cyellow text-[11px]">
              💡 Mẹo: Đặt máy in nhiệt làm <strong>máy in mặc định</strong> trong Windows để bấm Ctrl+P là in ngay
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        className={`btn-primary w-full text-base font-black transition-all ${saved ? 'bg-cgreen' : ''}`}
      >
        {saved ? '✅ Đã lưu' : '💾 Lưu cài đặt'}
      </button>
    </div>
  )
}
