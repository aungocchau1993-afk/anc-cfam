import { useState } from 'react'
import { toast } from 'sonner'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'

// ── Shared input class ────────────────────────────────────────────────────
const iCls = `
  w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-sm
  text-[#e6edf3] placeholder:text-slate-600 outline-none
  focus:border-cblue focus:ring-2 focus:ring-cblue/15 transition-all
`

// ── Logo / Brand ──────────────────────────────────────────────────────────
function Brand() {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cblue/30 to-cpurple/30 border border-cblue/25 mb-4 shadow-lg shadow-cblue/10">
        <span className="text-3xl">💼</span>
      </div>
      <h1 className="text-2xl font-black text-[#e6edf3] tracking-tight">ANC - CFAM</h1>
      <p className="text-xs text-slate-500 mt-1">Cash Flow & Asset Management · Business OS</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// VIEW: ĐĂNG NHẬP
// ─────────────────────────────────────────────────────────────────────────
function LoginView({ onGoRegister, onGoForgot }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isSupabaseConfigured || !supabase) {
      toast.error('Chưa cấu hình Supabase — kiểm tra file .env.local')
      return
    }
    if (!email.trim() || !password) { toast.error('Vui lòng nhập đầy đủ thông tin'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        if (error.message.includes('Invalid login credentials')) throw new Error('Email hoặc mật khẩu không đúng')
        if (error.message.includes('Email not confirmed'))       throw new Error('Email chưa được xác nhận — kiểm tra hộp thư của bạn')
        throw error
      }
      toast.success('✅ Đăng nhập thành công!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Email</label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          className={iCls} placeholder="ban@email.com"
          autoComplete="email" autoFocus required
        />
      </div>

      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Mật khẩu</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
            className={iCls + ' pr-11'} placeholder="••••••••"
            autoComplete="current-password" required
          />
          <button type="button" onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors text-lg">
            {showPw ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      <div className="flex justify-end -mt-1">
        <button type="button" onClick={onGoForgot}
          className="text-[11px] text-cblue hover:text-blue-300 transition-colors">
          Quên mật khẩu?
        </button>
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-3 rounded-xl bg-cblue hover:brightness-110 text-white text-sm font-black transition-all disabled:opacity-50 shadow-lg shadow-cblue/20 mt-1">
        {loading
          ? <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/>
              </svg>
              Đang đăng nhập…
            </span>
          : 'Đăng nhập'
        }
      </button>

      <p className="text-center text-xs text-slate-500 mt-2">
        Chưa có tài khoản?{' '}
        <button type="button" onClick={onGoRegister}
          className="text-cblue hover:text-blue-300 font-semibold transition-colors">
          Đăng ký ngay
        </button>
      </p>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// VIEW: ĐĂNG KÝ
// ─────────────────────────────────────────────────────────────────────────
function RegisterView({ onGoLogin }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)

  const strength = (() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 8)            s++
    if (/[A-Z]/.test(password))          s++
    if (/[0-9]/.test(password))          s++
    if (/[^A-Za-z0-9]/.test(password))   s++
    return s
  })()

  const strengthLabel = ['', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh'][strength]
  const strengthColor = ['', 'bg-cred', 'bg-cyellow', 'bg-cblue', 'bg-cgreen'][strength]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isSupabaseConfigured || !supabase) { toast.error('Chưa cấu hình Supabase'); return }
    if (password !== confirm) { toast.error('Mật khẩu xác nhận không khớp'); return }
    if (password.length < 6)  { toast.error('Mật khẩu tối thiểu 6 ký tự'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password })
      if (error) {
        if (error.message.includes('User already registered')) throw new Error('Email này đã được đăng ký — hãy đăng nhập')
        throw error
      }
      setDone(true)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="text-center py-4 flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-cgreen/20 border border-cgreen/30 flex items-center justify-center text-3xl">
          📧
        </div>
        <div>
          <div className="font-black text-lg text-cgreen">Kiểm tra hộp thư!</div>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Chúng tôi đã gửi link xác nhận đến<br/>
            <strong className="text-[#e6edf3]">{email}</strong>
          </p>
          <p className="text-xs text-slate-500 mt-3">Kiểm tra cả thư mục Spam nếu không thấy.</p>
        </div>
        <button onClick={onGoLogin}
          className="mt-2 px-6 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800 transition-colors">
          ← Quay lại đăng nhập
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Email</label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          className={iCls} placeholder="ban@email.com"
          autoComplete="email" autoFocus required
        />
      </div>

      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Mật khẩu</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
            className={iCls + ' pr-11'} placeholder="Tối thiểu 6 ký tự"
            autoComplete="new-password" required
          />
          <button type="button" onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-lg">
            {showPw ? '🙈' : '👁️'}
          </button>
        </div>
        {/* Strength bar */}
        {password.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
              {[1,2,3,4].map(i => (
                <div key={i} className={`flex-1 h-full rounded-full transition-all ${i <= strength ? strengthColor : 'bg-transparent'}`} />
              ))}
            </div>
            <span className={`text-[10px] font-bold ${['','text-cred','text-cyellow','text-cblue','text-cgreen'][strength]}`}>
              {strengthLabel}
            </span>
          </div>
        )}
      </div>

      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Xác nhận mật khẩu</label>
        <input
          type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
          className={iCls + (confirm && confirm !== password ? ' border-cred focus:border-cred' : '')}
          placeholder="Nhập lại mật khẩu"
          autoComplete="new-password" required
        />
        {confirm && confirm !== password && (
          <p className="text-[11px] text-cred mt-1">⚠ Mật khẩu không khớp</p>
        )}
      </div>

      <button type="submit" disabled={loading || (confirm && confirm !== password)}
        className="w-full py-3 rounded-xl bg-cgreen hover:brightness-110 text-white text-sm font-black transition-all disabled:opacity-50 shadow-lg shadow-cgreen/20 mt-1">
        {loading
          ? <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/>
              </svg>
              Đang tạo tài khoản…
            </span>
          : '🚀 Tạo tài khoản'
        }
      </button>

      <p className="text-center text-xs text-slate-500 mt-2">
        Đã có tài khoản?{' '}
        <button type="button" onClick={onGoLogin}
          className="text-cblue hover:text-blue-300 font-semibold transition-colors">
          Đăng nhập
        </button>
      </p>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// VIEW: QUÊN MẬT KHẨU
// ─────────────────────────────────────────────────────────────────────────
function ForgotView({ onGoLogin }) {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!supabase) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center py-4 flex flex-col items-center gap-4">
        <div className="text-4xl">✉️</div>
        <div>
          <div className="font-black text-lg text-cblue">Đã gửi link đặt lại!</div>
          <p className="text-sm text-slate-400 mt-2">Kiểm tra hộp thư <strong className="text-[#e6edf3]">{email}</strong></p>
        </div>
        <button onClick={onGoLogin}
          className="mt-2 px-6 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800 transition-colors">
          ← Quay lại đăng nhập
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="text-center mb-2">
        <p className="text-sm text-slate-400">Nhập email — chúng tôi gửi link đặt lại mật khẩu.</p>
      </div>
      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Email</label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          className={iCls} placeholder="ban@email.com"
          autoFocus required
        />
      </div>
      <button type="submit" disabled={loading}
        className="w-full py-3 rounded-xl bg-cblue hover:brightness-110 text-white text-sm font-black transition-all disabled:opacity-50">
        {loading ? 'Đang gửi…' : '📧 Gửi link đặt lại'}
      </button>
      <button type="button" onClick={onGoLogin}
        className="text-center text-xs text-slate-500 hover:text-slate-300 transition-colors">
        ← Quay lại đăng nhập
      </button>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// ROOT: AuthPage — quản lý view switching
// ─────────────────────────────────────────────────────────────────────────
export default function Login() {
  const [view, setView] = useState('login') // 'login' | 'register' | 'forgot'

  const TITLE = {
    login:    'Đăng nhập',
    register: 'Tạo tài khoản',
    forgot:   'Quên mật khẩu',
  }

  return (
    <div className="min-h-screen bg-[#080b10] flex items-center justify-center px-4 py-10">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cblue/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[200px] bg-cpurple/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-[#0d1117] border border-slate-800 rounded-2xl shadow-2xl shadow-black/50 p-8">
          <Brand />

          {/* View title */}
          <div className="mb-6">
            <h2 className="text-lg font-black text-[#e6edf3]">{TITLE[view]}</h2>
            <div className="h-0.5 w-8 bg-cblue rounded-full mt-2" />
          </div>

          {/* Views */}
          {view === 'login'    && <LoginView    onGoRegister={() => setView('register')} onGoForgot={() => setView('forgot')} />}
          {view === 'register' && <RegisterView onGoLogin={() => setView('login')} />}
          {view === 'forgot'   && <ForgotView   onGoLogin={() => setView('login')} />}
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-700 mt-6">
          Powered by <strong className="text-slate-600">ANC - CFAM</strong> · Business OS v4
        </p>
      </div>
    </div>
  )
}
