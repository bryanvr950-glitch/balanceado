import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get('code')
  if (code) {
    const s = supabaseServer()
    await s.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(new URL('/stock', req.url))
}
