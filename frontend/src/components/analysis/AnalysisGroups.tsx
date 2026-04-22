import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ResponsiveTable } from './ResponsiveTable'
import { AnalysisResult } from '@/services/analysis'
import {
  renderCrossAnalysisRow,
  renderSemHistoricoRow,
  renderTopExpenseRow,
  renderThreeColRow,
  renderBalanceRow,
} from './AnalysisGroupRows'

function useGroupsState() {
  const [state, setState] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('analysis-groups-state')
      return stored ? JSON.parse(stored) : { g1: true } // g1 open by default
    } catch {
      return { g1: true }
    }
  })

  const toggleGroup = (id: string) => {
    setState((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem('analysis-groups-state', JSON.stringify(next))
      return next
    })
  }

  return [state, toggleGroup] as const
}

const CollapsibleGroup = ({ id, title, children, isOpen, onToggle }: any) => (
  <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-4 shadow-sm transition-all duration-300">
    <button
      role="button"
      aria-expanded={isOpen}
      onClick={() => onToggle(id)}
      className="w-full flex items-center justify-between p-4 bg-gray-600 hover:bg-gray-500 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-h-[44px]"
    >
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <ChevronRight
        className={cn(
          'w-5 h-5 text-gray-300 transition-transform duration-300',
          isOpen ? 'rotate-90' : 'rotate-0',
        )}
      />
    </button>
    <div
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out',
        isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="overflow-hidden">
        <div className="bg-gray-800">{children}</div>
      </div>
    </div>
  </div>
)

export function AnalysisGroups({ data }: { data: AnalysisResult }) {
  const [openStates, toggleGroup] = useGroupsState()

  const groupsConfig = [
    {
      id: 'g1',
      title: '1. Alertas para Análise Manual',
      data: data.alertasManual,
      cols: ['Nome', 'Divergência', 'Média Hist.', 'Valor Dia', 'Último Pgto.'],
      render: renderCrossAnalysisRow,
    },
    {
      id: 'g2',
      title: '2. Com Histórico',
      data: data.comHistorico,
      cols: ['Nome', 'Divergência', 'Média Hist.', 'Valor Dia', 'Último Pgto.'],
      render: renderCrossAnalysisRow,
    },
    {
      id: 'g3',
      title: '3. Diferente Entre Meses',
      data: data.diferenteEntreMeses,
      cols: ['Nome', 'Divergência', 'Média Hist.', 'Valor Dia', 'Último Pgto.'],
      render: renderCrossAnalysisRow,
    },
    {
      id: 'g4',
      title: '4. Exato Todos os Meses',
      data: data.exatoTodosMeses,
      cols: ['Nome', 'Divergência', 'Média Hist.', 'Valor Dia', 'Último Pgto.'],
      render: renderCrossAnalysisRow,
    },
    {
      id: 'g5',
      title: '5. Sem Histórico',
      data: data.semHistorico,
      cols: ['Nome', 'Valor Dia'],
      render: renderSemHistoricoRow,
    },
    {
      id: 'g6',
      title: '6. Top 10 Despesas',
      data: data.top10Despesas,
      cols: ['Pos', 'Favorecido', 'Categoria', 'Valor', 'Vencimento'],
      render: renderTopExpenseRow,
    },
    {
      id: 'g7',
      title: '7. Despesas por Categoria',
      data: data.despesasCategoria,
      cols: ['Categoria', 'Valor', 'Percentual'],
      render: renderThreeColRow('categoria'),
    },
    {
      id: 'g8',
      title: '8. Top Fornecedores',
      data: data.topFornecedores,
      cols: ['Fornecedor', 'Valor', 'Percentual'],
      render: renderThreeColRow('fornecedor'),
    },
    {
      id: 'g9',
      title: '9. Distribuição por Conta',
      data: data.distribuicaoConta,
      cols: ['Conta', 'Valor', 'Percentual'],
      render: renderThreeColRow('conta'),
    },
    {
      id: 'g10',
      title: '10. Balances por Entidade',
      data: data.balancesEntidade,
      cols: ['Entidade', 'Saldo'],
      render: renderBalanceRow,
    },
  ]

  return (
    <div className="space-y-4">
      {groupsConfig.map((g) => (
        <CollapsibleGroup
          key={g.id}
          id={g.id}
          title={g.title}
          isOpen={openStates[g.id]}
          onToggle={toggleGroup}
        >
          <ResponsiveTable columns={g.cols} data={g.data} renderRow={g.render} />
        </CollapsibleGroup>
      ))}
    </div>
  )
}
