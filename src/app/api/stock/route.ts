import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET() {
  const s = supabaseServer()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { data, error } = await s
    .from('mv_stock_ultimo')
    .select('*')
    .order('empresa_codigo')
    .order('campo_nombre')
    .order('producto_nombre')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
