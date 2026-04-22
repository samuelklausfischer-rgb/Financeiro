import { useState, useMemo } from 'react'
import { SortableTable, ColumnDef } from './sortable-table'
import { formatCurrency, formatPercentage } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { History, Filter, TrendingUp, TrendingDown, FileText, Search, ChevronDown, ChevronRight } from 'lucide-react'
import { formatMonthName } from '@/lib/audit-utils'
import { generateAuditPDF } from '@/lib/export-pdf'
import { getTaxSubcategoryLabel } from '@/lib/category-labels'
import { PrnOmieLookupSheet } from './prn-omie-lookup-sheet'

function getDisplayCategory(value: any) {
  return value?.categoriaExibicao || value?.categoriaOriginal || value?.categoria || 'Indefinido'
}

function ExpandableRow({ row, months }: { row: any; months: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const hasMultiple = (row.qtdTitulosDia || 1) > 1
  const hasHistory = row.temHistorico && Array.isArray(row.historyLines) && row.historyLines.length > 0
  const displayCategory = getDisplayCategory(row)

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          {hasMultiple && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-white/40 hover:text-white/80 transition-colors"
              aria-label="Expandir linhas"
            >
              {expanded
                ? <ChevronDown className="h-3 w-3" />
                : <ChevronRight className="h-3 w-3" />}
            </button>
          )}
          <span className="font-bold text-white truncate max-w-[200px]">{row.nome}</span>
          {hasMultiple && (
            <Badge className="h-4 px-1.5 bg-blue-500/10 text-blue-400 border-blue-500/20 text-[9px] font-black">
              {row.qtdTitulosDia}
            </Badge>
          )}
        </div>
        {row.departamento && (
          <span className="text-[10px] text-white/30 uppercase tracking-tighter">{row.departamento}</span>
        )}
        {row.subcategoria && (
          <span className="text-[10px] text-blue-300/80 uppercase tracking-[0.18em]">
            {getTaxSubcategoryLabel(row.subcategoriaLabel || row.subcategoria)}
          </span>
        )}
      </div>

      {expanded && hasMultiple && (
        <div className="mt-2 ml-5 space-y-1 border-l border-white/10 pl-3">
          {/* Daily lines */}
          {Array.isArray(row.dailyLines) && row.dailyLines.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Títulos do dia</span>
              {row.dailyLines.map((line: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-white/50 truncate max-w-[180px]">
                    {[line.departamento || 'Sem departamento', line.subcategoriaLabel || getDisplayCategory(line) || displayCategory].filter(Boolean).join(' | ')}
                  </span>
                  <span className="font-mono font-bold text-blue-300">{formatCurrency(line.valor)}</span>
                </div>
              ))}
            </div>
          )}
          {/* History lines for current payee — last 3 occurrences */}
          {hasHistory && (
            <div className="space-y-0.5 mt-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Histórico recente</span>
              {row.historyLines.slice(-6).map((line: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-white/30 font-mono">{line.mes || line.vencimento || '—'}</span>
                  <span className="text-[9px] text-blue-300/70 uppercase truncate max-w-[110px]">{line.subcategoriaLabel || getDisplayCategory(line) || displayCategory}</span>
                  <span className="text-white/40 truncate max-w-[100px]">{line.sourceFile || ''}</span>
                  <span className="font-mono text-white/50">{formatCurrency(line.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

export function PrnCrossAnalysis({ data, fullPayload }: { data?: any, fullPayload?: any }) {
  const [filterGroup, setFilterGroup] = useState<string>('all')
  const [isExporting, setIsExporting] = useState(false)
  const [selectedRow, setSelectedRow] = useState<any | null>(null)
  const [isLookupOpen, setIsLookupOpen] = useState(false)

  const rawRows = useMemo(
    () => (Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : []),
    [data],
  )
  const months = useMemo(() => {
    const incoming = Array.isArray(data?.months) ? data.months : []

    const fromRows = rawRows.flatMap((row: any) =>
      row?.meses && typeof row.meses === 'object' ? Object.keys(row.meses) : [],
    )

    const merged = Array.from(new Set([...incoming, ...fromRows]))
      .filter((m: string) => /^\d{4}-\d{2}$/.test(m))
      .sort()

    return merged.slice(-3)
  }, [data, rawRows])

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await generateAuditPDF(fullPayload)
    } finally {
      setIsExporting(false)
    }
  }

  const filteredData = useMemo(() => {
    if (!rawRows) return []
    if (filterGroup === 'all') return rawRows
    return rawRows.filter((row: any) => {
      if (filterGroup === 'manual_review') return row.alertaDivergencia25
      if (filterGroup === 'exato') return row.grupoMensal === 'exato'
      if (filterGroup === 'sem_historico') return row.grupoMensal === 'sem_historico'
      if (filterGroup === 'diferente') return row.grupoMensal === 'diferente'
      return true
    })
  }, [rawRows, filterGroup])

  if (!rawRows || rawRows.length === 0) return null

  const dynamicMonthCols = months.map((m: string) => ({
    key: `month_${m}`,
    label: formatMonthName(m),
    align: 'right' as const,
    render: (_val: any, row: any) => {
      const val = row.meses?.[m] || 0
      return (
        <span className={cn("font-mono text-xs", val === 0 ? "text-white/20" : "text-white/50")}>
          {formatCurrency(val)}
        </span>
      )
    },
  }))

  const columns: ColumnDef[] = [
    {
      key: 'nome',
      label: 'Favorecido / Entidade',
      render: (_val: any, row: any) => (
        <ExpandableRow row={row} months={months} />
      ),
    },
    {
      key: 'categoria',
      label: 'Categoria',
      render: (val: any, row: any) => {
        const label = getDisplayCategory({ categoria: val, ...row })
        const subcategoria = row.subcategoria ? getTaxSubcategoryLabel(row.subcategoriaLabel || row.subcategoria) : null
        const isServico = row.tipo === 'servico'
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge className={cn(
              "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border-2",
              isServico
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-purple-500/10 text-purple-400 border-purple-500/30"
            )}>
              {label}
            </Badge>
            {subcategoria && (
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300/80">
                {subcategoria}
              </span>
            )}
          </div>
        )
      },
    },
    ...dynamicMonthCols,
    {
      key: 'valorDia',
      label: 'Valor Atual',
      align: 'right',
      render: (_val: any, row: any) => {
        const valorAtual = row?.valorPago ?? row?.valorDia ?? 0

        return (
          <span className={cn(
            "font-black text-sm font-mono",
            valorAtual === 0 ? "text-white/20" : "text-blue-400"
          )}>
            {formatCurrency(valorAtual)}
          </span>
        )
      },
    },
    {
      key: 'mediaHistoricaMensal',
      label: 'Média',
      align: 'right',
      render: (val: any) => (
        <span className="text-white/30 text-xs font-mono">
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      key: 'divergenciaPct',
      label: 'Var %',
      align: 'right',
      render: (val: any) => {
        const absVal = Math.abs(val || 0)
        let colorClass = "text-emerald-400"
        
        if (absVal >= 50) {
          colorClass = "bg-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse"
        } else if (absVal >= 40) {
          colorClass = "bg-red-500/10 text-red-400"
        } else if (absVal >= 25) {
          colorClass = "bg-amber-500/10 text-amber-500"
        } else if (absVal >= 15) {
          colorClass = "bg-yellow-500/10 text-yellow-400"
        } else if (absVal >= 10) {
          colorClass = "bg-lime-500/10 text-lime-400"
        }

        return (
          <div className={cn(
            "flex items-center justify-end gap-1 font-black text-[11px] px-2 py-0.5 rounded-lg w-fit ml-auto transition-all",
            colorClass
          )}>
            {val > 0 ? <TrendingUp className="h-3 w-3" /> : val < 0 ? <TrendingDown className="h-3 w-3" /> : null}
            {formatPercentage(val || 0)}
          </div>
        )
      },
    },
    {
      key: 'acoes',
      label: 'Consulta',
      sortable: false,
      align: 'center',
      render: (_val: any, row: any) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setSelectedRow(row)
            setIsLookupOpen(true)
          }}
          className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 hover:bg-blue-500/10 hover:text-blue-400"
          aria-label={`Consultar ${row.nome} na Omie`}
        >
          <Search className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  const hasData = filteredData.length > 0

  const filters = [
    { id: 'all', label: 'Todos', color: 'text-white' },
    { id: 'manual_review', label: 'Alertas', color: 'text-red-400' },
    { id: 'diferente', label: 'Divergentes', color: 'text-amber-400' },
    { id: 'exato', label: 'Estáveis', color: 'text-emerald-400' },
    { id: 'sem_historico', label: 'Novos', color: 'text-blue-400' },
  ]

  return (
    <div className="space-y-6 mt-10 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
      <div className="space-y-4 border-b border-white/5 pb-6">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-white flex items-center gap-3 tracking-tighter">
              <div className="p-2 bg-blue-500/10 rounded-xl">
                <History className="h-6 w-6 text-blue-400" />
              </div>
              Auditoria cruzada consolidada
            </h3>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] pl-14">
              Compare variações mensais, filtre divergências e revise os registros do dia.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="border-white/10 bg-white/5 hover:bg-white/10 text-white/70 font-bold rounded-xl h-10 px-4 transition-all"
          >
            <FileText className={cn('h-4 w-4 mr-2 text-red-400', isExporting && 'animate-pulse')} />
            {isExporting ? 'Exportando...' : 'Exportar PDF'}
          </Button>
        </div>
        
        <div className="flex items-center gap-3 bg-white/[0.03] p-1.5 rounded-2xl border border-white/5 overflow-x-auto max-w-full custom-scrollbar">
          <div className="flex items-center gap-1.5 px-3">
            <Filter className="h-4 w-4 text-blue-400" />
            <span className="text-[10px] font-black text-white/30 uppercase tracking-tighter">Filtros</span>
          </div>
          <div className="flex items-center gap-2">
            {filters.map((f) => (
              <Button
                key={f.id}
                variant="ghost"
                size="sm"
                onClick={() => setFilterGroup(f.id)}
                className={cn(
                  'whitespace-nowrap rounded-xl h-9 text-[11px] font-bold uppercase tracking-widest transition-all px-4',
                  filterGroup === f.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-white/40 hover:bg-white/5 hover:text-white',
                )}
              >
                <span className={cn("mr-1.5 w-1.5 h-1.5 rounded-full", f.color.replace('text-', 'bg-'))} />
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/5">
        {hasData ? (
          <div className="w-full">
            <SortableTable data={filteredData} columns={columns} />
          </div>
        ) : (
          <div className="p-20 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
             <div className="bg-white/5 p-4 rounded-full w-fit mx-auto mb-4">
               <Filter className="h-8 w-8 text-white/20" />
             </div>
             <p className="text-white/30 font-bold uppercase text-[10px] tracking-widest">
               Nenhum registro encontrado para este filtro
             </p>
          </div>
        )}
      </div>

      <PrnOmieLookupSheet
        open={isLookupOpen}
        onOpenChange={setIsLookupOpen}
        row={selectedRow}
        fullPayload={fullPayload}
      />
    </div>
  )
}
