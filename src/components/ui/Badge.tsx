const CFG: Record<string, { bg: string; text: string; icon: string }> = {
  verde:       { bg: 'bg-green-50 border-green-300',  text: 'text-green-900',  icon: '✓' },
  amarillo:    { bg: 'bg-yellow-50 border-yellow-300',text: 'text-yellow-900', icon: '⚠' },
  rojo:        { bg: 'bg-red-50 border-red-300',      text: 'text-red-900',    icon: '✕' },
  sin_consumo: { bg: 'bg-gray-100 border-gray-200',   text: 'text-gray-400',   icon: '—' },
}

export function Badge({ nivel, dias }: { nivel: string; dias: number | null }) {
  const c = CFG[nivel] ?? CFG.sin_consumo
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border font-mono ${c.bg} ${c.text}`}>
      {c.icon} {dias !== null ? `${dias.toFixed(1)}d` : ''}
    </span>
  )
}
