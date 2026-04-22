import { useState, useEffect } from 'react'
import { Clock, Check, AlertCircle, Calendar, Copy, Users, Building2 } from 'lucide-react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChartContainer } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { getPagamentos } from '@/services/pagamentos'
import { getRecebedores } from '@/services/recebedores'
import { getAlertas } from '@/services/alertas'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'Pago':
      return (
        <Badge className="bg-[#28A745]/20 text-[#28A745] hover:bg-[#28A745]/30 border-[#28A745]/30">
          Pago
        </Badge>
      )
    case 'Pendente':
      return (
        <Badge className="bg-[#FFC107]/20 text-[#FFC107] hover:bg-[#FFC107]/30 border-[#FFC107]/30">
          Pendente
        </Badge>
      )
    case 'Com Alerta':
      return (
        <Badge className="bg-[#DC3545]/20 text-[#DC3545] hover:bg-[#DC3545]/30 border-[#DC3545]/30">
          Com Alerta
        </Badge>
      )
    case 'Em Conferência':
      return (
        <Badge className="bg-[#FF9800]/20 text-[#FF9800] hover:bg-[#FF9800]/30 border-[#FF9800]/30">
          Em Conferência
        </Badge>
      )
    case 'Aprovado':
      return (
        <Badge className="bg-[#0066CC]/20 text-[#0066CC] hover:bg-[#0066CC]/30 border-[#0066CC]/30">
          Aprovado
        </Badge>
      )
    case 'Cancelado':
      return (
        <Badge className="bg-[#DC3545]/20 text-[#DC3545] hover:bg-[#DC3545]/30 border-[#DC3545]/30">
          Cancelado
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="border-white/20 text-white/70">
          {status}
        </Badge>
      )
  }
}

const filterMap: Record<string, string> = {
  Todos: 'todos',
  Pendente: 'pendente',
  Pago: 'pago',
  'Com Alerta': 'com_alerta',
}

