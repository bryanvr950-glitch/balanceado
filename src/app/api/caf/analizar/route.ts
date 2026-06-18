import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const PROMPT = `Eres un asistente que extrae datos de planillas CAF de camaroneras.
Extrae EXACTAMENTE estos dos valores:
1. SALDO FINAL — el último valor de la fila "SALDOS". En KILOGRAMOS.
2. CONSUMO DEL ÚLTIMO DÍA — el último valor no-cero de la fila "CONSUMOS". En KILOGRAMOS.
Responde SOLO con este JSON sin markdown:
{"saldo_kg": <número o null>, "consumo_kg": <número o null>, "notas": ""}`

export async function POST(req: NextRequest) {
  const admin = supabaseAdmin()
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { imageBase64, mediaType, campoId, productoId, cafRegistroId } = await req.json()
  await admin.from('caf_registros').update({ estado: 'procesando' }).eq('id', cafRegistroId)
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mediaType, data: imageBase64 } },
              { text: PROMPT }
            ]
          }]
        })
      }
    )
    const geminiData = await response.json()
    console.error('GEMINI RESPONSE:', JSON.stringify(geminiData).slice(0, 500))
    const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    console.error('GEMINI RAW:', raw)
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found: ' + raw.slice(0, 200))
    const result = JSON.parse(match[0])
    const saldo_kg = typeof result.saldo_kg === 'number' ? result.saldo_kg : null
    const consumo_kg = typeof result.consumo_kg === 'number' ? result.consumo_kg : null
    await admin.from('caf_items').insert({
      caf_registro_id: cafRegistroId,
      saldo_kg_extraido: saldo_kg,
      consumo_kg_extraido: consumo_kg,
      notas_ia: result.notas ?? '',
      modelo_ia: 'gemini-1.5-flash',
      tokens_usados: 0,
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
  } catch (err: any) {
    console.error('CAF ERROR:', err?.message ?? err)
    await admin.from('caf_registros').update({ estado: 'error' }).eq('id', cafRegistroId)
    return NextResponse.json({ error: err?.message ?? 'Error al procesar imagen' }, { status: 500 })
  }
}
