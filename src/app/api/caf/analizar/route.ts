import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
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
  if (!user)
