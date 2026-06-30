import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { CHANNEL_CONFIG_FIELDS, OAUTH_URLS, getAdapter } from '../../lib/channelAdapters'
import { loadChannelConfig, saveChannelConfig, syncChannel, pullOrdersFromChannel, syncPriceToChannel } from '../../lib/channelSync'

// ── Channel config (sync với DB seed) ────────────────────────────────────────
const CHANNELS = [
  { id: 'POS',     name: 'Bán tại quầy',  icon: '🏪', color: '#16a34a', colorClass: 'text-cgreen',   bg: 'bg-cgreen/10',   border: 'border-cgreen/30'   },
  { id: 'SHOPEE',  name: 'Shopee',         icon: '🛒', color: '#ee4d2d', colorClass: 'text-cred',     bg: 'bg-cred/10',     border: 'border-cred/30'     },
  { id: 'LAZADA',  name: 'Lazada',         icon: '📦', color: '#0f146d', colorClass: 'text-[#7c3aed]',bg: 'bg-[#7c3aed]/10',border: 'border-[#7c3aed]/30'},
  { id: 'TIKTOK',  name: 'TikTok Shop',   icon: '🎵', color: '#010101', colorClass: 'text-cblue',    bg: 'bg-cblue/10',    border: 'border-cblue/30'    },
  { id: 'WEBSITE', name: 'Website riêng', icon: '🌐', color: '#d97706', colorClass: 'text-cyellow',  bg: 'bg-cyellow/10',  border: 'border-cyellow/30'  },
]

function fmtMoney(n) {
  if (!n) return '0đ'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} Tỷ`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(0)} Tr`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString('vi-VN') + 'đ'
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
}

// Làm tròn lên số "đẹp" cho trục Y biểu đồ
function niceCeil(v) {
  if (v <= 0) return 1
  const mag  = Math.pow(10, Math.floor(Math.log10(v)))
  const norm = v / mag
  let nice
  if (norm <= 1) nice = 1
  else if (norm <= 1.5) nice = 1.5
  else if (norm <= 2) nice = 2
  else if (norm <= 2.5) nice = 2.5
  else if (norm <= 3) nice = 3
  else if (norm <= 4) nice = 4
  else if (norm <= 5) nice = 5
  else if (norm <= 7.5) nice = 7.5
  else nice = 10
  return nice * mag
}

function pickXTicks(n) {
  if (n <= 1) return [0]
  const count = Math.min(6, n)
  const step  = (n - 1) / (count - 1)
  const out   = []
  for (let i = 0; i < count; i++) out.push(Math.round(i * step))
  return [...new Set(out)]
}

