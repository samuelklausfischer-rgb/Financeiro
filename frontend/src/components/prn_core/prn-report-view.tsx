import { format } from 'date-fns'
import { useMemo } from 'react'
import { ptBR } from 'date-fns/locale'
import { Card } from '@/components/ui/card'
import { FileJson, AlertCircle, TrendingUp, ListOrdered, Layers, Landmark, Users } from 'lucide-react'
import { PrnHeader } from './prn-header'
import { PrnSummaryCards } from './prn-summary-cards'
import { PrnCrossAnalysis } from './prn-cross-analysis'
import { PrnDetails } from './prn-details'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const parseReferenceDate = (value?: string | null) => {
  if (!value) return null

  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const extractDateFromFilename = (filename?: string | null) => {
  if (!filename) return null

  const match = filename.match(/(\d{2})[./-](\d{2})(?:[./-](\d{2,4}))?/)
  if (!match) return null

  const [, day, month, year] = match
  const resolvedYear = year ? (year.length === 2 ? `20${year}` : year) : `${new Date().getUTCFullYear()}`
  const parsed = new Date(`${resolvedYear}-${month}-${day}T12:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function PrnReportView({ data }: { data: any }) {
  if (data?.type === 'legacy_html') {
    return (
      <Card className="p-8 text-center hover-glass border-white/5">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
        <h3 className="text-xl font-bold text-white">Relatório Legado</h3>
        <p className="text-white/40 mt-2 max-w-md mx-auto">
          Relatórios antigos não são mais suportados nesta visualização premium.
        </p>
      </Card>
    )
  }

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center border-2 rounded-3xl bg-white/[0.02] border-dashed border-white/10 animate-in fade-in duration-500">
        <FileJson className="h-20 w-20 text-white/10 mb-6" />
        <h3 className="text-3xl font-black text-white mb-2 tracking-tighter">Motor Silencioso</h3>
        <p className="text-white/30 text-lg max-w-md">
          A execução foi concluída, mas não retornou uma estrutura de dados reconhecida.
        </p>
      </div>
    )
  }

  const crossAnalysis = data.data?.crossAnalysis || { rows: [], months: [] }
  const rawDetails = data.data || {}
  const summary = data.summary || {}

  const referenceDateStr =
    data.meta?.data_referencia ||
    data.request?.referenceDate ||
    null

  const displayDate =
    parseReferenceDate(referenceDateStr) ||
    parseReferenceDate(data.referenceDateUsed) ||
    parseReferenceDate(data.meta?.referenceDateUsed) ||
    extractDateFromFilename(data.request?.dailyFilename)

  const displayTitle = displayDate
    ? format(displayDate, "dd 'de' MMMM", { locale: ptBR })
    : 'Data da planilha'

  const { details, patchedSummary } = useMemo(() => {
    const rawReceipts = Array.isArray(rawDetails.receipts) ? rawDetails.receipts : []
    const filteredReceipts = referenceDateStr
      ? rawReceipts.filter((r: any) => String(r?.data || '') === referenceDateStr)
      : rawReceipts

    const accountTotals = new Map<string, { contaCorrente: string; total: number; count: number }>()
    filteredReceipts.forEach((r: any) => {
      const key = r?.contaCorrente || r?.contaCorrenteOriginal || 'sem_conta'
      const current = accountTotals.get(key) || { contaCorrente: key, total: 0, count: 0 }
      current.total += Number(r?.valor) || 0
      current.count += 1
      accountTotals.set(key, current)
    })
    const filteredAccounts = Array.from(accountTotals.values()).sort((a, b) => b.total - a.total)
    const totalRecebidoFiltered = filteredReceipts.reduce((acc: number, r: any) => acc + (Number(r?.valor) || 0), 0)

    return {
      details: {
        ...rawDetails,
        receipts: filteredReceipts,
        recebidosPorConta: filteredAccounts,
      },
      patchedSummary: {
        ...summary,
        totalRecebido: totalRecebidoFiltered,
      },
    }
  }, [rawDetails, summary, referenceDateStr])

  const header = {
    requestId: data.requestId,
    referenceDateUsed: data.referenceDateUsed,
    dailyFile: data.request?.dailyFilename,
    historicalFile: data.request?.historyFilename,
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="flex flex-col gap-2 mb-8">
         <h2 className="text-5xl font-black text-white tracking-tighter capitalize">{displayTitle}</h2>
         <p className="text-blue-400/60 font-bold uppercase text-xs tracking-[0.3em] pl-1">Resumo da planilha do dia</p>
      </div>

      <PrnHeader header={header} />
      <PrnSummaryCards
        summary={patchedSummary}
        details={details}
        crossAnalysis={crossAnalysis}
        referenceDateUsed={referenceDateStr || data.referenceDateUsed}
      />
      
      <Tabs defaultValue="audit" className="w-full mt-10">
        <TabsList className="mb-8 bg-white/[0.03] p-1.5 flex-wrap h-auto justify-start border border-white/5 rounded-2xl backdrop-blur-xl sticky top-4 z-50 shadow-2xl">
          <TabsTrigger 
            value="audit" 
            className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white font-black text-[10px] uppercase tracking-widest px-8 py-3 transition-all"
          >
            <Layers className="h-3.5 w-3.5 mr-2 opacity-70" /> Auditoria Cruzada
          </TabsTrigger>
          <TabsTrigger 
            value="receipts"
            className="rounded-xl data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-black text-[10px] uppercase tracking-widest px-8 py-3 transition-all"
          >
            <TrendingUp className="h-3.5 w-3.5 mr-2 opacity-70" /> Recebimentos
          </TabsTrigger>
          <TabsTrigger 
            value="categories"
            className="rounded-xl data-[state=active]:bg-amber-600 data-[state=active]:text-white font-black text-[10px] uppercase tracking-widest px-8 py-3 transition-all"
          >
            <ListOrdered className="h-3.5 w-3.5 mr-2 opacity-70" /> Categorias
          </TabsTrigger>
          <TabsTrigger 
            value="accounts"
            className="rounded-xl data-[state=active]:bg-purple-600 data-[state=active]:text-white font-black text-[10px] uppercase tracking-widest px-8 py-3 transition-all"
          >
            <Landmark className="h-3.5 w-3.5 mr-2 opacity-70" /> Contas
          </TabsTrigger>
          <TabsTrigger 
            value="entities"
            className="rounded-xl data-[state=active]:bg-white/10 data-[state=active]:text-white font-black text-[10px] uppercase tracking-widest px-8 py-3 transition-all"
          >
            <Users className="h-3.5 w-3.5 mr-2 opacity-70" /> Entidades
          </TabsTrigger>
        </TabsList>

        <div className="mt-2 min-h-[600px]">
          <TabsContent value="audit" className="focus-visible:outline-none animate-in fade-in zoom-in-95 duration-500">
            <PrnCrossAnalysis data={crossAnalysis} fullPayload={data} />
          </TabsContent>
          
          <TabsContent value="receipts" className="focus-visible:outline-none animate-in fade-in slide-in-from-right-4 duration-500">
            <PrnDetails details={{ receipts: details.receipts }} type="receipts" referenceDate={referenceDateStr || data.referenceDateUsed} />
          </TabsContent>

          <TabsContent value="categories" className="focus-visible:outline-none animate-in fade-in slide-in-from-right-4 duration-500">
            <PrnDetails details={{ categories: details.despesasPorCategoria }} type="categories" />
          </TabsContent>

          <TabsContent value="accounts" className="focus-visible:outline-none animate-in fade-in slide-in-from-right-4 duration-500">
            <PrnDetails details={{ accounts: details.recebidosPorConta }} type="accounts" />
          </TabsContent>

          <TabsContent value="entities" className="focus-visible:outline-none animate-in fade-in slide-in-from-right-4 duration-500">
            <PrnDetails details={{ entities: details.entities }} type="entities" />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
