import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { z } from 'zod'

const Schema = z.object({
  fecha:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  campo_id: z.string().uuid(),
  detalle:  z.array(z.object({
    producto_id:          z.string().uuid(),
    stock_caf_sacos:      z.number().min(0),
    ingreso_sacos:        z.number().min(0).default(0),
    consumo_diario_sacos: z.number().min(0),
  })).min(1),
})

export async function POST(req: NextRequest) {
  const s = supabaseServer()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const parsed = Schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { fecha, campo_id, detalle } = parsed.data

  // Upsert snapshot
  const { data: snap, error: e1 } = await s
    .from('stock_snapshots')
    .upsert({ fecha, campo_id, creado_por: user.id, fuente: 'manual' }, { onConflict: 'fecha,campo_id' })
    .select('id').single()

  if (e1 || !snap) return NextResponse.json({ error: e1?.message }, { status: 500 })

  // Borrar detalle anterior e insertar nuevo
  await s.from('snapshot_detalle').delete().eq('snapshot_id', snap.id)
  const { error: e2 } = await s.from('snapshot_detalle').insert(
    detalle.map(d => ({ ...d, snapshot_id: snap.id }))
  )
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  // Refrescar vista
  await s.rpc('refresh_stock')

  return NextResponse.json({ ok: true, snapshot_id: snap.id })
}

export async function GET(req: NextRequest) {
  const s = supabaseServer()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const campo_id = searchParams.get('campo_id')

  let q = s.from('stock_snapshots')
    .select(`id,fecha,campo_id,fuente,
      campo:campos(nombre),
      detalle:snapshot_detalle(
        producto_id,stock_total_sacos,stock_total_tn,
        consumo_diario_sacos,dias_inventario,nivel_alerta,
        producto:productos(nombre))`)
    .order('fecha', { ascending: false })
    .limit(60)

  if (campo_id) q = q.eq('campo_id', campo_id)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