export default function Dashboard() {
  const { toast } = useToast()
  const [filter, setFilter] = useState<string>('Todos')
  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [recebedores, setRecebedores] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])

  const loadData = async () => {
    try {
      const [pags, recs, alts] = await Promise.all([
        getPagamentos(),
        getRecebedores(),
        getAlertas(),
      ])
      setPagamentos(pags)
      setRecebedores(recs)
      setAlertas(alts)
    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar as informações do dashboard.',
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('pagamentos', loadData)
  useRealtime('recebedores', loadData)
  useRealtime('alertas', loadData)

  const totalPending = pagamentos.filter((p) => p.status === 'pendente')
  const totalPaid = pagamentos.filter((p) => p.status === 'pago')
  const alertasCount = pagamentos.filter((p) => p.status === 'com_alerta').length

  const now = new Date()
  const next7Days = new Date(now.getTime() + 7 * 86400000)
  const dueSoon = pagamentos.filter((p) => {
    if (p.status === 'pago' || p.status === 'cancelado') return false
    const v = new Date(p.data_vencimento)
    return v >= now && v <= next7Days
  })

  const duplicidades = alertas.filter((a) => a.tipo === 'duplicidade')

  const dashboardKPIs = {
    totalPending: {
      value: totalPending.reduce((acc, p) => acc + p.valor, 0),
      count: totalPending.length,
    },
    totalPaid: { value: totalPaid.reduce((acc, p) => acc + p.valor, 0), count: totalPaid.length },
    alerts: { count: alertasCount },
    dueSoon: { count: dueSoon.length, value: dueSoon.reduce((acc, p) => acc + p.valor, 0) },
    duplicates: {
      count: duplicidades.length,
      value: duplicidades.reduce((acc, a) => {
        const p = pagamentos.find((pag) => pag.id === a.pagamento_id)
        return acc + (p?.valor || 0)
      }, 0),
    },
    receivers: {
      medicos: recebedores.filter((r) => r.tipo === 'medico').length,
      empresas: recebedores.filter((r) => r.tipo === 'empresa' || r.tipo === 'fornecedor').length,
    },
  }

  const formatStatus = (s: string) => {
    const dict: Record<string, string> = {
      pendente: 'Pendente',
      em_conferencia: 'Em Conferência',
      aprovado: 'Aprovado',
      pago: 'Pago',
      cancelado: 'Cancelado',
      com_alerta: 'Com Alerta',
    }
    return dict[s] || s
  }

  const statusColors: Record<string, string> = {
    pendente: '#FFC107', // yellow
    em_conferencia: '#FF9800', // orange
    aprovado: '#0066CC', // blue
    pago: '#28A745', // green
    cancelado: '#DC3545', // red
    com_alerta: '#DC3545',
  }

  const statusMap = pagamentos.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const paymentsByStatus = Object.entries(statusMap).map(([status, count]) => ({
    status: formatStatus(status),
    value: count,
    fill: statusColors[status] || '#999',
  }))

  const typeMap = pagamentos.reduce(
    (acc, p) => {
      const t = p.expand?.recebedor_id?.tipo
      if (t) acc[t] = (acc[t] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const totalPaymentsWithType = Object.values(typeMap).reduce((acc, v) => acc + v, 0)
  const paymentsByType =
    totalPaymentsWithType === 0
      ? []
      : Object.entries(typeMap).map(([tipo, count]) => ({
          name: tipo === 'medico' ? 'Médicos' : tipo === 'empresa' ? 'Empresas' : 'Fornecedores',
          value: Math.round((count / totalPaymentsWithType) * 100),
          fill: tipo === 'medico' ? '#0066CC' : tipo === 'empresa' ? '#333333' : '#666666',
        }))

  const filteredPayments = pagamentos
    .filter((p) => {
      if (filter === 'Todos') return true
      return p.status === filterMap[filter]
    })
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      payee: p.expand?.recebedor_id?.nome_razao_social || 'Desconhecido',
      type:
        p.expand?.recebedor_id?.tipo === 'medico'
          ? 'Médico'
          : p.expand?.recebedor_id?.tipo === 'empresa'
            ? 'Empresa'
            : 'Fornecedor',
      date: p.data_vencimento,
      status: formatStatus(p.status),
      amount: p.valor,
    }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-white">Dashboard Financeiro</h2>
      </div>

      <div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 animate-fade-in-up"
        style={{ animationDelay: '0.1s' }}
      >
        <Card className="hover-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/70">Total Pendente</CardTitle>
            <Clock className="h-5 w-5 text-[#FF9800]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl sm:text-4xl font-bold text-[#FF9800] tracking-tight">
              {formatCurrency(dashboardKPIs.totalPending.value)}
            </div>
            <p className="text-xs text-white/50 mt-1">
              {dashboardKPIs.totalPending.count} aguardando
            </p>
          </CardContent>
        </Card>

        <Card className="hover-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/70">Total Pago</CardTitle>
            <Check className="h-5 w-5 text-[#28A745]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl sm:text-4xl font-bold text-[#28A745] tracking-tight">
              {formatCurrency(dashboardKPIs.totalPaid.value)}
            </div>
            <p className="text-xs text-white/50 mt-1">{dashboardKPIs.totalPaid.count} concluídos</p>
          </CardContent>
        </Card>

        <Card className="hover-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/70">Alertas</CardTitle>
            <AlertCircle className="h-5 w-5 text-[#DC3545]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl sm:text-4xl font-bold text-[#DC3545] tracking-tight">
              {dashboardKPIs.alerts.count}
            </div>
            <p className="text-xs text-white/50 mt-1">Ocorrências</p>
          </CardContent>
        </Card>

        <Card className="hover-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/70">Vencendo</CardTitle>
            <Calendar className="h-5 w-5 text-[#FFC107]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl sm:text-4xl font-bold text-[#FFC107] tracking-tight">
              {dashboardKPIs.dueSoon.count}
            </div>
            <p className="text-xs text-white/50 mt-1">
              {formatCurrency(dashboardKPIs.dueSoon.value)}
            </p>
          </CardContent>
        </Card>

        <Card className="hover-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/70">Duplicidades</CardTitle>
            <Copy className="h-5 w-5 text-[#6F42C1]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl sm:text-4xl font-bold text-[#6F42C1] tracking-tight">
              {dashboardKPIs.duplicates.count}
            </div>
            <p className="text-xs text-white/50 mt-1">
              {formatCurrency(dashboardKPIs.duplicates.value)} suspeitos
            </p>
          </CardContent>
        </Card>

        <Card className="hover-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/70">Recebedores</CardTitle>
            <Users className="h-5 w-5 text-[#0066CC]" />
          </CardHeader>
          <CardContent className="flex justify-between items-end gap-2">
            <div className="flex flex-col">
              <span className="text-2xl sm:text-3xl font-bold text-[#0066CC] tracking-tight flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {dashboardKPIs.receivers.medicos}
              </span>
              <span className="text-[10px] text-white/50 uppercase">Médicos</span>
            </div>
            <div className="flex flex-col text-right items-end">
              <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" /> {dashboardKPIs.receivers.empresas}
              </span>
              <span className="text-[10px] text-white/50 uppercase">Empresas</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div
        className="grid gap-4 md:grid-cols-2 lg:gap-6 animate-fade-in-up"
        style={{ animationDelay: '0.2s' }}
      >
        <Card className="flex flex-col hover-glass">
          <CardHeader>
            <CardTitle className="text-white">Pagamentos por Status</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            <div className="h-[250px] w-full">
              {paymentsByStatus.length > 0 ? (
                <ChartContainer config={{}} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={paymentsByStatus}
                      margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="rgba(255,255,255,0.1)"
                      />
                      <XAxis
                        dataKey="status"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'rgba(255,255,255,0.6)' }}
                        dy={10}
                      />
                      <YAxis
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'rgba(255,255,255,0.6)' }}
                        dx={-10}
                      />
                      <RechartsTooltip
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{
                          backgroundColor: 'rgba(20,20,20,0.9)',
                          backdropFilter: 'blur(10px)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.15)',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                          color: 'white',
                        }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {paymentsByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Sem dados disponíveis
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-white">Distribuição por Tipo de Recebedor</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center pb-4">
            <div className="h-[200px] w-full">
              {paymentsByType.length > 0 ? (
                <ChartContainer config={{}} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentsByType}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {paymentsByType.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: number) => [`${value}%`, 'Volume']}
                        contentStyle={{
                          backgroundColor: 'rgba(20,20,20,0.9)',
                          backdropFilter: 'blur(10px)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.15)',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                          color: 'white',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-white/50 text-sm">
                  Sem dados disponíveis
                </div>
              )}
            </div>
            {paymentsByType.length > 0 && (
              <div className="mt-8 flex justify-center gap-8">
                {paymentsByType.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-full shadow-sm"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-white/70 font-medium">{item.name}</span>
                    <span className="font-bold text-white ml-1">{item.value}%</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="animate-fade-in-up hover-glass" style={{ animationDelay: '0.3s' }}>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-4">
          <CardTitle className="text-white">Últimos Pagamentos</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={filter === 'Todos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('Todos')}
              className={cn(
                'border-white/10 text-white hover:bg-white/10',
                filter === 'Todos' && 'bg-blue-600 hover:bg-blue-700 border-transparent',
              )}
            >
              Todos
            </Button>
            <Button
              variant={filter === 'Pendente' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('Pendente')}
              className={cn(
                'border-white/10 text-white hover:bg-white/10',
                filter === 'Pendente' && 'bg-yellow-600 hover:bg-yellow-700 border-transparent',
              )}
            >
              Pendente
            </Button>
            <Button
              variant={filter === 'Pago' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('Pago')}
              className={cn(
                'border-white/10 text-white hover:bg-white/10',
                filter === 'Pago' && 'bg-green-600 hover:bg-green-700 border-transparent',
              )}
            >
              Pago
            </Button>
            <Button
              variant={filter === 'Com Alerta' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('Com Alerta')}
              className={cn(
                'border-white/10 text-white hover:bg-white/10',
                filter === 'Com Alerta' && 'bg-red-600 hover:bg-red-700 border-transparent',
              )}
            >
              Com Alerta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-white/10">
                <TableHead className="text-white/70 font-semibold">Recebedor</TableHead>
                <TableHead className="text-white/70 font-semibold">Tipo</TableHead>
                <TableHead className="text-white/70 font-semibold">Vencimento</TableHead>
                <TableHead className="text-white/70 font-semibold">Status</TableHead>
                <TableHead className="text-right text-white/70 font-semibold">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment) => (
                <TableRow
                  key={payment.id}
                  className="border-white/5 hover:bg-white/5 transition-colors"
                >
                  <TableCell className="font-medium text-white">{payment.payee}</TableCell>
                  <TableCell className="text-white/70">{payment.type}</TableCell>
                  <TableCell className="text-white/70">
                    {new Date(payment.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                  </TableCell>
                  <TableCell>{getStatusBadge(payment.status)}</TableCell>
                  <TableCell className="text-right font-medium text-white">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                </TableRow>
              ))}
              {filteredPayments.length === 0 && (
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableCell colSpan={5} className="text-center py-8 text-white/50">
                    Nenhum pagamento encontrado para o filtro selecionado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
