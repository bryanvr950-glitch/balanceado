import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase-server'

const PROMPT = `Eres un asistente que extrae datos de planillas CAF de camaroneras.
Extrae EXACTAMENTE estos dos valores:
1. SALDO FINAL — el último valor de la fila "SALDOS". En KILOGRAMOS.
2. CONSUMO DEL ÚLTIMO DÍA — el último valor no-cero de la fila "CONSUMOS". En KILOGRAMOS.
Responde SOLO con este JSON sin markdown:
{"saldo_kg": <número o null>, "consumo_kg": <número o null>, "notas": ""}`

export async function POST(req: NextRequest) {
  const s = supabaseServer()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { imageBase64, mediaType, campoId, productoId, cafRegistroId } = await req.json()

  await s.from('caf_registros').update({ estado: 'procesando' }).eq('id', cafRegistroId)

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    })
    const raw = msg.content.map((c: any) => c.type === 'text' ? c.text : '').join('').replace(/```json|```/g, '').trim()
    const result = JSON.parse(raw)
    const saldo_kg = typeof result.saldo_kg === 'number' ? result.saldo_kg : null
    const consumo_kg = typeof result.consumo_kg === 'number' ? result.consumo_kg : null

    const admin = supabaseAdmin()
    await admin.from('caf_items').insert({
      caf_registro_id: cafRegistroId,
      saldo_kg_extraido: saldo_kg,
      consumo_kg_extraido: consumo_kg,
      notas_ia: result.notas ?? '',
      modelo_ia: msg.model,
      tokens_usados: msg.usage.input_tokens + msg.usage.output_tokens,
    })
    await admin.from('caf_registros').update({ estado: 'extraido', producto_id: productoId ?? null }).eq('id', cafRegistroId)

    return NextResponse.json({
      ok: true,
      saldo_kg,
      consumo_kg,
      saldo_sacos: saldo_kg !== null ? Math.round(saldo_kg / 25 * 10) / 10 : null,
      consumo_sacos: consumo_kg !== null ? Math.round(consumo_kg / 25 * 10) / 10 : null,
      notas: result.notas ?? '',
    })
  } catch (err) {
    await s.from('caf_registros').update({ estado: 'error' }).eq('id', cafRegistroId)
    return NextResponse.json({ error: 'Error al procesar imagen' }, { status: 500 })
  }
}
