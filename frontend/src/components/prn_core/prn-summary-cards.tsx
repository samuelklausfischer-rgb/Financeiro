import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/formatters'
import { TrendingDown, TrendingUp, Landmark, ArrowRightLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const toNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function PrnSummaryCards({
  summary,
  details,
  crossAnalysis,
  referenceDateUsed,
}: {
  summary?: any
  details?: any
  crossAnalysis?: any
  referenceDateUsed?: string
}) {
  if (!summary && !details && !crossAnalysis) return null

  const crossRows = Array.isArray(crossAnalysis?.rows) ? crossAnalysis.rows : []
  const categories = Array.isArray(details?.despesasPorCategoria) ? details.despesasPorCategoria : []
  const receipts = Array.isArray(details?.receipts) ? details.receipts : []
  const referenceMonth = typeof referenceDateUsed === 'string' ? referenceDateUsed.slice(0, 7) : ''

  const totalRecebido = toNumber(summary?.totalRecebido ?? summary?.totalReceived ?? summary?.total_recebido)

  const receiptMonths = Array.from(
    new Set(
      receipts
        .map((receipt) => String(receipt?.data || ''))
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .map((date) => date.slice(0, 7)),
    ),
  )

  const totalRecebidoInconsistente =
    Boolean(referenceMonth) &&
    receiptMonths.length > 0 &&
    !receiptMonths.includes(referenceMonth) &&
    totalRecebido > 0

  const totalDespesas = toNumber(
    summary?.totalDespesas ?? summary?.totalExpenses ?? summary?.total_despesas,
  )

  const classificacaoPendente = categories.reduce(
    (acc, category) =>
      String(category?.categoria || '').toLowerCase() === 'indefinido' ? acc + toNumber(category?.count) : acc,
    0,
  )

  const alertasCriticos = crossRows.filter((row) => Boolean(row?.alertaDivergencia25)).length
  const estaveis = crossRows.filter((row) => row?.grupoMensal === 'exato').length
  const novosRegistros = crossRows.filter((row) => row?.grupoMensal === 'sem_historico').length

  const cards = [
    {
      label: 'Total Despesas',
      value: totalDespesas,
      icon: TrendingDown,
      color: 'text-[#DC3545]',
      glow: 'shadow-[#DC3545]/20',
    },
    {
      label: 'Total Recebido',
      value: totalRecebido,
      icon: TrendingUp,
      color: 'text-[#28A745]',
      glow: 'shadow-[#28A745]/20',
    },
    {
      label: 'Saldo Bancário',
      value: summary?.saldoBancario ?? summary?.bankBalance ?? summary?.saldo_bancario ?? 0,
      icon: Landmark,
      color: 'text-[#0066CC]',
      glow: 'shadow-[#0066CC]/20',
    },
    {
      label: 'Transferência Necessária',
      value:
        summary?.transferenciaNecessaria ??
        summary?.necessaryTransfer ??
        summary?.transferencia_necessaria ??
        0,
      icon: ArrowRightLeft,
      color: 'text-[#FF9800]',
      glow: 'shadow-[#FF9800]/20',
    },
  ]

  const alerts = [
    { label: 'Alertas Críticos', count: alertasCriticos, color: 'text-red-400', bg: 'bg-red-400/10' },
    { label: 'Classificação Pendente', count: classificacaoPendente, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'Estáveis', count: estaveis, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Novos Registros', count: novosRegistros, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-2 animate-fade-in-up">
        {cards.map((c, i) => (
          <Card 
            key={i} 
            className={cn(
              "hover-glass transition-all duration-300 border-white/5",
              "hover:scale-[1.02] hover:shadow-lg",
              c.glow
            )}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 px-4 pt-4">
              <CardTitle className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                {c.label}
              </CardTitle>
              <c.icon className={cn("h-4 w-4", c.color)} />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className={cn("text-xl font-black tracking-tighter", c.color)}>
                {formatCurrency(c.value || 0)}
              </div>
              {c.label === 'Total Recebido' && totalRecebidoInconsistente && (
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-amber-400/80">
                  Valor retornado pelo motor com datas de recebimento fora do mes da planilha.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        {alerts.map((a, i) => (
          <div key={i} className={cn("flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all")}>
             <div className="space-y-0.5">
               <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">{a.label}</p>
               <p className={cn("text-xl font-black tracking-tighter", a.color)}>{a.count}</p>
             </div>
             <div className={cn("p-2 rounded-lg", a.bg)}>
                <div className={cn("w-2 h-2 rounded-full", a.color.replace('text-', 'bg-'))} />
             </div>
          </div>
        ))}
      </div>
    </div>
  )
}