// ── Platform brand logos (SVG inline) ────────────────────────────────────────
const PLATFORM_META = {
  SHOPEE: {
    label: 'Shopee',
    tagline: 'Nền tảng thương mại điện tử',
    brandColor: '#EE4D2D',
    gradient: 'from-[#EE4D2D] to-[#FF7337]',
    logoBg: 'bg-[#EE4D2D]',
    // Túi mua sắm + chữ "S" — logo thật Shopee
    logo: (
      <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
        <rect width="40" height="40" rx="10" fill="#EE4D2D"/>
        <path d="M15 14.4a5 5 0 0 1 10 0" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"/>
        <path d="M12.4 14.4h15.2l-1.02 15.1a1.7 1.7 0 0 1-1.7 1.6H15.12a1.7 1.7 0 0 1-1.7-1.6L12.4 14.4Z" fill="#fff"/>
        <path d="M22.7 21c-.2-1.05-1.1-1.7-2.5-1.7-1.45 0-2.5.8-2.5 2 0 1 .8 1.55 2.1 1.85l1 .22c1.55.38 2.45 1.1 2.45 2.4 0 1.55-1.35 2.45-3.05 2.45-1.55 0-2.75-.62-3.05-1.95" stroke="#EE4D2D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  LAZADA: {
    label: 'Lazada',
    tagline: 'Sàn thương mại điện tử',
    brandColor: '#0F146D',
    gradient: 'from-[#0F146D] to-[#FF6900]',
    logoBg: 'bg-[#0F146D]',
    // Logo thật Lazada: nền trắng + biểu tượng "ruy băng gấp" cam → hồng magenta
    logo: (
      <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
        <rect width="40" height="40" rx="10" fill="#fff"/>
        {/* Nửa cam (trái) */}
        <path d="M16 8.5 19.3 30 9.3 18.2Z" fill="#FF6A00"/>
        {/* Nửa hồng magenta (phải) */}
        <path d="M16 8.5 25 10.7 30.7 17 19.3 30Z" fill="#FF0078"/>
        {/* Nếp gấp */}
        <path d="M16 8.5 19.3 30" stroke="#fff" strokeWidth="0.6" strokeLinecap="round" opacity="0.6"/>
      </svg>
    ),
  },
  TIKTOK: {
    label: 'TikTok Shop',
    tagline: 'Live commerce & short video',
    brandColor: '#010101',
    gradient: 'from-[#010101] to-[#69C9D0]',
    logoBg: 'bg-[#010101]',
    // Nốt nhạc lệch màu cyan/đỏ — logo thật TikTok
    logo: (
      <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
        <rect width="40" height="40" rx="10" fill="#010101"/>
        <path d="M23.6 9.5c.32 2.8 2.5 5 5.3 5.28v3.5c-1.7-.1-3.32-.62-4.78-1.5v7.55a6.68 6.68 0 1 1-6.68-6.68c.35 0 .7.03 1.04.08v3.58a3.24 3.24 0 1 0 2.27 3.1V9.5h2.85Z" fill="#25F4EE" transform="translate(-1.3 -0.85)"/>
        <path d="M23.6 9.5c.32 2.8 2.5 5 5.3 5.28v3.5c-1.7-.1-3.32-.62-4.78-1.5v7.55a6.68 6.68 0 1 1-6.68-6.68c.35 0 .7.03 1.04.08v3.58a3.24 3.24 0 1 0 2.27 3.1V9.5h2.85Z" fill="#FE2C55" transform="translate(1.3 0.85)"/>
        <path d="M23.6 9.5c.32 2.8 2.5 5 5.3 5.28v3.5c-1.7-.1-3.32-.62-4.78-1.5v7.55a6.68 6.68 0 1 1-6.68-6.68c.35 0 .7.03 1.04.08v3.58a3.24 3.24 0 1 0 2.27 3.1V9.5h2.85Z" fill="#fff"/>
      </svg>
    ),
  },
  WEBSITE: {
    label: 'Website riêng',
    tagline: 'Kênh bán hàng tự vận hành',
    brandColor: '#0EA5E9',
    gradient: 'from-[#0EA5E9] to-[#6366F1]',
    logoBg: 'bg-[#0EA5E9]',
    // Quả địa cầu
    logo: (
      <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
        <rect width="40" height="40" rx="10" fill="#0EA5E9"/>
        <circle cx="20" cy="20" r="9" stroke="#fff" strokeWidth="1.8"/>
        <ellipse cx="20" cy="20" rx="3.8" ry="9" stroke="#fff" strokeWidth="1.5"/>
        <path d="M11.2 20h17.6M12.4 15.2h15.2M12.4 24.8h15.2" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
}

// ── Sparkline nhỏ cho thẻ KPI ─────────────────────────────────────────────────
function Sparkline({ data, color, w = 96, h = 36 }) {
  let series = (data && data.length >= 2) ? data : [0, 0]
  const max = Math.max(...series, 1)
  const min = Math.min(...series, 0)
  const span = max - min || 1
  const stepX = w / (series.length - 1)
  const pts = series.map((v, i) => [i * stepX, h - ((v - min) / span) * (h - 5) - 3])
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = `${line} L ${w} ${h} L 0 ${h} Z`
  const gid  = 'spk-' + color.replace(/[^a-z0-9]/gi, '')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="shrink-0">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`}/>
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Biểu đồ vùng doanh thu theo ngày ──────────────────────────────────────────
function RevenueAreaChart({ series, color }) {
  const vals    = series.map(s => s.value)
  const niceMax = niceCeil(Math.max(...vals, 1))
  const n       = Math.max(series.length, 2)
  const W = 1000, H = 280
  const stepX = W / (n - 1)
  const pts = (series.length >= 2 ? series : [{ value: 0 }, { value: 0 }]).map(
    (s, i) => `${(i * stepX).toFixed(1)},${(H - (s.value / niceMax) * H).toFixed(1)}`
  )
  const linePath = 'M' + pts.join(' L')
  const areaPath = `${linePath} L ${W},${H} L 0,${H} Z`
  const yTicks   = [1, 0.75, 0.5, 0.25, 0]
  const xIdx     = pickXTicks(series.length)
  const gid      = 'area-' + color.replace(/[^a-z0-9]/gi, '')

  return (
    <div className="flex gap-2">
      {/* Trục Y */}
      <div className="flex flex-col justify-between text-[10px] text-slate-500 w-12 text-right shrink-0 py-0.5" style={{ height: 200 }}>
        {yTicks.map(t => <div key={t} className="leading-none">{fmtMoney(niceMax * t)}</div>)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="relative" style={{ height: 200 }}>
          {/* Gridlines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {yTicks.map(t => <div key={t} className="border-t border-slate-800" />)}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.22"/>
                <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${gid})`}/>
            <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"/>
          </svg>
        </div>
        {/* Trục X */}
        <div className="flex justify-between text-[9px] text-slate-500 mt-1.5">
          {xIdx.map(i => <span key={i}>{series[i]?.label}</span>)}
        </div>
      </div>
    </div>
  )
}

// ── Sync status badge ─────────────────────────────────────────────────────────
function SyncBadge({ status }) {
  if (!status) return <span className="text-[10px] text-slate-600">Chưa đồng bộ</span>
  const map = {
    success: 'text-cgreen bg-cgreen/10 border-cgreen/25',
    error:   'text-cred bg-cred/10 border-cred/25',
    partial: 'text-cyellow bg-cyellow/10 border-cyellow/25',
  }
  const label = { success: '✓ Thành công', error: '✗ Lỗi', partial: '⚠ Một phần' }
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${map[status] || ''}`}>
      {label[status] || status}
    </span>
  )
}

// ── Icon set cho thẻ KPI ──────────────────────────────────────────────────────
const KpiIcon = {
  money: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  doc:   <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>,
  pulse: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  crown: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18h20M3 7l4 4 5-7 5 7 4-4v9H3z"/></svg>,
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ChannelOverview() {
  const [stats,       setStats]       = useState([])   // per-channel revenue stats
  const [daily,       setDaily]       = useState([])   // chuỗi doanh thu theo ngày
  const [prevRevenue, setPrevRevenue] = useState(0)    // doanh thu kỳ trước
  const [prevOrders,  setPrevOrders]  = useState(0)    // số đơn kỳ trước
  const [syncLogs,    setSyncLogs]    = useState([])   // recent sync logs
  const [skuMappings, setSkuMappings] = useState([])   // SKU mappings
  const [products,    setProducts]    = useState([])   // for inventory table
  const [loading,     setLoading]     = useState(true)
  const [syncing,     setSyncing]     = useState(null) // channel_id đang sync
  const [activeTab,   setActiveTab]   = useState('overview') // overview | inventory | mapping | logs | apiconfig
  const [range,       setRange]       = useState(30)   // ngày
  const [chartCh,     setChartCh]     = useState('POS')// kênh đang xem trên biểu đồ
  const [menuCh,      setMenuCh]      = useState(null) // kebab menu đang mở

  // ── API Config tab state ──────────────────────────────────────────────────
  const [cfgChannel,  setCfgChannel]  = useState('SHOPEE')  // kênh đang cấu hình
  const [cfgForm,     setCfgForm]     = useState({})         // { field_key: value }
  const [cfgLoading,  setCfgLoading]  = useState(false)      // đang load config từ DB
  const [cfgSaving,   setCfgSaving]   = useState(false)      // đang lưu
  const [showPwd,     setShowPwd]     = useState({})         // { field_key: bool } toggle show password
  const [cfgValid,    setCfgValid]    = useState(null)       // { ok, errors } sau khi validate

  const loadData = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    try {
      const dayMs     = 86400000
      const since     = new Date(Date.now() - range * dayMs).toISOString()
      const sincePrev = new Date(Date.now() - 2 * range * dayMs).toISOString()

      // Lấy đơn cả kỳ hiện tại + kỳ trước (để tính % thay đổi)
      const { data: orders } = await supabase
        .from('orders')
        .select('channel_id, total_amount, created_at')
        .gte('created_at', sincePrev)
        .eq('status', 'completed')

      const all  = orders || []
      const cur  = all.filter(o => o.created_at >= since)
      const prev = all.filter(o => o.created_at <  since)

      // Doanh thu / số đơn theo kênh (kỳ hiện tại)
      const revenueMap = {}, orderMap = {}
      CHANNELS.forEach(c => { revenueMap[c.id] = 0; orderMap[c.id] = 0 })
      cur.forEach(o => {
        const ch = o.channel_id || 'POS'
        revenueMap[ch] = (revenueMap[ch] || 0) + Number(o.total_amount || 0)
        orderMap[ch]   = (orderMap[ch]   || 0) + 1
      })
      setStats(CHANNELS.map(c => ({
        ...c,
        revenue:    revenueMap[c.id] || 0,
        orderCount: orderMap[c.id]   || 0,
      })))

      // Tổng kỳ trước
      setPrevRevenue(prev.reduce((s, o) => s + Number(o.total_amount || 0), 0))
      setPrevOrders(prev.length)

      // Chuỗi doanh thu theo ngày (kỳ hiện tại)
      const start = new Date(); start.setHours(0, 0, 0, 0)
      start.setTime(start.getTime() - (range - 1) * dayMs)
      const days = []
      for (let i = 0; i < range; i++) {
        const d = new Date(start.getTime() + i * dayMs)
        days.push({
          key:   d.toISOString().slice(0, 10),
          label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
          byChannel: Object.fromEntries(CHANNELS.map(c => [c.id, 0])),
          total: 0, orders: 0,
        })
      }
      const dayIndex = Object.fromEntries(days.map((d, i) => [d.key, i]))
      cur.forEach(o => {
        const idx = dayIndex[(o.created_at || '').slice(0, 10)]
        if (idx == null) return
        const ch  = o.channel_id || 'POS'
        const amt = Number(o.total_amount || 0)
        if (days[idx].byChannel[ch] == null) days[idx].byChannel[ch] = 0
        days[idx].byChannel[ch] += amt
        days[idx].total  += amt
        days[idx].orders += 1
      })
      setDaily(days)

      // Sync logs
      const { data: logs } = await supabase
        .from('channel_sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      setSyncLogs(logs || [])

      // SKU mappings
      const { data: mappings } = await supabase
        .from('channel_sku_mappings')
        .select('*, products(name, sku)')
        .order('created_at', { ascending: false })
        .limit(100)
      setSkuMappings(mappings || [])

      // Channel inventory
      const { data: inv } = await supabase
        .from('channel_inventory')
        .select('*, products(name, sku, stock_quantity), channels(name, icon)')
        .order('updated_at', { ascending: false })
        .limit(100)
      setProducts(inv || [])

    } catch (e) {
      toast.error('Lỗi tải dữ liệu: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => { loadData() }, [loadData])

  // ── Sync thật dùng channelSync + adapter ─────────────────────────────────
  async function handleSync(channelId) {
    if (!supabase) return
    setSyncing(channelId)
    const chName = CHANNELS.find(c => c.id === channelId)?.name
    try {
      const adapter = getAdapter(channelId)
      const config  = await loadChannelConfig(channelId)
      const { ok, errors } = adapter?.validateConfig(config || {}) ?? { ok: false, errors: ['Chưa có adapter'] }

      if (!ok) {
        toast.warning(`⚠️ ${chName}: ${errors[0]} — Vào tab 🔑 Cấu hình API để nhập key`)
        await supabase.from('channel_sync_logs').insert({
          channel_id: channelId, sync_type: 'inventory',
          status: 'error', message: errors.join(', '),
        })
        return
      }

      const result = await syncChannel(channelId)
      const invOk  = result.inventory?.updated >= 0
      const ordOk  = result.orders?.imported >= 0
      toast.success(`✅ ${chName}: ${invOk ? `${result.inventory.updated} tồn kho` : 'lỗi tồn kho'} · ${ordOk ? `${result.orders.imported} đơn mới` : 'lỗi đơn'}`)
      loadData()
    } catch (e) {
      toast.error(`Lỗi đồng bộ ${chName}: ${e.message}`)
    } finally {
      setSyncing(null)
    }
  }

  async function handleSyncAll() {
    for (const ch of CHANNELS.filter(c => c.id !== 'POS')) {
      await handleSync(ch.id)
    }
  }

  async function handlePullOrders(channelId) {
    setSyncing(channelId + '_orders')
    const chName = CHANNELS.find(c => c.id === channelId)?.name
    try {
      const result = await pullOrdersFromChannel(channelId)
      toast.success(`📦 ${chName}: Kéo về ${result.imported} đơn mới`)
      loadData()
    } catch (e) {
      toast.error(`Lỗi kéo đơn ${chName}: ${e.message}`)
    } finally {
      setSyncing(null)
    }
  }

  async function handleSyncPrice(channelId) {
    setSyncing(channelId + '_price')
    const chName = CHANNELS.find(c => c.id === channelId)?.name
    try {
      const result = await syncPriceToChannel(channelId)
      toast.success(`💰 ${chName}: Đã sync giá ${result.updated} sản phẩm`)
      loadData()
    } catch (e) {
      toast.error(`Lỗi sync giá ${chName}: ${e.message}`)
    } finally {
      setSyncing(null)
    }
  }

  // Load config từ DB mỗi khi đổi kênh hoặc vào tab apiconfig
  useEffect(() => {
    if (activeTab !== 'apiconfig') return
    setCfgValid(null)
    setCfgLoading(true)
    loadChannelConfig(cfgChannel)
      .then(cfg => setCfgForm(cfg || {}))
      .catch(() => setCfgForm({}))
      .finally(() => setCfgLoading(false))
  }, [cfgChannel, activeTab])

  async function handleSaveConfig() {
    setCfgSaving(true)
    try {
      await saveChannelConfig(cfgChannel, cfgForm)
      toast.success(`✅ Đã lưu cấu hình API cho ${CHANNELS.find(c => c.id === cfgChannel)?.name}`)
      setCfgValid(null)
    } catch (e) {
      toast.error('Lỗi lưu: ' + e.message)
    } finally {
      setCfgSaving(false)
    }
  }

  function handleValidate() {
    const adapter = getAdapter(cfgChannel)
    if (!adapter) { setCfgValid({ ok: false, errors: ['Chưa có adapter cho kênh này'] }); return }
    setCfgValid(adapter.validateConfig(cfgForm))
  }

  const totalRevenue = stats.reduce((s, c) => s + c.revenue, 0)
  const totalOrders  = stats.reduce((s, c) => s + c.orderCount, 0)
  const lastSyncTime = syncLogs[0]?.created_at
  const activeCount  = stats.filter(c => c.orderCount > 0).length
  const topChannel   = stats.reduce((a, b) => (a.revenue >= b.revenue ? a : b), stats[0] || {})
  const topPct       = totalRevenue > 0 ? Math.round(((topChannel?.revenue || 0) / totalRevenue) * 100) : 0
  const revChange    = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null
  const ordChange    = prevOrders  > 0 ? ((totalOrders - prevOrders)  / prevOrders)  * 100 : null

  const chartColor  = CHANNELS.find(c => c.id === chartCh)?.color || '#16a34a'
  const chartSeries = daily.map(d => ({ value: d.byChannel[chartCh] || 0, label: d.label }))

  const TABS = [
    { id: 'overview',   label: '📊 Tổng quan'      },
    { id: 'inventory',  label: '📦 Tồn kho kênh'   },
    { id: 'mapping',    label: '🔗 SKU Mapping'     },
    { id: 'logs',       label: '📋 Lịch sử đồng bộ'},
    { id: 'apiconfig',  label: '🔑 Cấu hình API'   },
  ]

  // ── Sub-component: dòng % thay đổi ──────────────────────────────────────────
  const ChangeText = ({ change }) =>
    change == null
      ? <span className="text-slate-500">— so với {range} ngày trước</span>
      : (
        <span className={change >= 0 ? 'text-emerald-600' : 'text-rose-500'}>
          {change >= 0 ? '↑' : '↓'}{Math.abs(change).toFixed(1)}% so với {range} ngày trước
        </span>
      )

  return (
    <div className="p-5 bg-bg min-h-full">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xl shadow-sm shrink-0">🌐</div>
          <div>
            <h1 className="text-xl font-bold text-[#1e293b] leading-tight">Omnichannel Overview</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Quản lý bán hàng đa kênh · {lastSyncTime ? `Đồng bộ lần cuối: ${fmtDate(lastSyncTime)}` : 'Chưa đồng bộ'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">📅</span>
            <select
              value={range}
              onChange={e => setRange(Number(e.target.value))}
              className="appearance-none text-xs font-semibold bg-white border border-slate-700 text-slate-600 rounded-lg pl-7 pr-7 py-2 cursor-pointer hover:border-slate-600 transition-colors"
            >
              <option value={7}>7 ngày</option>
              <option value={30}>30 ngày</option>
              <option value={90}>90 ngày</option>
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[8px]">▼</span>
          </div>
          <button
            onClick={handleSyncAll}
            disabled={!!syncing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#1e293b] text-white hover:bg-[#0f172a] transition-all disabled:opacity-50 shadow-sm"
          >
            <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 2v6h-6M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6M21 12a9 9 0 01-15 6.7L3 16"/>
            </svg>
            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ tất cả'}
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {/* Tổng doanh thu */}
        <div className="bg-white border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">{KpiIcon.money}</span>
            <span className="text-[11px] font-medium text-slate-500">Tổng doanh thu</span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="text-2xl font-extrabold text-[#1e293b] leading-none truncate">{fmtMoney(totalRevenue)}</div>
              <div className="text-[10px] mt-1.5"><ChangeText change={revChange} /></div>
            </div>
            <Sparkline data={daily.map(d => d.total)} color="#16a34a" />
          </div>
        </div>

        {/* Tổng đơn hàng */}
        <div className="bg-white border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">{KpiIcon.doc}</span>
            <span className="text-[11px] font-medium text-slate-500">Tổng đơn hàng</span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="text-2xl font-extrabold text-[#1e293b] leading-none">{totalOrders.toLocaleString('vi-VN')}</div>
              <div className="text-[10px] mt-1.5"><ChangeText change={ordChange} /></div>
            </div>
            <Sparkline data={daily.map(d => d.orders)} color="#2563eb" />
          </div>
        </div>

        {/* Kênh hoạt động */}
        <div className="bg-white border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">{KpiIcon.pulse}</span>
            <span className="text-[11px] font-medium text-slate-500">Kênh hoạt động</span>
          </div>
          <div className="text-2xl font-extrabold text-[#1e293b] leading-none">{activeCount} / {CHANNELS.length}</div>
          <div className="text-[10px] text-slate-500 mt-1.5">{Math.round((activeCount / CHANNELS.length) * 100)}% kênh đang hoạt động</div>
        </div>

        {/* Kênh chủ lực */}
        <div className="bg-white border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">{KpiIcon.crown}</span>
            <span className="text-[11px] font-medium text-slate-500">Kênh chủ lực</span>
          </div>
          <div className="text-xl font-extrabold text-[#1e293b] leading-tight truncate">{topChannel?.name || '—'}</div>
          <div className="text-[10px] text-slate-500 mt-1.5">{topPct}% doanh thu</div>
        </div>
      </div>

      {/* ── Tabs (pill) ── */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === t.id
                ? 'bg-cblue text-white shadow-sm'
                : 'bg-white border border-slate-800 text-slate-500 hover:text-[#1e293b] hover:border-slate-700'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 text-sm">Đang tải...</div>
      ) : (
        <>
          {/* ══ TAB: OVERVIEW ══ */}
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* ── Biểu đồ doanh thu theo kênh ── */}
                <div className="bg-white border border-slate-800 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[#1e293b]">Doanh thu theo kênh ({range} ngày)</h3>
                    <span className="text-[10px] font-semibold text-slate-500 bg-surface2 border border-slate-800 rounded-md px-2 py-1">{range} ngày</span>
                  </div>

                  <div className="mb-3">
                    <div className="text-2xl font-extrabold" style={{ color: chartColor }}>{fmtMoney(totalRevenue)}</div>
                    <div className="text-[11px] text-slate-500">Tổng doanh thu</div>
                  </div>

                  {/* Channel chips */}
                  <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none pb-1">
                    {stats.map(ch => {
                      const active = chartCh === ch.id
                      return (
                        <button
                          key={ch.id}
                          onClick={() => setChartCh(ch.id)}
                          className={`shrink-0 flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2 transition-all min-w-[78px] ${
                            active ? 'bg-white shadow-sm' : 'bg-surface2 border-slate-800 hover:border-slate-700'
                          }`}
                          style={active ? { borderColor: ch.color, boxShadow: `0 0 0 1px ${ch.color}55` } : undefined}
                        >
                          <span className="text-sm font-extrabold tabular-nums" style={{ color: active ? ch.color : '#1e293b' }}>{fmtMoney(ch.revenue)}</span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 whitespace-nowrap">
                            <span className="text-xs leading-none">{ch.icon}</span>{ch.name.split(' ')[0]}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <RevenueAreaChart series={chartSeries} color={chartColor} />
                </div>

                {/* ── Trạng thái kênh kết nối ── */}
                <div className="bg-white border border-slate-800 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-[#1e293b] mb-3">Trạng thái kênh kết nối</h3>
                  <div className="flex flex-col gap-2">
                    {stats.map(ch => {
                      const pct    = totalRevenue > 0 ? ((ch.revenue / totalRevenue) * 100).toFixed(0) : 0
                      const meta   = PLATFORM_META[ch.id]
                      const isPOS  = ch.id === 'POS'
                      const online = isPOS || ch.revenue > 0
                      return (
                        <div key={ch.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-white px-3 py-2.5 hover:border-slate-700 transition-colors">
                          {/* Logo / icon */}
                          <div className="shrink-0 w-9 h-9">
                            {meta?.logo ?? (
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                                style={{ background: ch.color + '1a', border: `1px solid ${ch.color}40` }}>
                                {ch.icon}
                              </div>
                            )}
                          </div>

                          {/* Info + progress */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-[#1e293b] truncate">{ch.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 bg-surface2 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%`, background: ch.color }} />
                              </div>
                              <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">{pct}% · {ch.orderCount} đơn</span>
                            </div>
                          </div>

                          {/* Revenue + status */}
                          <div className="shrink-0 text-right">
                            <div className="text-sm font-extrabold tabular-nums" style={{ color: ch.color }}>{fmtMoney(ch.revenue)}</div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${online ? 'text-emerald-600 bg-emerald-50' : 'text-rose-500 bg-rose-50'}`}>
                              {online ? '● Online' : 'Offline'}
                            </span>
                          </div>

                          {/* Sync */}
                          <button
                            onClick={() => handleSync(ch.id)}
                            disabled={syncing === ch.id || isPOS}
                            title={isPOS ? 'Kênh offline, không cần đồng bộ' : `Đồng bộ ${ch.name}`}
                            className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all disabled:opacity-40 ${
                              isPOS
                                ? 'text-slate-500 border-slate-800 cursor-default'
                                : 'text-cblue border-cblue/30 bg-cblue/5 hover:bg-cblue/15'
                            }`}
                          >
                            {syncing === ch.id ? (
                              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="9" strokeDasharray="28" strokeDashoffset="10"/></svg>
                            ) : (
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6M21 12a9 9 0 01-15 6.7L3 16"/></svg>
                            )}
                            Sync
                          </button>

                          {/* Kebab menu */}
                          <div className="relative shrink-0">
                            <button
                              onClick={() => setMenuCh(menuCh === ch.id ? null : ch.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#1e293b] hover:bg-surface2 transition-colors"
                              title="Thao tác khác"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
                            </button>
                            {menuCh === ch.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setMenuCh(null)} />
                                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-800 rounded-xl shadow-lg z-20 overflow-hidden py-1">
                                  <button onClick={() => { setMenuCh(null); handleSync(ch.id) }} disabled={isPOS}
                                    className="w-full text-left px-3 py-2 text-xs text-[#1e293b] hover:bg-surface2 disabled:opacity-40 transition-colors">🔄 Đồng bộ ngay</button>
                                  <button onClick={() => { setMenuCh(null); handlePullOrders(ch.id) }} disabled={isPOS}
                                    className="w-full text-left px-3 py-2 text-xs text-[#1e293b] hover:bg-surface2 disabled:opacity-40 transition-colors">🧾 Kéo đơn về</button>
                                  <button onClick={() => { setMenuCh(null); handleSyncPrice(ch.id) }} disabled={isPOS}
                                    className="w-full text-left px-3 py-2 text-xs text-[#1e293b] hover:bg-surface2 disabled:opacity-40 transition-colors">💰 Sync giá → sàn</button>
                                  <button onClick={() => { setMenuCh(null); setCfgChannel(ch.id === 'POS' ? 'SHOPEE' : ch.id); setActiveTab('apiconfig') }}
                                    className="w-full text-left px-3 py-2 text-xs text-[#1e293b] hover:bg-surface2 transition-colors">🔑 Cấu hình API</button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* ── Lộ trình tích hợp API sàn ── */}
              <div className="mt-4 bg-white border border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">🗺️ Lộ trình tích hợp API sàn</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { step: '1', icon: '🛡️', iconBg: 'bg-emerald-50 text-emerald-600', title: 'Cấu hình API Key', desc: 'Đăng ký Shopee/Lazada Partner API, nhập key vào tab Cấu hình API', btn: 'Cấu hình', btnCls: 'border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100', nav: 'apiconfig' },
                    { step: '2', icon: '🧩', iconBg: 'bg-blue-50 text-blue-600',       title: 'Map SKU sản phẩm', desc: 'Liên kết SKU nội bộ với mã sản phẩm trên sàn',                  btn: 'Mapping',  btnCls: 'border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100',          nav: 'mapping' },
                    { step: '3', icon: '🔗', iconBg: 'bg-violet-50 text-violet-600',   title: 'Bật Webhook',      desc: 'Khi có đơn mới trên sàn → tự động đẩy vào hệ thống qua Supabase Edge Function', btn: 'Webhook', btnCls: 'border-violet-200 text-violet-600 bg-violet-50 hover:bg-violet-100', nav: 'apiconfig' },
                  ].map((s, i, arr) => (
                    <div key={s.step} className="relative rounded-xl border border-slate-800 p-4 bg-surface2/50">
                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-surface2 border border-slate-700 text-[10px] font-bold text-slate-500 flex items-center justify-center">{s.step}</span>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3 ${s.iconBg}`}>{s.icon}</div>
                      <div className="text-sm font-bold text-[#1e293b] mb-1">{s.title}</div>
                      <div className="text-[11px] text-slate-500 leading-relaxed mb-3">{s.desc}</div>
                      <button
                        onClick={() => setActiveTab(s.nav)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${s.btnCls}`}
                      >
                        {s.btn} <span className="text-xs">→</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ══ TAB: CHANNEL INVENTORY ══ */}
          {activeTab === 'inventory' && (
            <div className="bg-white border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#1e293b]">Phân bổ tồn kho theo kênh</span>
                <span className="text-xs text-slate-500">{products.length} cấu hình</span>
              </div>
              {products.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-sm">
                  <div className="text-3xl mb-2">📦</div>
                  Chưa có phân bổ tồn kho kênh nào.<br/>
                  <span className="text-xs">Thêm bằng cách cấu hình số lượng list trên từng sàn.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500">
                        <th className="text-left px-4 py-2">Sản phẩm</th>
                        <th className="text-left px-4 py-2">Kênh</th>
                        <th className="text-right px-4 py-2">Tổng tồn</th>
                        <th className="text-right px-4 py-2">List trên sàn</th>
                        <th className="text-right px-4 py-2">Đang giữ</th>
                        <th className="text-right px-4 py-2">Cập nhật</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {products.map(row => (
                        <tr key={row.id} className="hover:bg-surface2 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-[#1e293b]">{row.products?.name || '—'}</div>
                            <div className="text-slate-500 font-mono text-[10px]">{row.products?.sku}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-sm">{row.channels?.icon}</span>{' '}
                            <span className="text-slate-400">{row.channels?.name}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                            {row.products?.stock_quantity ?? 0}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-cblue">{row.listed_qty}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-cyellow">{row.reserved_qty}</td>
                          <td className="px-4 py-2.5 text-right text-slate-500">{fmtDate(row.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══ TAB: SKU MAPPING ══ */}
          {activeTab === 'mapping' && (
            <div className="bg-white border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-[#1e293b]">SKU Mapping — Liên kết sàn ↔ nội bộ</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Liên kết mã sản phẩm trên sàn TMĐT với SKU trong hệ thống</p>
                </div>
                <span className="text-xs text-slate-500">{skuMappings.length} mapping</span>
              </div>
              {skuMappings.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-sm">
                  <div className="text-3xl mb-2">🔗</div>
                  Chưa có mapping nào.<br/>
                  <span className="text-xs">Import đơn hàng từ sàn sẽ tự động tạo mapping.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500">
                        <th className="text-left px-4 py-2">Sản phẩm nội bộ</th>
                        <th className="text-left px-4 py-2">Kênh</th>
                        <th className="text-left px-4 py-2">SKU trên sàn</th>
                        <th className="text-left px-4 py-2">ID sàn</th>
                        <th className="text-right px-4 py-2">Đồng bộ cuối</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {skuMappings.map(m => {
                        const ch = CHANNELS.find(c => c.id === m.channel_id)
                        return (
                          <tr key={m.id} className="hover:bg-surface2 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-[#1e293b]">{m.products?.name || '—'}</div>
                              <div className="text-slate-500 font-mono text-[10px]">{m.products?.sku}</div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span>{ch?.icon}</span>{' '}
                              <span className={ch?.colorClass}>{ch?.name}</span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-cyellow">{m.platform_sku}</td>
                            <td className="px-4 py-2.5 font-mono text-slate-500 text-[10px]">{m.platform_product_id || '—'}</td>
                            <td className="px-4 py-2.5 text-right text-slate-500">{fmtDate(m.last_synced_at)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══ TAB: API CONFIG ══ */}
          {activeTab === 'apiconfig' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* ── Chọn kênh ── */}
              <div className="flex flex-col gap-3">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Chọn sàn kết nối</div>

                {CHANNELS.filter(c => c.id !== 'POS').map(ch => {
                  const meta    = PLATFORM_META[ch.id]
                  const isActive = cfgChannel === ch.id
                  const hasConfig = isActive && Object.keys(cfgForm).some(k => cfgForm[k])
                  return (
                    <button
                      key={ch.id}
                      onClick={() => { setCfgChannel(ch.id); setCfgForm({}); setCfgValid(null) }}
                      className={`group relative w-full text-left rounded-2xl border bg-white transition-all duration-200 overflow-hidden ${
                        isActive
                          ? 'border-cblue/40 shadow-md scale-[1.01]'
                          : 'border-slate-800 hover:border-slate-700 hover:scale-[1.005]'
                      }`}
                    >
                      {/* Gradient accent strip */}
                      <div className={`absolute inset-0 bg-gradient-to-r ${meta?.gradient} ${isActive ? 'opacity-10' : 'opacity-0'} group-hover:opacity-[0.06] transition-opacity`} />

                      <div className="relative flex items-center gap-3 px-4 py-3.5">
                        {/* Logo */}
                        <div className="shrink-0">
                          {meta?.logo}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-black leading-tight text-[#1e293b]">
                            {meta?.label}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{meta?.tagline}</div>
                          {hasConfig && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-cgreen inline-block"/>
                              <span className="text-[10px] text-cgreen font-semibold">Đã cấu hình</span>
                            </div>
                          )}
                        </div>

                        {/* Active indicator */}
                        {isActive ? (
                          <div className="shrink-0 w-5 h-5 rounded-full bg-cblue flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-white"/>
                          </div>
                        ) : (
                          <div className="shrink-0 text-[10px] text-slate-500 group-hover:text-slate-400 font-semibold transition-colors">
                            ⊕ Kết nối
                          </div>
                        )}
                      </div>

                      {/* Bottom separator */}
                      {isActive && (
                        <div className={`h-0.5 bg-gradient-to-r ${meta?.gradient}`}/>
                      )}
                    </button>
                  )
                })}

                {/* Hướng dẫn nhanh */}
                <div className="p-3 bg-white border border-slate-800 rounded-xl text-[11px] text-slate-500 leading-relaxed">
                  <div className="font-bold text-slate-400 mb-1.5">📌 Lấy API Key</div>
                  {cfgChannel === 'SHOPEE' && <><span className="text-[#EE4D2D] font-semibold">Shopee Open Platform</span><br/>→ Tạo app · lấy Partner ID + Key<br/>→ OAuth để lấy Access Token<br/>→ Shop ID từ Seller Center</>}
                  {cfgChannel === 'LAZADA' && <><span className="text-[#FF6900] font-semibold">Lazada Open Platform</span><br/>→ Tạo app · lấy App Key + Secret<br/>→ OAuth để lấy Access Token</>}
                  {cfgChannel === 'TIKTOK' && <><span className="text-[#0d9488] font-semibold">TikTok Shop Partner Center</span><br/>→ Tạo app · lấy App Key + Secret<br/>→ Shop ID + authorize lấy Token</>}
                  {cfgChannel === 'WEBSITE' && <><span className="text-[#d97706] font-semibold">Website của bạn</span><br/>→ Nhập Webhook Secret để verify<br/>→ API Base URL + API Key nếu có</>}
                </div>
              </div>

              {/* ── Form nhập key ── */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="bg-white border border-slate-800 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-bold text-[#1e293b]">
                      {CHANNELS.find(c => c.id === cfgChannel)?.icon}{' '}
                      Cấu hình API — {CHANNELS.find(c => c.id === cfgChannel)?.name}
                    </div>
                    {cfgValid && (
                      <span className={`text-xs font-semibold px-2 py-1 rounded-lg border ${
                        cfgValid.ok
                          ? 'text-cgreen bg-cgreen/10 border-cgreen/25'
                          : 'text-cred bg-cred/10 border-cred/25'
                      }`}>
                        {cfgValid.ok ? '✓ Hợp lệ' : `✗ ${cfgValid.errors[0]}`}
                      </span>
                    )}
                  </div>

                  {cfgLoading ? (
                    <div className="py-8 text-center text-slate-500 text-sm">Đang tải...</div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {(CHANNEL_CONFIG_FIELDS[cfgChannel] || []).map(field => (
                        <div key={field.key}>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">
                            {field.label}
                            {field.type === 'password' && <span className="ml-1 text-cyellow text-[10px]">🔒 Secret</span>}
                          </label>
                          <div className="relative">
                            <input
                              type={field.type === 'password' && !showPwd[field.key] ? 'password' : 'text'}
                              value={cfgForm[field.key] || ''}
                              onChange={e => {
                                setCfgForm(prev => ({ ...prev, [field.key]: e.target.value }))
                                setCfgValid(null)
                              }}
                              placeholder={field.hint}
                              className="w-full bg-surface2 border border-slate-700 text-[#1e293b] text-sm rounded-lg px-3 py-2 pr-10 placeholder:text-slate-500 focus:outline-none focus:border-cblue focus:ring-2 focus:ring-cblue/15 transition-colors font-mono"
                            />
                            {field.type === 'password' && (
                              <button
                                type="button"
                                onClick={() => setShowPwd(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#1e293b] text-[11px]"
                                title={showPwd[field.key] ? 'Ẩn' : 'Hiện'}
                              >
                                {showPwd[field.key] ? '🙈' : '👁️'}
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">{field.hint}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-800">
                    <button
                      onClick={handleValidate}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 text-slate-600 hover:border-slate-600 hover:text-[#1e293b] transition-colors"
                    >
                      🔍 Kiểm tra
                    </button>
                    <button
                      onClick={handleSaveConfig}
                      disabled={cfgSaving}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cblue text-white hover:opacity-90 transition-all disabled:opacity-50 shadow-sm"
                    >
                      {cfgSaving ? 'Đang lưu...' : '💾 Lưu cấu hình'}
                    </button>

                    {/* OAuth link */}
                    {cfgChannel in OAUTH_URLS && (() => {
                      const oauthFn = OAUTH_URLS[cfgChannel]
                      const redirectUri = `${window.location.origin}/oauth/callback`
                      let oauthUrl = null
                      try {
                        if (cfgChannel === 'SHOPEE' && cfgForm.partner_id)
                          oauthUrl = oauthFn(cfgForm.partner_id, redirectUri)
                        else if (cfgChannel === 'LAZADA' && cfgForm.app_key)
                          oauthUrl = oauthFn(cfgForm.app_key, redirectUri)
                        else if (cfgChannel === 'TIKTOK' && cfgForm.app_key)
                          oauthUrl = oauthFn(cfgForm.app_key, redirectUri)
                      } catch {}
                      return oauthUrl ? (
                        <a
                          href={oauthUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-cyellow/30 text-cyellow bg-cyellow/10 hover:bg-cyellow/20 transition-colors"
                        >
                          🔗 Tạo Access Token (OAuth)
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-500">Nhập {cfgChannel === 'SHOPEE' ? 'Partner ID' : 'App Key'} trước để tạo link OAuth</span>
                      )
                    })()}
                  </div>
                </div>

                {/* ── Quick sync panel ── */}
                <div className="bg-white border border-slate-800 rounded-2xl p-5 shadow-sm">
                  <div className="text-sm font-bold text-[#1e293b] mb-3">⚡ Đồng bộ nhanh</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: '📦 Tồn kho → Sàn',  desc: 'Đẩy số lượng tồn lên sàn', action: () => {
                          setSyncing(cfgChannel + '_inv')
                          const ch = CHANNELS.find(c => c.id === cfgChannel)
                          syncChannel(cfgChannel)
                            .then(r => toast.success(`✅ ${ch?.name}: sync ${r.updated} sản phẩm`))
                            .catch(e => toast.error(e.message))
                            .finally(() => setSyncing(null))
                        }, id: '_inv' },
                      { label: '💰 Giá → Sàn',       desc: 'Đẩy giá bán lên sàn',     action: () => handleSyncPrice(cfgChannel), id: '_price' },
                      { label: '🧾 Kéo đơn về',       desc: 'Lấy đơn mới 7 ngày',      action: () => handlePullOrders(cfgChannel), id: '_orders' },
                    ].map(btn => (
                      <button
                        key={btn.id}
                        onClick={btn.action}
                        disabled={!!syncing}
                        className="flex flex-col items-start gap-1 p-3 rounded-xl border border-slate-800 bg-surface2/50 hover:border-slate-700 text-left transition-all disabled:opacity-40 group"
                      >
                        <span className="text-xs font-bold text-[#1e293b] group-hover:text-cblue transition-colors">
                          {syncing === cfgChannel + btn.id ? (
                            <span className="inline-flex items-center gap-1">
                              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="28" strokeDashoffset="10"/></svg>
                              Đang chạy...
                            </span>
                          ) : btn.label}
                        </span>
                        <span className="text-[10px] text-slate-500">{btn.desc}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 text-[11px] text-slate-500">
                    💡 Cần lưu cấu hình API hợp lệ trước khi đồng bộ. Xem log tại tab 📋 Lịch sử đồng bộ.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB: SYNC LOGS ══ */}
          {activeTab === 'logs' && (
            <div className="bg-white border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#1e293b]">Lịch sử đồng bộ</span>
                <button onClick={loadData} className="text-xs text-cblue hover:underline">Làm mới</button>
              </div>
              {syncLogs.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-sm">
                  <div className="text-3xl mb-2">📋</div>
                  Chưa có lịch sử đồng bộ.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/50">
                  {syncLogs.map(log => {
                    const ch = CHANNELS.find(c => c.id === log.channel_id)
                    return (
                      <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface2 transition-colors">
                        <span className="text-lg shrink-0">{ch?.icon || '📡'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-medium ${ch?.colorClass || 'text-slate-300'}`}>{ch?.name}</span>
                            <SyncBadge status={log.status} />
                            <span className="text-[11px] text-slate-500 uppercase">{log.sync_type}</span>
                            {log.synced_count > 0 && (
                              <span className="text-[11px] text-slate-500">{log.synced_count} items</span>
                            )}
                          </div>
                          {log.message && <p className="text-[11px] text-slate-500 mt-0.5">{log.message}</p>}
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0">{fmtDate(log.created_at)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
