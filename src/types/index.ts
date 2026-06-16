export interface Campo {
  id: string
  codigo: string
  nombre: string
  hectareas: number
  empresa_id: string
  empresa?: { codigo: string; nombre: string }
}

export interface Producto {
  id: string
  codigo: string
  nombre: string
  peso_saco_kg: number
}

export interface StockFila {
  campo_id: string
  campo_nombre: string
  empresa_nombre: string
  hectareas: number
  producto_id: string
  producto_nombre: string
  stock_caf_sacos: number
  ingreso_sacos: number
  stock_total_sacos: number
  stock_total_tn: number
  consumo_diario_sacos: number
  dias_inventario: number | null
  nivel_alerta: string
}
