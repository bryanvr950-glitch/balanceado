import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const s = supabaseServer()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { fecha, campo_id, detalle } = await req.json()
  const { data: snap, error: e1 } = await s
    .from('stock_snapshots')
    .upsert({ fecha, campo_id, creado_por: user.id, fuente: 'manual' }, { onConflict: 'fecha,campo_id' })
    .select('id').single()
  if (e1 || !snap) return NextResponse.json({ error: e1?.message }, { status: 500 })
  await s.from('snapshot_detalle').delete().eq('snapshot_id', snap.id)
  const { error: e2 } = await s.from('snapshot_detalle').insert(
    detalle.map((d: any) => ({ ...d, snapshot_id: snap.id }))
  )
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  await s.rpc('refresh_stock')
  return NextResponse.json({ ok: true, snapshot_id: snap.id })
}

export async function GET(req: NextRequest) {
  const s = supabaseServer()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { data, error } = await s
    .from('stock_snapshots')
    .select(`id,fecha,campo_id,fuente,
      campo:campos(nombre),
      detalle:snapshot_detalle(
        producto_id,stock_total_sacos,stock_total_tn,
        consumo_diario_sacos,dias_inventario,nivel_alerta,
        producto:productos(nombre))`)
    .order('fecha', { ascending: false })
    .limit(60)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
