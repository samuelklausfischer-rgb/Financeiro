import { useState, useEffect } from 'react'
import { useRealtime } from '@/hooks/use-realtime'
import { AlertCircle, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AnalysisRecord } from '@/services/analise-duplicidade'
import { cn } from '@/lib/utils'

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  if (dateStr.includes('T')) return new Date(dateStr).toLocaleDateString('pt-BR')
  const p = dateStr.split('-')
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`
  return dateStr
}

function DataTable({ records }: { records: any[] }) {
  if (!records || records.length === 0)
    return <p className="text-white/50 p-4">Nenhum caso encontrado para esta categoria.</p>
  return (
    <div className="rounded-md border border-white/10 overflow-x-auto">
      <Table className="text-white/80 whitespace-nowrap">
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead>Linha</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Departamento</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Parcela</TableHead>
            <TableHead>CPF/CNPJ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r, i) => (
            <TableRow key={i} className="border-white/10 hover:bg-white/5">
              <TableCell>{r.linha_origem ?? r.linhaOrigem}</TableCell>
              <TableCell>{r.unidade}</TableCell>
              <TableCell>{r.nome_original ?? r.nomeOriginal}</TableCell>
              <TableCell>{r.departamento_original ?? r.departamentoOriginal}</TableCell>
              <TableCell>{formatCurrency(r.valor_normalizado ?? r.valorNormalizado)}</TableCell>
              <TableCell>{formatDate(r.vencimento)}</TableCell>
              <TableCell>{r.parcela || '-'}</TableCell>
              <TableCell>{(r.cpf_cnpj ?? r.cpfCnpj) || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function GroupedDataTable({ groups }: { groups: any[] }) {
  if (!groups || groups.length === 0)
    return <p className="text-white/50 p-4">Nenhum caso encontrado para esta categoria.</p>
  return (
    <div className="space-y-6">
      {groups.map((g, i) => (
        <div key={i} className="rounded-md border border-white/10 bg-black/40 p-4">
          <h4 className="text-sm font-semibold mb-3 text-white/70">Grupo: {g.groupId || i + 1}</h4>
          <DataTable records={g.records} />
        </div>
      ))}
    </div>
  )
}

function ResultBlock({
  title,
  description,
  icon: Icon,
  colorClass,
  children,
}: {
  title: string
  description: string
  icon: React.ElementType
  colorClass: string
  children: React.ReactNode
}) {
  return (
    <Card className={cn('bg-black/20 text-white shadow-none border', colorClass)}>
      <CardHeader className="border-b border-white/5 pb-4">
        <CardTitle
          className={cn('text-lg flex items-center gap-2', colorClass.replace('border-', 'text-'))}
        >
          <Icon className="w-5 h-5" /> {title}
        </CardTitle>
        <p className="text-sm mt-1 opacity-80">{description}</p>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  )
}

export function ResultsDashboard({ analysis: initialAnalysis }: { analysis: AnalysisRecord }) {
  const [analysis, setAnalysis] = useState<AnalysisRecord>(initialAnalysis)

  useEffect(() => {
    setAnalysis(initialAnalysis)
  }, [initialAnalysis])

  useRealtime('analises_duplicidade', (e) => {
    if ((e.action === 'update' || e.action === 'create') && e.record.id === analysis.id) {
      setAnalysis(
        (prev) =>
          ({ ...prev, ...e.record, expand: prev.expand || e.record.expand }) as AnalysisRecord,
      )
    }
  })

  const { status, result_json, error_message } = analysis

  const getMetric = (snake: keyof AnalysisRecord, camel: string) => {
    const val = analysis[snake] as number
    if (val !== undefined && val !== null && val !== 0) return val
    const summary = result_json?.summary || {}
    const json = result_json || {}
    const fallback = summary[camel] ?? summary[snake] ?? json[camel] ?? json[snake]
    if (fallback !== undefined && fallback !== null) return Number(fallback)
    return val ?? 0
  }

  const metrics = [
    { label: 'Total', val: getMetric('total_records', 'totalRecords') },
    { label: 'Analisáveis', val: getMetric('analyzable_records', 'analyzableRecords') },
    { label: 'Grupos', val: getMetric('group_count', 'groupCount') },
    { label: 'Duplicidades', val: getMetric('duplicate_count', 'duplicateCount') },
    { label: 'G. Manual', val: getMetric('manual_review_count', 'manualReviewCount') },
    {
      label: 'G. Nome Repetido',
      val: getMetric('name_repeat_manual_count', 'nameRepeatManualCount'),
    },
    { label: 'Total Manual', val: getMetric('overall_manual_count', 'overallManualCount') },
  ]

  let statusColor = 'text-gray-400'
  let StatusIcon = CheckCircle2

  if (status === 'processing') {
    statusColor = 'text-blue-400'
    StatusIcon = Loader2
  } else if (status === 'error') {
    statusColor = 'text-red-500'
    StatusIcon = AlertCircle
  } else if (metrics[3].val > 0) {
    statusColor = 'text-red-400'
    StatusIcon = AlertCircle
  } else if (metrics[6].val > 0) {
    statusColor = 'text-yellow-400'
    StatusIcon = AlertTriangle
  } else {
    statusColor = 'text-green-400'
    StatusIcon = CheckCircle2
  }

  return (
    <Card className="bg-white/5 backdrop-blur-md border-white/10 text-white shadow-xl">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <CardTitle className="text-xl">
          Resultado da última análise:{' '}
          <span className="text-white/70 font-normal ml-2">{analysis.file_name}</span>
        </CardTitle>
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/30 w-fit',
            statusColor,
          )}
        >
          <StatusIcon className={cn('h-5 w-5', status === 'processing' && 'animate-spin')} />
          <span className="capitalize font-medium text-sm">
            {status === 'processing' ? 'Processando' : status === 'error' ? 'Erro' : 'Concluído'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">A análise falhou</p>
              <p className="text-sm text-red-200/80 mt-1">
                {error_message || 'Erro desconhecido.'}
              </p>
            </div>
          </div>
        )}

        {(status === 'completed' || status === 'processing') && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-white/90 mb-4 px-1">Resumo das Métricas</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {metrics.map((k) => (
                <div
                  key={k.label}
                  className="bg-black/30 p-3 rounded-lg border border-white/5 text-center flex flex-col justify-center"
                >
                  <p className="text-xs text-white/50 mb-1">{k.label}</p>
                  <p className="text-xl font-bold">{k.val ?? 0}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {status === 'completed' && result_json && (
          <div className="mt-8 space-y-6">
            <h3 className="text-lg font-medium text-white/90 px-1 border-b border-white/10 pb-2">
              Detalhamento por Categoria
            </h3>

            <ResultBlock
              title="Duplicidades Confirmadas"
              description="Casos onde todas as principais chaves coincidem, indicando alta probabilidade de pagamento duplicado."
              icon={AlertCircle}
              colorClass="border-red-500/30 text-red-400"
            >
              <GroupedDataTable groups={result_json.duplicateGroups} />
            </ResultBlock>

            <ResultBlock
              title="Revisão: Mesmo Departamento"
              description="Recomendação: revisar este grupo manualmente antes de aprovação. Coincidência em chaves secundárias."
              icon={AlertTriangle}
              colorClass="border-yellow-500/30 text-yellow-400"
            >
              <GroupedDataTable groups={result_json.manualReviewGroups} />
            </ResultBlock>

            <ResultBlock
              title="Revisão: Nome Repetido"
              description="O nome se repete sem enquadrar nas regras principais. Revisar contexto da despesa."
              icon={AlertTriangle}
              colorClass="border-yellow-500/30 text-yellow-400"
            >
              <GroupedDataTable groups={result_json.nameRepeatManualGroups} />
            </ResultBlock>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
