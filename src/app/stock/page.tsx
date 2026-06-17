'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { Badge } from '@/components/ui/Badge'
import { sacosATn, kgHa, diasInventario, nivelAlerta, fmtN, fmtTn, fmtDias } from '@/lib/calculos'
import { toast } from 'sonner'

export default function StockPage() {
  const [tab, setTab] = useState('stock')
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])
  const [stock, setStock] = useState<any[]>([])
  const [campos, setCampos] = useState<any[]>([])
  const [prods, setProds] = useState<any[]>([])
  const [edits, setEdits] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [caf, setCAF] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const router = useRouter()
  const supabase = supabaseBrowser()

  // Verificar autenticación al cargar
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
      } else {
        setAuthChecked(true)
        loadData()
      }
    })
  }, [])

  async function loadData() {
    const [stockRes, camposRes, prodsRes] = await Promise.all([
      fetch('/api/stock').then(r => r.json()),
      supabase.from('campos').select('id,codigo,nombre,hectareas,empresa_id,empresa:empresas(codigo,nombre)').then(r => r.data ?? []),
      supabase.from('productos').select('*').then(r => r.data ?? []),
    ])
    setStock(stockRes)
    setCampos(camposRes as any[])
    setProds(prodsRes as any[])
    setLoading(false)
  }

  const porCampo = new Map<string, any[]>()
  for (const f of stock) {
    if (!porCampo.has(f.campo_id)) porCampo.set(f.campo_id, [])
    porCampo.get(f.campo_id)!.push(f)
  }

  function getEdit(campoId: string, prodId: string, fila: any) {
    return edits[campoId]?.[prodId] ?? {
      s: fila.stock_caf_sacos, i: fila.ingreso_sacos, c: fila.consumo_diario_sacos
    }
  }

  function setEdit(campoId: string, prodId: string, key: string, val: number) {
    setEdits((prev: any) => {
      const fila = stock.find(f => f.campo_id === campoId && f.producto_id === prodId)
      const cur = prev[campoId]?.[prodId] ?? { s: fila?.stock_caf_sacos ?? 0, i: fila?.ingreso_sacos ?? 0, c: fila?.consumo_diario_sacos ?? 0 }
      return { ...prev, [campoId]: { ...(prev[campoId] ?? {}), [prodId]: { ...cur, [key]: val } } }
    })
  }

  async function guardar() {
    if (!Object.keys(edits).length) { toast.error('Sin cambios'); return }
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Sesion expirada, vuelve a ingresar'); setSaving(false); return }
      const userId = session.user.id
      const token = session.access_token
      for (const [campoId, prodMap] of Object.entries(edits)) {
        const detalle = Object.entries(prodMap as any).map(([producto_id, v]: any) => ({
          producto_id, stock_caf_sacos: v.s, ingreso_sacos: v.i, consumo_diario_sacos: v.c,
        }))
        const sinEditar = stock.filter(f => f.campo_id === campoId && !(prodMap as any)[f.producto_id])
          .map(f => ({ producto_id: f.producto_id, stock_caf_sacos: f.stock_caf_sacos, ingreso_sacos: f.ingreso_sacos, consumo_diario_sacos: f.consumo_diario_sacos }))
        const res = await fetch("/api/snapshots", {
         method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ fecha, campo_id: campoId, detalle: [...detalle, ...sinEditar], user_id: userId }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
      }
      await loadData()
      setEdits({})
      toast.success(`✅ ${fecha} guardado`)
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  if (!authChecked) return (
    <div className="min-h-screen bg-[#f4f1eb] flex items-center justify-center">
      <div className="text-gray-400 text-sm">Verificando sesión…</div>
    </div>
  )

  const totalSacos = stock.reduce((s, f) => s + f.stock_total_sacos, 0)
  const enRojo = new Set(stock.filter(f => f.nivel_alerta === 'rojo').map(f => f.campo_id)).size
  const hayEdits = Object.keys(edits).length > 0

  return (
    <div className="min-h-screen bg-[#f4f1eb]">
      <header className="bg-[#2d5a3d] text-white px-4 py-3 flex items-center gap-2 sticky top-0 z-40 shadow-md flex-wrap">
        <span className="text-lg">🦐</span>
        <div className="flex-1">
          <div className="font-semibold text-sm">Stock Balanceado</div>
          <div className="text-[10px] opacity-60">Grupo Camaronero · Beta</div>
        </div>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
          className="bg-white/15 border border-white/25 rounded-full px-3 py-1.5 text-xs text-white outline-none" />
        <button onClick={() => setCAF(true)}
          className="bg-white/90 text-[#2d5a3d] text-xs font-semibold px-3 py-1.5 rounded-full">📷 CAF</button>
        <button onClick={guardar} disabled={saving || !hayEdits}
          className={`text-xs px-3 py-1.5 rounded-full font-semibold ${hayEdits ? 'bg-white text-[#2d5a3d]' : 'bg-white/15 text-white/50 cursor-not-allowed'}`}>
          {saving ? '⏳' : '💾'} Guardar
        </button>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          className="text-white/50 hover:text-white text-xs px-2">⎋</button>
      </header>

      <div className="max-w-5xl mx-auto px-3 py-4">
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Stock total', value: fmtN(totalSacos), sub: 'sacos' },
            { label: 'TN total', value: fmtTn(sacosATn(totalSacos)), sub: 'toneladas' },
            { label: 'Campos en rojo', value: String(enRojo), sub: 'de 11', alert: enRojo > 0 },
          ].map(k => (
            <div key={k.label} className={`border rounded-xl p-3 text-center ${k.alert ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{k.label}</div>
              <div className={`text-lg font-bold font-mono ${k.alert ? 'text-red-700' : 'text-[#2d5a3d]'}`}>{k.value}</div>
              <div className="text-[10px] text-gray-400">{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-1 mb-4 bg-[#edeae2] p-1 rounded-xl w-fit">
          {[['stock','📦 Stock'],['consumo','📊 Consumo'],['historial','📁 Historial']].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
              {l}
            </button>
          ))}
        </div>

        {loading && <div className="text-center py-12 text-gray-400 text-sm">Cargando…</div>}

        {!loading && tab === 'stock' && Array.from(porCampo.entries()).map(([campoId, filas]) => {
          const campo = campos.find(c => c.id === campoId)
          const filasE = filas.map(f => {
            const e = getEdit(campoId, f.producto_id, f)
            const total = e.s + e.i
            const dias = diasInventario(total, e.c)
            return { ...f, _s: e.s, _i: e.i, _c: e.c, _total: total, _tn: sacosATn(total), _dias: dias, _nivel: nivelAlerta(dias) }
          })
          const totSacos = filasE.reduce((s, f) => s + f._total, 0)
          const totConsumo = filasE.reduce((s, f) => s + f._c, 0)
          const diasC = diasInventario(totSacos, totConsumo)
          return (
            <div key={campoId} className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3">
              <div className="bg-gray-50 border-b px-3 py-2 flex items-center gap-2">
                <span className="font-semibold text-sm">🦐 {filas[0].campo_nombre}</span>
                <span className="text-xs text-gray-400">{filas[0].empresa_nombre} · {campo?.hectareas?.toLocaleString('es')} ha</span>
                <div className="ml-auto"><Badge nivel={nivelAlerta(diasC)} dias={diasC} /></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      {['Balanceado','Stock CAF','+ Ingreso','Total','TN','Consumo/día','Días','Alerta'].map(h => (
                        <th key={h} className="px-2.5 py-1.5 text-left text-[10px] uppercase tracking-wide font-medium text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filasE.map(f => (
                      <tr key={f.producto_id} className="border-b border-gray-100 last:border-0">
                        <td className="px-2.5 py-1.5 font-medium">{f.producto_nombre}</td>
                        <td className="px-2.5 py-1.5"><NumInput val={f._s} onChange={v => setEdit(campoId, f.producto_id, 's', v)} /></td>
                        <td className="px-2.5 py-1.5"><NumInput val={f._i} cls="border-green-200 bg-green-50" onChange={v => setEdit(campoId, f.producto_id, 'i', v)} /></td>
                        <td className="px-2.5 py-1.5 font-semibold font-mono">{f._total > 0 ? fmtN(f._total) : '—'}</td>
                        <td className="px-2.5 py-1.5 font-mono text-gray-500">{f._total > 0 ? fmtTn(f._tn) : '—'}</td>
                        <td className="px-2.5 py-1.5"><NumInput val={f._c} onChange={v => setEdit(campoId, f.producto_id, 'c', v)} /></td>
                        <td className="px-2.5 py-1.5 font-mono font-medium">{fmtDias(f._dias)}</td>
                        <td className="px-2.5 py-1.5"><Badge nivel={f._nivel} dias={f._dias} /></td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 border-t font-semibold">
                      <td className="px-2.5 py-1.5 text-gray-600">Total</td>
                      <td colSpan={2} className="px-2.5 py-1.5 text-gray-400 text-[10px]">—</td>
                      <td className="px-2.5 py-1.5 font-mono">{fmtN(totSacos)}</td>
                      <td className="px-2.5 py-1.5 font-mono text-gray-500">{fmtTn(sacosATn(totSacos))}</td>
                      <td className="px-2.5 py-1.5 font-mono">{fmtN(totConsumo)}</td>
                      <td className="px-2.5 py-1.5 font-mono">{fmtDias(diasC)}</td>
                      <td className="px-2.5 py-1.5"><Badge nivel={nivelAlerta(diasC)} dias={diasC} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}

        {!loading && tab === 'consumo' && <TabConsumo stock={stock} campos={campos} fecha={fecha} />}
        {!loading && tab === 'historial' && <TabHistorial />}
      </div>

      {caf && <ModalCAF campos={campos} productos={prods} onClose={() => setCAF(false)}
        onAplicar={(campoId: string, prodId: string, saldo: any, consumo: any) => {
          if (saldo !== null) setEdit(campoId, prodId, 's', saldo)
          if (consumo !== null) setEdit(campoId, prodId, 'c', consumo)
          setCAF(false)
          toast.success('Datos CAF aplicados — recuerda guardar')
        }} />}
    </div>
  )
}

function NumInput({ val, onChange, cls = '' }: { val: number; onChange: (v: number) => void; cls?: string }) {
  const [local, setLocal] = useState(val > 0 ? String(val) : '')
  useEffect(() => { setLocal(val > 0 ? String(val) : '') }, [val])
  return (
    <input type="number" value={local} min={0} placeholder="0"
      className={`w-20 text-right py-1 px-1.5 text-xs rounded border font-mono outline-none focus:ring-1 focus:ring-green-500 ${val > 0 ? 'bg-yellow-50 border-yellow-300' : `bg-gray-50 border-gray-300 ${cls}`}`}
      onChange={e => { setLocal(e.target.value); const n = parseFloat(e.target.value); onChange(isNaN(n) ? 0 : n) }} />
  )
}

function TabConsumo({ stock, campos, fecha }: any) {
  const BALS = ['SHRIMP PELLET #5', 'OPTILINE ME / NG', 'LORICA NG']
  const gtotC = stock.reduce((s: number, f: any) => s + f.consumo_diario_sacos, 0)
  const gtotTn = gtotC * 0.025
  const gtotHa = campos.reduce((s: number, c: any) => s + c.hectareas, 0)
  return (
    <div>
      <div className="text-sm font-semibold text-[#2d5a3d] mb-3">📅 {new Date(fecha + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-[10px] text-gray-400 uppercase mb-1">Consumo sacos/día</div>
          <div className="text-lg font-bold font-mono text-[#2d5a3d]">{fmtN(gtotC)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-[10px] text-gray-400 uppercase mb-1">Consumo TN/día</div>
          <div className="text-lg font-bold font-mono text-[#2d5a3d]">{fmtTn(gtotTn)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-[10px] text-gray-400 uppercase mb-1">Kg/Ha promedio</div>
          <div className="text-lg font-bold font-mono text-[#2d5a3d]">{gtotHa > 0 ? (gtotTn * 1000 / gtotHa).toFixed(2) : '—'}</div>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="border-b">
              <th className="text-left px-3 py-2 text-gray-400 text-[10px] uppercase" rowSpan={2}>Camaronera</th>
              {BALS.map(b => <th key={b} colSpan={2} className="text-center px-2 py-1.5 text-[10px] uppercase bg-gray-50 border-l">{b.split(' ')[0]}</th>)}
              <th className="text-right px-3 py-2 text-gray-400 text-[10px] uppercase" rowSpan={2}>Kg/Ha</th>
            </tr>
            <tr className="border-b">
              {BALS.map(b => (<><th key={`${b}s`} className="text-right px-2 py-1 text-[10px] text-gray-400 bg-gray-50 border-l">Sacos</th><th key={`${b}t`} className="text-right px-2 py-1 text-[10px] text-gray-400 bg-gray-50">TN</th></>))}
            </tr>
          </thead>
          <tbody>
            {Array.from(new Map(stock.map((f: any) => [f.campo_id, f])).values()).map((cf: any) => {
              const campo = campos.find((c: any) => c.id === cf.campo_id)
              const ha = campo?.hectareas ?? 1
              const filas = stock.filter((f: any) => f.campo_id === cf.campo_id)
              const totalTn = filas.reduce((s: number, f: any) => s + sacosATn(f.consumo_diario_sacos), 0)
              return (
                <tr key={cf.campo_id} className="border-b border-gray-100">
                  <td className="px-3 py-1.5 font-medium">🦐 {cf.campo_nombre}</td>
                  {BALS.map(bal => {
                    const f = filas.find((x: any) => x.producto_nombre === bal)
                    const s = f?.consumo_diario_sacos ?? 0
                    return (<><td key={`${bal}s`} className="text-right px-2 py-1.5 font-mono border-l">{s || '—'}</td><td key={`${bal}t`} className="text-right px-2 py-1.5 font-mono text-gray-500">{s > 0 ? sacosATn(s).toFixed(2) : '—'}</td></>)
                  })}
                  <td className="text-right px-3 py-1.5 font-semibold font-mono">{ha > 0 ? (kgHa(totalTn, ha) ?? 0).toFixed(2) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TabHistorial() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  async function cargar() {
    setLoading(true)
    const r = await fetch('/api/snapshots')
    setData(await r.json())
    setLoading(false)
  }
  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex gap-3">
        <button onClick={cargar} className="bg-[#2d5a3d] text-white text-xs font-semibold px-4 py-1.5 rounded-lg">Cargar historial</button>
      </div>
      {loading && <div className="text-center py-8 text-gray-400 text-sm">Cargando…</div>}
      {!loading && data.length === 0 && <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">📭 Presiona "Cargar historial".</div>}
      {!loading && data.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>{['Fecha','Campo','Total sacos','TN','Consumo/día','Días'].map(h => (
                <th key={h} className="text-left px-3 py-2 text-gray-400 uppercase text-[10px] font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {data.map((s: any) => {
                const total = s.detalle?.reduce((a: number, d: any) => a + d.stock_total_sacos, 0) ?? 0
                const totalTn = s.detalle?.reduce((a: number, d: any) => a + Number(d.stock_total_tn), 0) ?? 0
                const consumo = s.detalle?.reduce((a: number, d: any) => a + d.consumo_diario_sacos, 0) ?? 0
                const dias = consumo > 0 ? (total / consumo) : null
                return (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                    <td className="px-3 py-2 font-medium">{s.campo?.nombre ?? '—'}</td>
                    <td className="px-3 py-2 font-mono font-semibold">{fmtN(total)}</td>
                    <td className="px-3 py-2 font-mono text-gray-500">{fmtTn(totalTn)}</td>
                    <td className="px-3 py-2 font-mono">{fmtN(consumo)}</td>
                    <td className="px-3 py-2"><Badge nivel={nivelAlerta(dias)} dias={dias} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ModalCAF({ campos, productos, onClose, onAplicar }: any) {
  const [campoId, setCampoId] = useState('')
  const [prodId, setProdId] = useState('')
  const [preview, setPreview] = useState('')
  const [estado, setEstado] = useState('idle')
  const [resultado, setResult] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = supabaseBrowser()

  async function procesar(file: File) {
    if (!campoId || !prodId) { toast.error('Selecciona campo y balanceado primero'); return }
    setEstado('subiendo')
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${campoId}/${Date.now()}.${ext}`
      const { data: up, error: upErr } = await supabase.storage.from('caf-imagenes').upload(path, file)
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('caf-imagenes').getPublicUrl(up.path)
      const { data: reg, error: regErr } = await supabase.from('caf_registros')
        .insert({ campo_id: campoId, producto_id: prodId, fecha_caf: new Date().toISOString().split('T')[0], imagen_url: publicUrl, subido_por: (await supabase.auth.getUser()).data.user!.id })
        .select('id').single()
      if (regErr) throw regErr
      setEstado('analizando')
      const b64 = await new Promise<string>((res, rej) => { const r2 = new FileReader(); r2.onload = e => res((e.target?.result as string).split(',')[1]); r2.onerror = rej; r2.readAsDataURL(file) })
      const { data: { session } } = await supabase.auth.getSession()
const resp = await fetch('/api/caf/analizar', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
  body: JSON.stringify({ imageBase64: b64, mediaType: file.type, campoId, productoId: prodId, cafRegistroId: reg.id }),
})      if (!resp.ok) throw new Error((await resp.json()).error)
      const r = await resp.json()
      setResult({ saldo: r.saldo_sacos, consumo: r.consumo_sacos, notas: r.notas })
      setEstado('listo')
    } catch (e: any) { toast.error(e.message ?? 'Error al procesar'); setEstado('error') }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-base">📷 Cargar CAF</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-2"><strong>Paso 1:</strong> ¿A qué campo corresponde?</p>
            <div className="grid grid-cols-3 gap-1.5">
              {campos.map((c: any) => (
                <button key={c.id} onClick={() => setCampoId(c.id)}
                  className={`py-2 px-2 rounded-lg border text-xs font-medium text-center ${campoId === c.id ? 'border-[#2d5a3d] bg-[#2d5a3d] text-white' : 'border-gray-200 bg-gray-50'}`}>
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>
          {campoId && (
            <div>
              <p className="text-xs text-gray-500 mb-2"><strong>Paso 2:</strong> ¿Qué balanceado?</p>
              <select value={prodId} onChange={e => setProdId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 outline-none">
                <option value="">— Selecciona —</option>
                {productos.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          )}
          {campoId && prodId && estado === 'idle' && (
            <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#2d5a3d]">
              <div className="text-3xl mb-2">📄</div>
              <p className="text-sm text-gray-500">Toca para seleccionar imagen</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) procesar(f) }} />
            </div>
          )}
          {preview && <img src={preview} alt="CAF" className="w-full rounded-lg border" />}
          {(estado === 'subiendo' || estado === 'analizando') && (
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-[#2d5a3d] rounded-full animate-spin" />
              <span className="text-sm text-gray-500">{estado === 'subiendo' ? 'Subiendo imagen…' : 'Analizando con IA…'}</span>
            </div>
          )}
          {estado === 'listo' && resultado && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-2">
              <p className="text-sm font-semibold text-green-800">✅ Datos extraídos</p>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Saldo (sacos)</span><span className="font-semibold font-mono text-green-800">{resultado.saldo ?? 'No detectado'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Consumo (sacos/día)</span><span className="font-semibold font-mono text-green-800">{resultado.consumo ?? 'No detectado'}</span></div>
            </div>
          )}
          {estado === 'error' && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">❌ Error al procesar.</div>}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancelar</button>
          <button disabled={estado !== 'listo'} onClick={() => { if (resultado && campoId && prodId) onAplicar(campoId, prodId, resultado.saldo, resultado.consumo) }}
            className="flex-1 py-2.5 text-sm font-semibold bg-[#2d5a3d] text-white rounded-xl disabled:opacity-40">
            Aplicar al stock
          </button>
        </div>
      </div>
    </div>
  )
}
