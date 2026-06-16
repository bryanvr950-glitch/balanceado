'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password: pass })
    if (error) { toast.error('Credenciales incorrectas'); setBusy(false); return }
    router.push('/stock'); router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#f4f1eb] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🦐</div>
          <h1 className="text-xl font-semibold text-gray-900">Plataforma Balanceado</h1>
          <p className="text-sm text-gray-400 mt-1">Grupo Camaronero · Beta</p>
        </div>
        <form onSubmit={login} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Correo</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="usuario@empresa.com" required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 outline-none focus:border-[#2d5a3d]" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Contraseña</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)}
              placeholder="••••••••" required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 outline-none focus:border-[#2d5a3d]" />
          </div>
          <button type="submit" disabled={busy}
            className="w-full py-3 rounded-xl text-sm font-semibold bg-[#2d5a3d] text-white hover:bg-[#245030] disabled:opacity-50 transition-colors">
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
