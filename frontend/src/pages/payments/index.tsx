import { useState, useEffect } from 'react'
import { CreditCard, Filter, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getPagamentos } from '@/services/pagamentos'
import { useRealtime } from '@/hooks/use-realtime'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function getStatusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pago: { bg: 'bg-[#28A745]/20', text: 'text-[#28A745]', label: 'Pago' },
    pendente: { bg: 'bg-[#FFC107]/20', text: 'text-[#FFC107]', label: 'Pendente' },
    com_alerta: { bg: 'bg-[#DC3545]/20', text: 'text-[#DC3545]', label: 'Com Alerta' },
    em_conferencia: { bg: 'bg-[#FF9800]/20', text: 'text-[#FF9800]', label: 'Em Conferência' },
    aprovado: { bg: 'bg-[#0066CC]/20', text: 'text-[#0066CC]', label: 'Aprovado' },
    cancelado: { bg: 'bg-[#DC3545]/20', text: 'text-[#DC3545]', label: 'Cancelado' },
  }
  const s = map[status] || { bg: 'bg-white/10', text: 'text-white/70', label: status }
  return <Badge className={`${s.bg} ${s.text} hover:${s.bg} border-transparent`}>{s.label}</Badge>
}

export default function Payments() {
  const [pagamentos, setPagamentos] = useState<any[]>([])

  const loadData = async () => {
    try {
      const data = await getPagamentos()
      setPagamentos(data)
    } catch (e) {
      console.error('Failed to load pagamentos:', e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('pagamentos', loadData)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Pagamentos</h2>
          <p className="text-white/60 text-sm mt-1">Histórico completo e controle de transações.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.1)] text-white bg-transparent"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
          <Button
            variant="outline"
            className="border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.1)] text-white bg-transparent"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      <Card className="hover-glass">
        <CardHeader className="pb-3 border-b border-[rgba(255,255,255,0.05)] mb-4">
          <CardTitle className="text-lg text-white">Todos os Lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {pagamentos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-[rgba(255,255,255,0.05)]">
                  <TableHead className="text-white/70">Descrição</TableHead>
                  <TableHead className="text-white/70">Recebedor</TableHead>
                  <TableHead className="text-white/70">Vencimento</TableHead>
                  <TableHead className="text-white/70">Status</TableHead>
                  <TableHead className="text-right text-white/70">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagamentos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-white">{p.descricao}</TableCell>
                    <TableCell className="text-white/70">
                      {p.expand?.recebedor_id?.nome_razao_social || '-'}
                    </TableCell>
                    <TableCell className="text-white/70">
                      {new Date(p.data_vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </TableCell>
                    <TableCell>{getStatusBadge(p.status)}</TableCell>
                    <TableCell className="text-right font-medium text-white">
                      {formatCurrency(p.valor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)]">
              <div className="bg-[rgba(255,255,255,0.05)] p-4 rounded-full mb-4">
                <CreditCard className="h-8 w-8 text-white/40" />
              </div>
              <h3 className="text-lg font-medium text-white">Histórico vazio</h3>
              <p className="text-sm text-white/50 mt-1 max-w-sm">
                Os dados de pagamentos aparecerão aqui após a sincronização com o sistema.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
