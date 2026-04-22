import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SortableTable, ColumnDef } from './sortable-table'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { FileText, TrendingUp } from 'lucide-react'

function getDisplayCategory(item: any) {
  return item?.categoriaExibicao || item?.categoriaOriginal || item?.categoria || 'Indefinido'
}

export function PrnDetails({
  details,
  type,
  referenceDate,
}: {
  details?: any
  type?: string
  referenceDate?: string
}) {
  if (!details) return null

  const receipts = details.receipts || details.recebimentos || []
  const categories = details.categories || details.despesasPorCategoria || []
  const accounts = details.accounts || details.recebidosPorConta || []
  const entities = details.entities || details.entidades || []

  const entityCols: ColumnDef[] = [
    { key: 'label', label: 'Entidade', render: (val, row) => val || row.nome || row.entidade },
    { key: 'saldoBancario', label: 'Saldo Bancário', align: 'right', render: (val) => formatCurrency(val) },
    { key: 'despesas', label: 'Total Despesas', align: 'right', render: (val) => formatCurrency(val) },
  ]

  const receiptCols: ColumnDef[] = [
    { key: 'data', label: 'Data', render: (val) => formatDate(val) },
    { key: 'descricao', label: 'Descrição' },
    { key: 'contaCorrenteOriginal', label: 'Conta', render: (val, row) => val || row.contaCorrente },
    { key: 'valor', label: 'Valor', align: 'right', render: (val) => formatCurrency(val) },
  ]

  const catCols: ColumnDef[] = [
    {
      key: 'categoria',
      label: 'Categoria',
      render: (_val, row) => {
        const label = getDisplayCategory(row)
        return label === 'Indefinido'
          ? <span className="text-amber-400 font-bold">Classificação Pendente ⚠️</span>
          : label
      },
    },
    { key: 'total', label: 'Valor Total', align: 'right', render: (val) => formatCurrency(val) },
    { key: 'count', label: 'Qtd', align: 'center' },
  ]

  const servicos = categories.filter((c: any) => c.tipo === 'servico')
  const reembolsos = categories.filter((c: any) => c.tipo === 'reembolso')

  const accountCols: ColumnDef[] = [
    { key: 'contaCorrente', label: 'Conta Bancária', render: (val, row) => val || row.nome },
    { key: 'total', label: 'Saldo Capturado', align: 'right', render: (val) => formatCurrency(val) },
  ]

  const renderTable = (data: any[], columns: ColumnDef[], emptyMessage?: string) => {
    if (!data || data.length === 0) {
      return (
        <div className="p-20 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
          <p className="text-white/30 font-bold uppercase text-[10px] tracking-widest">
            {emptyMessage || 'Nenhum registro encontrado'}
          </p>
        </div>
      )
    }
    return <SortableTable data={data} columns={columns} />
  }

  const receiptsEmptyMessage = referenceDate
    ? `Nenhum recebimento encontrado para ${formatDate(referenceDate)}`
    : 'Nenhum recebimento encontrado para a data analisada'

  // Se o 'type' for passado, renderiza apenas o conteúdo específico de forma premium
  if (type === 'receipts') return renderTable(receipts, receiptCols, receiptsEmptyMessage)
  if (type === 'categories') {
    const servicosTotal = servicos.reduce((acc: number, c: any) => acc + (c.total || 0), 0)
    const reembolsosTotal = reembolsos.reduce((acc: number, c: any) => acc + (c.total || 0), 0)

    return (
      <div className="space-y-8">
        <div className="bg-emerald-600/10 border border-emerald-600/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-emerald-400 font-bold uppercase text-xs tracking-widest">SERVIÇOS</h4>
            <span className="text-emerald-400 font-black text-lg">{formatCurrency(servicosTotal)}</span>
          </div>
          {renderTable(servicos, catCols, 'Nenhum serviço registrado')}
        </div>

        <div className="bg-purple-600/10 border border-purple-600/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-purple-400 font-bold uppercase text-xs tracking-widest">REEMBOLSO</h4>
            <span className="text-purple-400 font-black text-lg">{formatCurrency(reembolsosTotal)}</span>
          </div>
          {renderTable(reembolsos, catCols, 'Nenhum reembolso registrado')}
        </div>
      </div>
    )
  }
  if (type === 'accounts') return renderTable(accounts, accountCols)
  if (type === 'entities') return renderTable(entities, entityCols)

  return (
    <div className="space-y-6 mt-10 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <FileText className="h-5 w-5 text-blue-400" />
          </div>
          Detalhamento Adicional
        </h3>
      </div>
      
      <Tabs defaultValue="receipts" className="w-full">
        <TabsList className="mb-6 bg-white/[0.03] p-1.5 flex-wrap h-auto justify-start border border-white/5 rounded-2xl backdrop-blur-sm">
          <TabsTrigger value="receipts" className="rounded-xl data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-bold text-xs uppercase tracking-widest px-6 py-2.5 transition-all">
            <TrendingUp className="h-3.5 w-3.5 mr-2 opacity-70" /> Recebimentos
          </TabsTrigger>
          <TabsTrigger value="categories" className="rounded-xl font-bold text-xs uppercase tracking-widest px-6 py-2.5">Categorias</TabsTrigger>
          <TabsTrigger value="accounts" className="rounded-xl font-bold text-xs uppercase tracking-widest px-6 py-2.5">Contas</TabsTrigger>
          <TabsTrigger value="entities" className="rounded-xl font-bold text-xs uppercase tracking-widest px-6 py-2.5">Entidades</TabsTrigger>
        </TabsList>

        <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
          Recebimentos e contas exibem somente os lancamentos do dia analisado.
        </p>

        <div className="mt-2 transition-all duration-500">
          <TabsContent value="receipts" className="focus-visible:outline-none">{renderTable(receipts, receiptCols, receiptsEmptyMessage)}</TabsContent>
          <TabsContent value="categories" className="focus-visible:outline-none">{renderTable(categories, catCols)}</TabsContent>
          <TabsContent value="accounts" className="focus-visible:outline-none">{renderTable(accounts, accountCols)}</TabsContent>
          <TabsContent value="entities" className="focus-visible:outline-none">{renderTable(entities, entityCols)}</TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
