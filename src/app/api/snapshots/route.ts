import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const { fecha, campo_id, detalle, user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdmin()
  const { data: snap, error: e1 } = await admin
    .from('stock_snapshots')
    .upsert({ fecha, campo_id, creado_por: user_id, fuente: 'manual' }, { onConflict: 'fecha,campo_id' })
    .select('id').single()

  if (e1 || !snap) return NextResponse.json({ error: e1?.message }, { status: 500 })

  await admin.from('snapshot_detalle').delete().eq('snapshot_id', snap.id)
  const { error: e2 } = await admin.from('snapshot_detalle').insert(
    detalle.map((d: any) => ({ ...d, snapshot_id: snap.id }))
  )
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  await admin.rpc('refresh_stock')
  return NextResponse.json({ ok: true, snapshot_id: snap.id })
}

export async function GET() {
  const admin = getAdmin()
  const { data, error } = await admin
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
