import type { NivelAlerta } from '@/types'

export const PESO_SACO_KG = 25

export function sacosATn(sacos: number) { return sacos * 0.025 }
export function kgHa(tn: number, ha: number) { return ha > 0 ? (tn * 1000) / ha : null }
export function diasInventario(stock: number, consumo: number) {
  return consumo > 0 ? stock / consumo : null
}
export function nivelAlerta(dias: number | null): NivelAlerta {
  if (dias === null) return 'sin_consumo'
  if (dias >= 7)    return 'verde'
  if (dias >= 4)    return 'amarillo'
  return 'rojo'
}
export function fmtN(n: number) { return n.toLocaleString('es-EC') }
export function fmtTn(n: number) { return n.toFixed(2) }
export function fmtDias(n: number | null) { return n !== null ? n.toFixed(1) : '—' }
