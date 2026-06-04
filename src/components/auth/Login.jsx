import { useState } from 'react'
import { toast } from 'sonner'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isSupabaseConfigured || !supabase) {
      toast.error('Chưa cấu hình Supabase')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
      toast.success('Đăng nhập thành công')
    } catch (error) {
      toast.error(error.message || 'Không đăng nhập được')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-surface border border-border rounded-xl p-6 shadow-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-black text-[#e6edf3]">ANC - CFAM</h1>
          <div className="text-xs text-muted mt-1">Đăng nhập để quản lý dòng tiền</div>
        </div>

        <div className="mb-3">
          <label className="text-xs text-muted block mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="input-base"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="mb-5">
          <label className="text-xs text-muted block mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="input-base"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 disabled:opacity-60 disabled:cursor-not-allowed">
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  )
}
