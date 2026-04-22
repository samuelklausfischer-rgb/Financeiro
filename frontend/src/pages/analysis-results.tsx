import { useNavigate } from 'react-router-dom'
import { useAnalysisResults } from '@/hooks/use-analysis-results'
import { analysisService } from '@/services/analysis'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SummaryCard, SecondaryCard } from '@/components/analysis/AnalysisCards'
import { AnalysisGroups } from '@/components/analysis/AnalysisGroups'
import {
  ArrowLeft,
  Fingerprint,
  Calendar,
  TrendingDown,
  TrendingUp,
  Landmark,
  Wallet,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'

export default function AnalysisResults() {
  const navigate = useNavigate()
  const { data, loading, error, isEmpty, retry, clearAndRedirect } = useAnalysisResults()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-3 md:p-6 animate-fade-in duration-500">
        <div className="max-w-[1400px] mx-auto space-y-8">
          <div className="flex justify-between items-center">
            <Skeleton className="h-10 w-48 bg-gray-800" />
            <Skeleton className="h-10 w-32 hidden md:block bg-gray-800" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl bg-gray-800" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl bg-gray-800" />
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl bg-gray-800" />
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl bg-gray-800" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 animate-fade-in duration-500">
        <div className="bg-gray-800 p-8 rounded-xl shadow-sm text-center max-w-md w-full border border-red-900/50">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Erro ao carregar análise</h2>
          <p className="text-gray-400 mb-6">Não foi possível carregar os dados. Tente novamente.</p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => navigate('/analise-prn')}
              className="min-h-[44px] border-gray-600 text-white hover:bg-gray-700"
            >
              Voltar
            </Button>
            <Button
              onClick={retry}
              className="min-h-[44px] bg-white text-gray-900 hover:bg-gray-200"
            >
              Tentar Novamente
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (isEmpty || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 animate-fade-in duration-500">
        <div className="bg-gray-800 p-8 rounded-xl shadow-sm text-center max-w-md w-full border border-gray-700">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingDown className="w-8 h-8 text-gray-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Nenhuma análise disponível</h2>
          <p className="text-gray-400 mb-6">
            Você precisa processar uma planilha para ver os resultados aqui.
          </p>
          <Button
            onClick={() => navigate('/analise-prn')}
            className="w-full min-h-[44px] bg-white text-gray-900 hover:bg-gray-200"
          >
            Ir para Análise PRN
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 p-3 md:p-6 text-white animate-fade-in duration-500 font-sans">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/analise-prn')}
              className="mt-1 min-h-[44px] min-w-[44px] p-0 flex items-center justify-center text-white hover:text-gray-200 hover:bg-gray-800"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[32px] font-bold text-white leading-tight">Análise PRN</h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-blue-500 text-white rounded-md">
                  V2
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Motor de regras JSON com renderização nativa de dados e alertas de variação.
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              localStorage.removeItem('analysis-result-current')
              clearAndRedirect(navigate)
            }}
            className="md:w-auto w-full min-h-[44px] bg-white text-gray-900 hover:bg-gray-200"
          >
            Nova Análise
          </Button>
        </div>

        <div className="bg-white rounded-xl p-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                <Fingerprint className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  ID da Execução
                </div>
                <div className="font-mono text-base font-bold text-gray-900">
                  {data.executionId}
                </div>
              </div>
            </div>

            <div className="hidden sm:block w-px h-12 bg-gray-200"></div>

            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-full">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Data Referência
                </div>
                <div className="text-base font-bold text-green-700">
                  {analysisService.formatDate(data.dataReferencia)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <SummaryCard
            title="Total Despesas"
            value={analysisService.formatCurrency(data.summary.totalDespesas)}
            icon={TrendingDown}
            colorClass="text-red-400"
          />
          <SummaryCard
            title="Total Recebido"
            value={analysisService.formatCurrency(data.summary.totalRecebido)}
            icon={TrendingUp}
            colorClass="text-green-400"
          />
          <SummaryCard
            title="Saldo Bancário"
            value={analysisService.formatCurrency(data.summary.saldoBancario)}
            icon={Landmark}
            colorClass="text-blue-400"
          />
          <SummaryCard
            title="Transf. Necessária"
            value={analysisService.formatCurrency(data.summary.transferenciaNecessaria)}
            icon={RefreshCw}
            colorClass="text-yellow-400"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          <SecondaryCard
            title="Recebimentos (Qtd)"
            value={data.secondary.recebimentosDiariosCount}
          />
          <SecondaryCard
            title="Recebimentos (R$)"
            value={analysisService.formatCurrency(data.secondary.recebimentosDiariosValor)}
          />
          <SecondaryCard title="Emissões (Qtd)" value={data.secondary.emissoesCount} />
          <SecondaryCard
            title="Emissões (R$)"
            value={analysisService.formatCurrency(data.secondary.emissoesValor)}
          />
          <SecondaryCard title="Contas Pagas (Qtd)" value={data.secondary.contasPagasCount} />
          <SecondaryCard
            title="Contas Pagas (R$)"
            value={analysisService.formatCurrency(data.secondary.contasPagasValor)}
          />
          <SecondaryCard title="Vol. Pagamentos" value={data.secondary.volumePagamentos} />
        </div>

        <h2 className="text-[18px] font-bold text-white mt-8 mb-4">Detalhamento</h2>
        <AnalysisGroups data={data} />
      </div>
    </div>
  )
}
