import { cn } from '@/lib/utils'
import { analysisService, CrossAnalysisItem, TopExpense, EntityBalance } from '@/services/analysis'

export const renderCrossAnalysisRow = (item: CrossAnalysisItem, i: number, isMobile: boolean) => {
  const isAlert = item.alertaDivergencia25
  const bgClass = isAlert ? 'bg-red-900 hover:bg-red-800' : 'hover:bg-gray-700/50'
  const mobileBgClass = isAlert ? 'bg-red-900 border-red-800' : 'bg-gray-800 border-gray-700'
  const textClass = isAlert ? 'text-white' : 'text-gray-200'

  if (isMobile) {
    return (
      <div key={i} className={cn('p-4 border rounded-lg space-y-2', mobileBgClass, textClass)}>
        <div className="flex justify-between items-start">
          <span className="text-xs text-gray-400 uppercase">Nome</span>
          <span className="font-medium text-right text-sm">{item.nome}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400 uppercase">Divergência</span>
          <span className={cn('text-sm font-bold', isAlert ? 'text-red-300' : 'text-white')}>
            {analysisService.formatPercent(item.divergenciaPercentual)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400 uppercase">Média Hist.</span>
          <span className="text-sm">{analysisService.formatCurrency(item.mediaHistorica)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400 uppercase">Valor Dia</span>
          <span className="text-sm font-medium">
            {analysisService.formatCurrency(item.valorDia)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400 uppercase">Último Pgto.</span>
          <span className="text-sm text-gray-400">
            {analysisService.formatDate(item.ultimoPagamento)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <tr key={i} className={cn('transition-colors', bgClass, textClass)}>
      <td className="px-4 py-3 font-medium">{item.nome}</td>
      <td className={cn('px-4 py-3 font-bold', isAlert ? 'text-red-300' : 'text-white')}>
        {analysisService.formatPercent(item.divergenciaPercentual)}
      </td>
      <td className="px-4 py-3">{analysisService.formatCurrency(item.mediaHistorica)}</td>
      <td className="px-4 py-3 font-medium">{analysisService.formatCurrency(item.valorDia)}</td>
      <td className="px-4 py-3 opacity-80">{analysisService.formatDate(item.ultimoPagamento)}</td>
    </tr>
  )
}

export const renderSemHistoricoRow = (item: CrossAnalysisItem, i: number, isMobile: boolean) => {
  if (isMobile) {
    return (
      <div
        key={i}
        className="p-4 border border-gray-700 rounded-lg space-y-2 bg-gray-800 text-gray-200"
      >
        <div className="flex justify-between items-start">
          <span className="text-xs text-gray-400 uppercase">Nome</span>
          <span className="font-medium text-right text-sm text-white">{item.nome}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400 uppercase">Valor Dia</span>
          <span className="text-sm font-medium text-white">
            {analysisService.formatCurrency(item.valorDia)}
          </span>
        </div>
      </div>
    )
  }
  return (
    <tr key={i} className="hover:bg-gray-700/50 transition-colors text-gray-200">
      <td className="px-4 py-3 font-medium text-white">{item.nome}</td>
      <td className="px-4 py-3 font-medium text-white">
        {analysisService.formatCurrency(item.valorDia)}
      </td>
    </tr>
  )
}

export const renderTopExpenseRow = (item: TopExpense, i: number, isMobile: boolean) => {
  if (isMobile) {
    return (
      <div
        key={i}
        className="p-4 border border-gray-700 rounded-lg space-y-2 bg-gray-800 flex flex-col text-gray-200"
      >
        <div className="flex justify-between items-center mb-1">
          <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
            #{item.posicao}
          </span>
          <span className="text-sm font-medium text-white">
            {analysisService.formatCurrency(item.valor)}
          </span>
        </div>
        <div className="text-sm font-medium text-white">{item.favorecido}</div>
        <div className="flex justify-between items-center pt-2 border-t border-gray-700 mt-2">
          <span className="text-xs text-gray-300 bg-gray-700 px-2 py-1 rounded">
            {item.categoria}
          </span>
          <span className="text-xs text-gray-400">
            {analysisService.formatDate(item.vencimento)}
          </span>
        </div>
      </div>
    )
  }
  return (
    <tr key={i} className="hover:bg-gray-700/50 transition-colors text-gray-200">
      <td className="px-4 py-3 font-medium text-gray-400">#{item.posicao}</td>
      <td className="px-4 py-3 font-medium text-white">{item.favorecido}</td>
      <td className="px-4 py-3">
        <span className="text-xs text-gray-300 bg-gray-700 px-2 py-1 rounded">
          {item.categoria}
        </span>
      </td>
      <td className="px-4 py-3 font-medium text-white">
        {analysisService.formatCurrency(item.valor)}
      </td>
      <td className="px-4 py-3 text-gray-400">{analysisService.formatDate(item.vencimento)}</td>
    </tr>
  )
}

export const renderThreeColRow =
  (nameField: string) => (item: any, i: number, isMobile: boolean) => {
    if (isMobile) {
      return (
        <div
          key={i}
          className="p-4 border border-gray-700 rounded-lg space-y-2 bg-gray-800 text-gray-200"
        >
          <div className="flex justify-between items-start">
            <span className="font-medium text-sm text-white">{item[nameField]}</span>
            <span className="text-sm font-medium text-white">
              {analysisService.formatCurrency(item.valor)}
            </span>
          </div>
          {item.percentual !== undefined && (
            <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(item.percentual, 100)}%` }}
              ></div>
            </div>
          )}
          <div className="text-xs text-gray-400 text-right mt-1">
            {analysisService.formatPercent(item.percentual)}
          </div>
        </div>
      )
    }
    return (
      <tr key={i} className="hover:bg-gray-700/50 transition-colors text-gray-200">
        <td className="px-4 py-3 font-medium text-white">{item[nameField]}</td>
        <td className="px-4 py-3 font-medium text-white">
          {analysisService.formatCurrency(item.valor)}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="w-12 text-right text-gray-400">
              {analysisService.formatPercent(item.percentual)}
            </span>
            {item.percentual !== undefined && (
              <div className="w-24 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(item.percentual, 100)}%` }}
                ></div>
              </div>
            )}
          </div>
        </td>
      </tr>
    )
  }

export const renderBalanceRow = (item: EntityBalance, i: number, isMobile: boolean) => {
  if (isMobile) {
    return (
      <div
        key={i}
        className="p-4 border border-gray-700 rounded-lg space-y-2 bg-gray-800 flex justify-between items-center text-gray-200"
      >
        <span className="font-medium text-sm text-white">{item.entidade}</span>
        <span className="text-sm font-medium text-white">
          {analysisService.formatCurrency(item.saldo)}
        </span>
      </div>
    )
  }
  return (
    <tr key={i} className="hover:bg-gray-700/50 transition-colors text-gray-200">
      <td className="px-4 py-3 font-medium text-white">{item.entidade}</td>
      <td className="px-4 py-3 font-medium text-white">
        {analysisService.formatCurrency(item.saldo)}
      </td>
    </tr>
  )
}
