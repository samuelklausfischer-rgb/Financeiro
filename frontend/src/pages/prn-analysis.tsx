import { useState, useEffect } from 'react'
import { z } from 'zod'
import { format } from 'date-fns'
import { RefreshCw, ArrowLeft, BrainCircuit } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  submitPrnAnalysisJson,
  getPrnHistoryRuns,
  getPrnReportData,
  deletePrnReportRun,
  downloadHistoryFile,
  updatePrnRunPayload,
  markPrnRunAsError,
} from '@/services/prn_service'
import { useToast } from '@/hooks/use-toast'

import { LoadingState, ErrorState } from '@/components/prn_core/prn-states'
import { PrnUploadForm, formSchema } from '@/components/prn_core/prn-upload-form'
import { PrnHistoryTable } from '@/components/prn_core/prn-history-table'
import { PrnReportView } from '@/components/prn_core/prn-report-view'
import { parsePrnDailyReceipts } from '@/lib/prn-daily-parser'
import { extractHistoricalRows } from '@/lib/prn-history-workbook'

const normalizePrnPayloadWithDailyFile = async (payload: any, dailyFile: File, referenceDate?: string) => {
  const parsed = await parsePrnDailyReceipts(dailyFile, { referenceDate })
  if (!parsed) return { payload, corrected: false }

  const nextPayload = structuredClone(payload)
  const nextData = nextPayload.data || {}
  const nextSummary = nextPayload.summary || {}

  nextPayload.data = {
    ...nextData,
    receipts: parsed.receipts,
    recebidosPorConta: parsed.receivedByAccount,
  }

  nextPayload.summary = {
    ...nextSummary,
    totalRecebido: parsed.totalReceived,
  }

  if (referenceDate && !nextPayload.referenceDateUsed) {
    nextPayload.referenceDateUsed = referenceDate
  }

  nextPayload.meta = {
    ...(nextPayload.meta || {}),
    receiptsPatchedFromDailyFile: true,
    receiptsPatchedSheet: parsed.sourceSheet,
    receiptsPatchedCount: parsed.receipts.length,
    receiptsPatchedTotal: parsed.totalReceived,
    receiptsPatchedReferenceDate: referenceDate || null,
  }

  return { payload: nextPayload, corrected: true }
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const summarizeHistoricalSources = (
  files: Array<{ original_filename: string }>,
) => {
  if (files.length === 0) return 'historical.xlsx'
  if (files.length === 1) return files[0].original_filename

  return `${files[0].original_filename} (+${files.length - 1})`
}

export default function PrnAnalysis() {
  const { toast } = useToast()
  const [uiState, setUiState] = useState<'upload' | 'loading' | 'report' | 'error'>('upload')
  const [reportData, setReportData] = useState<any>(null)
  const [errorDetails, setErrorDetails] = useState<{ message: string; technical?: string } | null>(
    null,
  )
  const [historyRuns, setHistoryRuns] = useState<any[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [formKey, setFormKey] = useState(0)

  const fetchHistory = async () => {
    setIsHistoryLoading(true)
    try {
      const result = await getPrnHistoryRuns()
      setHistoryRuns(result.items || [])
    } catch (err) {
      console.error('Failed to load PRN history:', err)
    } finally {
      setIsHistoryLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const handleReset = () => {
    setUiState('upload')
    setReportData(null)
    setErrorDetails(null)
    setFormKey((k) => k + 1) // Full reset of the form
  }

  const handleDeleteHistory = async (id: string) => {
    try {
      await deletePrnReportRun(id)
      toast({
        title: 'Sucesso',
        description: 'Histórico excluído com sucesso.',
      })
      fetchHistory()
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível excluir o histórico.',
        variant: 'destructive',
      })
    }
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    let serverRunId: string | null = null
    try {
      setUiState('loading')
      setErrorDetails(null)

      const dailyFile = values.daily_file[0] as File
      const historicalSelection = values.historical_files || { saved: [], temporary: [] }
      const savedHistoricalFiles = Array.isArray(historicalSelection.saved)
        ? historicalSelection.saved
        : []
      const temporaryHistoricalFiles = Array.isArray(historicalSelection.temporary)
        ? historicalSelection.temporary
        : []

      const downloadedHistoricalFiles = await Promise.all(
        savedHistoricalFiles.map((file: any) =>
          downloadHistoryFile(file.name, file.originalFilename || undefined),
        ),
      )

      const historicalSources = [
        ...savedHistoricalFiles.map((file: any) => ({
          storage_name: file.name,
          original_filename: file.originalFilename || file.name,
          source: 'vault' as const,
        })),
        ...temporaryHistoricalFiles.map((file: File) => ({
          original_filename: file.name,
          source: 'temporary' as const,
        })),
      ]

      const historyMeta: Array<{ original_filename: string; source: 'vault' | 'temporary' | 'legacy' }> = [
        ...savedHistoricalFiles.map((file: any) => ({
          original_filename: file.originalFilename || file.name,
          source: 'vault' as const,
        })),
        ...temporaryHistoricalFiles.map((file: File) => ({
          original_filename: file.name,
          source: 'temporary' as const,
        })),
      ]

      const historicalRows = await extractHistoricalRows(
        [...downloadedHistoricalFiles, ...temporaryHistoricalFiles],
        historyMeta,
      )

      const refDateStr = values.reference_date
        ? format(values.reference_date, 'yyyy-MM-dd')
        : undefined

      const [dailyBase64] = await Promise.all([
        fileToBase64(dailyFile),
      ])

      const historicalJsonBlob = new Blob(
        [JSON.stringify(historicalRows)],
        { type: 'application/json' },
      )

      const formData = new FormData()
      formData.append('daily_file', dailyFile)
      formData.append('daily_file_base64', dailyBase64)
      formData.append('daily_filename', dailyFile.name)
      formData.append('historical_file', historicalJsonBlob, 'historical_data.json')
      formData.append('historical_filename', summarizeHistoricalSources(historicalSources))
      formData.append('historical_files_meta', JSON.stringify(historicalSources))
      formData.append('historical_file_count', String(historicalSources.length))
      if (refDateStr) formData.append('reference_date', refDateStr)

      const response = await submitPrnAnalysisJson(formData)
      serverRunId = response._runId || null

      if (!response.ok)
        throw new Error(
          response.error?.message || 'A análise falhou e o servidor retornou um erro.',
        )

      const payload =
        response.type === 'prn_dashboard_payload' ? response : response.reportModel || response

      const normalized = await normalizePrnPayloadWithDailyFile(payload, dailyFile, refDateStr)

      if (normalized.corrected && serverRunId) {
        await updatePrnRunPayload(serverRunId, normalized.payload, {
          ...(response.meta || normalized.payload.meta || {}),
          receiptsPatchedFromDailyFile: true,
        })
      }

      setReportData({ ...normalized.payload, meta: response.meta || normalized.payload.meta })
      setUiState('report')
      toast({ title: 'Sucesso', description: 'Análise PRN gerada com sucesso!' })
    } catch (error: any) {
      if (serverRunId) {
        try {
          await markPrnRunAsError(
            serverRunId,
            error.message || 'Erro no processamento client-side.',
            error.stack || String(error),
          )
        } catch (persistError) {
          console.error('Failed to mark PRN run as error:', persistError)
        }
      }

      const technicalData = error.details || (error.stack ? error.stack : error)
      setErrorDetails({
        message: error.message || 'Ocorreu um erro ao processar os arquivos.',
        technical:
          typeof technicalData === 'object'
            ? JSON.stringify(technicalData, null, 2)
            : String(technicalData),
      })
      setUiState('error')
      toast({
        title: 'Erro na Análise',
        description: 'Verifique os detalhes.',
        variant: 'destructive',
      })
    } finally {
      fetchHistory()
    }
  }

  const handleOpenHistory = async (record: any) => {
    if (record.status === 'error') {
      setUiState('error')
      setErrorDetails({
        message: record.error_message || 'Erro durante a execução.',
        technical: record.error_code || 'Detalhes indisponíveis.',
      })
      return
    }
    try {
      setUiState('loading')
      const runData = await getPrnReportData(record.id)
      if (runData.response_html && !runData.result_json && !runData.meta?._storedReportModel) {
        setReportData({ type: 'legacy_html', html: runData.response_html })
        setUiState('report')
        toast({ title: 'Aviso', description: 'Este é um relatório legado.' })
        return
      }
      const parsedModel = runData.result_json || (runData.meta && runData.meta._storedReportModel)
      if (parsedModel) {
        const payload =
          parsedModel.type === 'prn_dashboard_payload'
            ? parsedModel
            : parsedModel.reportModel || parsedModel
        setReportData({ ...payload, meta: { ...runData.meta, data_referencia: runData.data_referencia } })
        setUiState('report')
      } else {
        throw new Error('Conteúdo do relatório não encontrado.')
      }
    } catch (_err) {
      setUiState('error')
      setErrorDetails({ message: 'Falha ao carregar o relatório do histórico.' })
    }
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-10 h-full max-w-[1600px] mx-auto w-full animate-in fade-in duration-1000">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-white/5 pb-10">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {uiState !== 'upload' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReset}
                className="h-10 w-10 text-white/40 hover:text-white hover:bg-white/10 rounded-2xl transition-all"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
            )}
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/20">
              <BrainCircuit className="h-8 w-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-black tracking-tighter text-white">Análise PRN</h1>
                <Badge
                  className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-black px-3 py-1 rounded-lg text-xs tracking-widest"
                >
                  ENGINE V2
                </Badge>
              </div>
              <p className="text-white/40 font-bold uppercase text-[10px] tracking-[0.2em] mt-1 pl-1">
                 Motor de Inteligência Financeira e Auditoria Cruzada
              </p>
            </div>
          </div>
        </div>
        
        {uiState === 'report' && (
          <Button
            onClick={handleReset}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 px-8 rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-95"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Nova Auditoria
          </Button>
        )}
      </div>

      {uiState === 'loading' && <LoadingState />}
      {uiState === 'error' && <ErrorState error={errorDetails} onReset={handleReset} />}
      {uiState === 'report' && <PrnReportView data={reportData} />}

      {uiState === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="lg:col-span-7 xl:col-span-8">
            <Card className="hover-glass border-white/5 shadow-2xl overflow-hidden">
              <CardHeader className="bg-white/[0.03] border-b border-white/5 pb-8 pt-8 px-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                    <RefreshCw className="h-6 w-6 text-blue-400 animate-spin-slow" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold text-white tracking-tight">Nova Execução de Análise</CardTitle>
                    <CardDescription className="text-white/50 text-sm mt-1 font-medium">
                      Processe seus arquivos diários e históricos com o motor de regras PRN V2.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <PrnUploadForm key={formKey} onSubmit={onSubmit} />
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-5 xl:col-span-4 h-full">
            <div className="sticky top-8">
              <PrnHistoryTable
                historyRuns={historyRuns}
                isHistoryLoading={isHistoryLoading}
                fetchHistory={fetchHistory}
                handleOpenHistory={handleOpenHistory}
                handleDeleteHistory={handleDeleteHistory}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
